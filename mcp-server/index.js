#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TimeponServer {
  // Configuration constants
  static MAX_FILE_SIZE = 1024 * 1024; // 1MB
  static BINARY_DETECTION_SAMPLE = 512; // bytes
  static BINARY_THRESHOLD = 0.3; // 30% non-printable
  static SAVE_RETRY_MAX = 3;
  static SAVE_RETRY_BASE_DELAY = 1000; // ms
  static WATCH_STABILITY_THRESHOLD = 2000; // ms
  static WATCH_POLL_INTERVAL = 100; // ms

  constructor() {
    this.server = new Server(
      {
        name: 'timepon-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Get workspace root from environment or default to parent directory
    this.workspaceRoot = process.env.TIMEPON_WORKSPACE || path.resolve(__dirname, '..');
    this.yamlPath = path.join(this.workspaceRoot, '_timepon.yaml');
    this.metadata = { files: {} };
    this.watcher = null;
    
    // Initialization and retry tracking
    // Note: isInitializing set to true here, will be managed by startWatching()
    this.isInitializing = false; // Start as false, set by startWatching
    this.saveRetryCount = 0;

    this.setupHandlers();
    this.setupErrorHandling();
  }

  async initialize() {
    // Create default .tponignore if it doesn't exist
    await this.ensureIgnoreFile();
    
    // Load existing metadata if it exists
    await this.loadMetadata();
    
    // Start watching for file changes
    await this.startWatching();
    
    console.error(`Timepon MCP server started. Watching: ${this.workspaceRoot}`);
  }

  async ensureIgnoreFile() {
    const tponignorePath = path.join(this.workspaceRoot, '.tponignore');
    
    // Skip if file already exists
    if (existsSync(tponignorePath)) {
      return;
    }
    
    // Create default .tponignore file
    const defaultContent = `# Timepon Ignore Patterns
# Lines starting with # are comments
# Patterns follow .gitignore syntax

# Dependencies
node_modules/
bower_components/
vendor/
packages/

# Build outputs
dist/
build/
out/
target/
*.min.js
*.min.css

# IDE & Editor
.vscode/
.idea/
.cursor/
*.swp
*.swo
*~
.project
.classpath
.settings/

# OS files
.DS_Store
Thumbs.db
Desktop.ini
._*

# Version control
.git/
.svn/
.hg/

# Logs
*.log
logs/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Temp files
tmp/
temp/
*.tmp
*.temp

# Test coverage
coverage/
.nyc_output/
htmlcov/
*.cover

# Cache
.cache/
.parcel-cache/
.next/
.nuxt/
.vuepress/dist

# Environment & secrets
.env
.env.local
.env.*.local
*.key
*.pem
credentials.json

# Timepon internal
_timepon.yaml
_timepon.yaml.backup.*

# Large binary/media files (optional - uncomment if needed)
# *.mp4
# *.mov
# *.avi
# *.pdf
# *.zip
# *.tar.gz
`;
    
    try {
      await fs.writeFile(tponignorePath, defaultContent, 'utf-8');
      console.error('Created default .tponignore file');
    } catch (error) {
      console.error('Warning: Failed to create .tponignore file:', error.message);
    }
  }

  async loadMetadata() {
    try {
      if (existsSync(this.yamlPath)) {
        const content = await fs.readFile(this.yamlPath, 'utf-8');
        const parsed = YAML.parse(content);
        
        // Validate structure
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid YAML structure: not an object');
        }
        
        if (!parsed.files || typeof parsed.files !== 'object') {
          console.error('Warning: YAML missing valid files object, starting fresh');
          this.metadata = { files: {} };
          return;
        }
        
        this.metadata = parsed;
        console.error(`Loaded metadata for ${Object.keys(this.metadata.files).length} files`);
      } else {
        this.metadata = { files: {} };
        console.error('No existing metadata found, starting fresh');
      }
    } catch (error) {
      console.error(`ERROR: Failed to load metadata from ${this.yamlPath}:`, error.message);
      
      // Create backup of corrupted file
      if (existsSync(this.yamlPath)) {
        const backupPath = `${this.yamlPath}.backup.${Date.now()}`;
        try {
          await fs.copyFile(this.yamlPath, backupPath);
          console.error(`Corrupted metadata backed up to: ${backupPath}`);
        } catch (backupError) {
          console.error('Failed to create backup:', backupError.message);
        }
      }
      
      this.metadata = { files: {} };
    }
  }

  async saveMetadata() {
    try {
      // Convert flat structure to tree structure for YAML
      const treeStructure = this.buildFileTree(this.metadata.files);
      
      // Create formatted YAML with header
      const fileCount = Object.keys(this.metadata.files).length;
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = now.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      
      const header = `TIMEPON FILE TRACKING
${this.workspaceRoot}
==========================================================================
Last Updated:     ${formattedDate} at ${formattedTime}
Files Tracked:    ${fileCount}

TIP: Use code folding to collapse folders (click arrows by line numbers)

Ctrl+K Ctrl+0 = fold all | Ctrl+K Ctrl+J = unfold all
==========================================================================

`;
      
      // Generate YAML with custom spacing
      const yamlContent = this.formatYamlWithSpacing(treeStructure);
      
      const footer = '\n==========================================================================\nEnd of Timepon tracking data\n==========================================================================\n';
      
      const fullContent = header + yamlContent + footer;
      
      await fs.writeFile(this.yamlPath, fullContent, 'utf-8');
      console.error('Metadata saved to _timepon.yaml');
      this.saveRetryCount = 0; // Reset on success
    } catch (error) {
      console.error(`Error saving metadata (attempt ${this.saveRetryCount + 1}/${TimeponServer.SAVE_RETRY_MAX}):`, error.message);
      
      if (this.saveRetryCount < TimeponServer.SAVE_RETRY_MAX) {
        this.saveRetryCount++;
        const delayMs = Math.pow(2, this.saveRetryCount) * TimeponServer.SAVE_RETRY_BASE_DELAY; // Exponential backoff
        console.error(`Retrying in ${delayMs}ms...`);
        
        // Wrap retry in error handler
        setTimeout(async () => {
          try {
            await this.saveMetadata();
          } catch (retryError) {
            console.error('ERROR: Save retry failed:', retryError.message);
            // Error will be handled by the recursive call's catch block
          }
        }, delayMs);
      } else {
        console.error('ERROR: Failed to save metadata after maximum retries. Data may be lost!');
        this.saveRetryCount = 0; // Reset for next attempt
      }
    }
  }

  /**
   * Format YAML with custom spacing between sections for readability
   */
  formatYamlWithSpacing(tree) {
    const lines = [];
    
    // Metadata section
    lines.push(`workspace: ${tree.workspace}`);
    lines.push(`lastUpdated: '${tree.lastUpdated}'`);
    lines.push(`totalFiles: ${tree.totalFiles}`);
    lines.push('');
    lines.push('files:');
    lines.push('');
    
    // Add Root folder with icon
    lines.push('  # === 🏠 Root');
    lines.push('  Root:');
    
    // Format files tree with spacing (level 2 for proper nesting under Root)
    if (tree.files && Object.keys(tree.files).length > 0) {
      this.formatTreeLevel(tree.files, 2, lines);
    }
    
    return lines.join('\n');
  }

  /**
   * Get file type icon based on extension
   */
  getFileIcon(filename) {
    const ext = path.extname(filename).toLowerCase();
    const iconMap = {
      '.md': '📄',
      '.txt': '📝',
      '.js': '⚡',
      '.ts': '🔷',
      '.py': '🐍',
      '.json': '📋',
      '.yaml': '⚙️',
      '.yml': '⚙️',
      '.html': '🌐',
      '.css': '🎨',
      '.sh': '🔧',
      '.ps1': '🔧',
      '.bat': '🔧',
    };
    return iconMap[ext] || '📄';
  }

  /**
   * Format date as human-readable with relative time
   */
  formatDateTime(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let relative = '';
    if (diffMins < 1) {
      relative = 'just now';
    } else if (diffMins < 60) {
      relative = `${diffMins}m ago`;
    } else if (diffHours < 24) {
      relative = `${diffHours}h ago`;
    } else if (diffDays < 7) {
      relative = `${diffDays}d ago`;
    } else {
      const weeks = Math.floor(diffDays / 7);
      relative = `${weeks}w ago`;
    }

    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `${dateStr} ${timeStr} >>(${relative})<<`;
  }

  /**
   * Get just the relative time portion
   */
  getRelativeTime(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}w ago`;
    }
  }

  /**
   * Recursively format tree levels with proper indentation and spacing
   */
  formatTreeLevel(obj, level, lines) {
    const indent = '  '.repeat(level);
    const entries = Object.entries(obj);
    
    // Separate files from directories and sort each group
    const files = [];
    const dirs = [];
    
    entries.forEach(([key, value]) => {
      const isFile = value && typeof value === 'object' && 'created' in value;
      if (isFile) {
        files.push([key, value]);
      } else {
        dirs.push([key, value]);
      }
    });
    
    // Sort files by creation time (newest first)
    files.sort(([, a], [, b]) => new Date(b.created) - new Date(a.created));
    
    // Sort directories alphabetically
    dirs.sort(([a], [b]) => a.localeCompare(b));
    
    // Process directories first, then files
    const sortedEntries = [...dirs, ...files];
    
    sortedEntries.forEach(([key, value], index) => {
      const isFile = value && typeof value === 'object' && 'created' in value;
      
      if (isFile) {
        // File entry - add blank line before each file for readability
        if (index > 0) {
          lines.push('');
        }
        
        // Add file with icon in comment, then clean YAML key
        const icon = this.getFileIcon(key);
        const timestamp = this.formatDateTime(value.created);
        const relativeAge = this.getRelativeTime(value.created);
        lines.push(`${indent}# ${icon} ${key}  >> ${relativeAge} <<`);
        lines.push(`${indent}${key}:`);
        lines.push(`${indent}  created: ${timestamp}`);
        lines.push(`${indent}  summary: ${value.summary}`);
        
        if (value.tags && value.tags.length > 0) {
          const tagStr = value.tags.join(', ');
          lines.push(`${indent}  tags: [${tagStr}]`);
        } else {
          lines.push(`${indent}  tags: []`);
        }
      } else {
        // Directory entry - add blank line and section header
        if (index > 0) {
          lines.push('');
        }
        
        // Add collapsible section marker with minimal decoration as comment
        lines.push(`${indent}# === 📁 ${key}`);
        lines.push(`${indent}${key}:`);
        
        if (value && typeof value === 'object') {
          this.formatTreeLevel(value, level + 1, lines);
        }
      }
    });
  }

  buildFileTree(filesObj) {
    const now = new Date();
    const tree = {
      workspace: this.workspaceRoot,
      lastUpdated: now.toISOString(),
      totalFiles: Object.keys(filesObj).length,
      files: {},
    };

    // Sort files by creation time (newest first)
    const sortedEntries = Object.entries(filesObj).sort(
      ([, a], [, b]) => new Date(b.created) - new Date(a.created)
    );

    for (const [filePath, metadata] of sortedEntries) {
      const relativePath = path.relative(this.workspaceRoot, filePath);
      const parts = relativePath.split(path.sep);
      
      let current = tree.files;
      
      // Build nested structure
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (i === parts.length - 1) {
          // Leaf node (file)
          current[part] = {
            created: metadata.created,
            summary: metadata.summary,
            tags: metadata.tags,
          };
        } else {
          // Directory node
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    }

    return tree;
  }

  /**
   * Parse ignore file (supports .gitignore syntax)
   */
  async parseIgnoreFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')) // Remove comments and empty lines
        .map(pattern => this.globToRegex(pattern));
    } catch (error) {
      // File doesn't exist or can't be read - that's okay
      return [];
    }
  }

  /**
   * Convert gitignore-style glob pattern to regex
   */
  globToRegex(pattern) {
    // Handle directory-only patterns (ending with /)
    const isDirectoryOnly = pattern.endsWith('/');
    if (isDirectoryOnly) {
      pattern = pattern.slice(0, -1);
    }

    // Escape special regex characters except * and ?
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    // If pattern doesn't start with /, it can match anywhere
    if (!pattern.startsWith('/')) {
      regexPattern = `(^|[/\\\\])${regexPattern}`;
    } else {
      regexPattern = `^${regexPattern.slice(1)}`;
    }

    // If directory-only, match with trailing slash
    if (isDirectoryOnly) {
      regexPattern = `${regexPattern}([/\\\\]|$)`;
    }

    return new RegExp(regexPattern);
  }

  /**
   * Load ignore patterns from .tponignore and .gitignore
   */
  async loadIgnorePatterns() {
    const patterns = [];

    // Load .tponignore first (higher priority)
    const tponignorePath = path.join(this.workspaceRoot, '.tponignore');
    const tponPatterns = await this.parseIgnoreFile(tponignorePath);
    patterns.push(...tponPatterns);

    // Load .gitignore (fallback)
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    const gitPatterns = await this.parseIgnoreFile(gitignorePath);
    patterns.push(...gitPatterns);

    // Always ignore these
    patterns.push(
      /(^|[\/\\])_timepon\.yaml/,
      /(^|[\/\\])_timepon\.yaml\.backup\./,
    );

    return patterns;
  }

  async startWatching() {
    // Load ignore patterns from files
    const ignoredPatterns = await this.loadIgnorePatterns();
    
    console.error(`File watcher initialized with ${ignoredPatterns.length} ignore patterns`);

    // Set initialization flag for batched save
    this.isInitializing = true;

    this.watcher = chokidar.watch(this.workspaceRoot, {
      ignored: ignoredPatterns,
      persistent: true,
      ignoreInitial: false, // Process existing files on startup
      awaitWriteFinish: {
        stabilityThreshold: TimeponServer.WATCH_STABILITY_THRESHOLD,
        pollInterval: TimeponServer.WATCH_POLL_INTERVAL,
      },
    });

    this.watcher.on('add', async (filePath) => {
      await this.handleFileCreation(filePath);
    });

    // After all initial files processed, save once
    this.watcher.on('ready', async () => {
      this.isInitializing = false;
      await this.saveMetadata(); // Single save after startup
      console.error('Initial file scan complete');
    });

    console.error('File watcher initialized');
  }

  async handleFileCreation(filePath) {
    try {
      // Skip if already tracked
      if (this.metadata.files[filePath]) {
        return;
      }

      const stats = await fs.stat(filePath);
      const content = await this.readFileContent(filePath, stats); // Pass stats
      
      // Generate metadata
      const metadata = {
        created: stats.birthtime.toISOString(),
        summary: this.generateSummary(content, filePath),
        tags: this.generateTags(content, filePath),
      };

      this.metadata.files[filePath] = metadata;
      
      // Only save immediately during runtime
      if (!this.isInitializing) {
        await this.saveMetadata();
      }

      console.error(`Tracked new file: ${path.relative(this.workspaceRoot, filePath)}`);
    } catch (error) {
      console.error(`Error handling file creation for ${filePath}:`, error.message);
    }
  }

  async readFileContent(filePath, stats = null) {
    try {
      // Use provided stats or fetch if not provided
      if (!stats) {
        stats = await fs.stat(filePath);
      }
      
      // Skip very large files
      if (stats.size > TimeponServer.MAX_FILE_SIZE) {
        return '';
      }

      // Read as buffer first for binary detection
      const buffer = await fs.readFile(filePath);
      
      // Check if it's binary BEFORE converting to UTF-8
      if (this.isBinary(buffer, filePath)) {
        return '';
      }

      // Only convert to string if it's text
      const content = buffer.toString('utf-8');
      return content;
    } catch (error) {
      return '';
    }
  }

  isBinary(bufferOrContent, filePath) {
    // Check file extension first (fast path)
    const ext = path.extname(filePath).toLowerCase();
    const knownTextExts = ['.txt', '.md', '.json', '.js', '.ts', '.py', '.java', 
                           '.cs', '.go', '.rb', '.php', '.html', '.css', '.xml', 
                           '.yaml', '.yml', '.toml', '.ini', '.sh', '.bat', '.ps1'];
    if (knownTextExts.includes(ext)) {
      return false;
    }
    
    const knownBinaryExts = ['.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
                             '.zip', '.tar', '.gz', '.7z', '.rar', '.jpg', '.jpeg',
                             '.png', '.gif', '.bmp', '.pdf', '.doc', '.docx', '.xls'];
    if (knownBinaryExts.includes(ext)) {
      return true;
    }
    
    // Convert to Buffer if it's a string (for backwards compatibility)
    const buffer = Buffer.isBuffer(bufferOrContent) 
      ? bufferOrContent 
      : Buffer.from(bufferOrContent, 'utf-8');
    
    // Check magic bytes for common binary formats
    if (buffer.length >= 4) {
      // ZIP/JAR/DOCX (PK..)
      if (buffer[0] === 0x50 && buffer[1] === 0x4B) return true;
      // PNG
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
      // GIF
      if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return true;
      // JPEG
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) return true;
      // PDF
      if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return true;
    }
    
    // Fall back to non-printable character check
    const sampleSize = Math.min(buffer.length, TimeponServer.BINARY_DETECTION_SAMPLE);
    
    // Guard against empty files
    if (sampleSize === 0) {
      return false; // Empty files are treated as text
    }
    
    let nonPrintable = 0;
    for (let i = 0; i < sampleSize; i++) {
      const byte = buffer[i];
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        nonPrintable++;
      }
    }
    
    return nonPrintable / sampleSize > TimeponServer.BINARY_THRESHOLD;
  }

  generateSummary(content, filePath) {
    const ext = path.extname(filePath);
    
    if (!content) {
      return `${ext} file`;
    }

    // For markdown, get first heading or first line
    if (ext === '.md') {
      const lines = content.split('\n').filter(l => l.trim());
      const heading = lines.find(l => l.startsWith('#'));
      if (heading) {
        return heading.replace(/^#+\s*/, '').slice(0, 80);
      }
      return lines[0]?.slice(0, 80) || 'Empty markdown file';
    }

    // For code files, look for class/function names or comments
    if (['.js', '.ts', '.py', '.java', '.cs', '.go'].includes(ext)) {
      const lines = content.split('\n').filter(l => l.trim());
      const comment = lines.find(l => l.trim().startsWith('//') || l.trim().startsWith('#'));
      if (comment) {
        return comment.replace(/^[\/\/#]+\s*/, '').slice(0, 80);
      }
      return `${ext.slice(1)} source file`;
    }

    // Generic: first non-empty line
    const firstLine = content.split('\n').find(l => l.trim());
    return firstLine?.slice(0, 80) || path.basename(filePath);
  }

  generateTags(content, filePath) {
    const tags = [];
    const ext = path.extname(filePath).slice(1);
    
    if (ext) {
      tags.push(ext);
    }

    // Detect file type categories
    const codeExts = ['js', 'ts', 'py', 'java', 'cs', 'go', 'rb', 'php', 'cpp', 'c', 'rs'];
    const docExts = ['md', 'txt', 'rst', 'adoc'];
    const configExts = ['json', 'yaml', 'yml', 'toml', 'ini', 'env'];

    if (codeExts.includes(ext)) {
      tags.push('code');
    } else if (docExts.includes(ext)) {
      tags.push('docs');
    } else if (configExts.includes(ext)) {
      tags.push('config');
    }

    // Content-based tags for markdown
    if (ext === 'md' && content) {
      const lower = content.toLowerCase();
      if (lower.includes('todo') || lower.includes('task')) tags.push('tasks');
      if (lower.includes('api') || lower.includes('endpoint')) tags.push('api');
      if (lower.includes('schema') || lower.includes('database')) tags.push('data');
      if (lower.includes('architecture') || lower.includes('design')) tags.push('architecture');
    }

    return tags.slice(0, 3); // Max 3 tags
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_all_files',
          description: 'Get all tracked files with their metadata (creation time, summary, tags). Returns a list of all files being tracked in the workspace.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: 'get_files_by_tag',
          description: 'Get files filtered by a specific tag (e.g., "md", "docs", "code", "config", "api", "data")',
          inputSchema: {
            type: 'object',
            properties: {
              tag: {
                type: 'string',
                description: 'Tag to filter by. Common tags: md, js, ts, py, docs, code, config, api, tasks, data, architecture',
              },
            },
            required: ['tag'],
            additionalProperties: false,
          },
        },
        {
          name: 'get_recent_files',
          description: 'Get files created within a specified time period (default: last 24 hours)',
          inputSchema: {
            type: 'object',
            properties: {
              hours: {
                type: 'number',
                description: 'Number of hours to look back (e.g., 24 for last day, 1 for last hour)',
                minimum: 0.1,
                default: 24,
              },
            },
            additionalProperties: false,
          },
        },
        {
          name: 'search_files',
          description: 'Search files by filename or summary content using text matching',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query to match against filename or summary (case-insensitive)',
                minLength: 1,
              },
            },
            required: ['query'],
            additionalProperties: false,
          },
        },
        {
          name: 'refresh_metadata',
          description: 'Force a refresh of the metadata by rescanning the entire workspace for files',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_all_files':
            return await this.getAllFiles();
          
          case 'get_files_by_tag':
            return await this.getFilesByTag(args.tag);
          
          case 'get_recent_files':
            return await this.getRecentFiles(args.hours || 24);
          
          case 'search_files':
            return await this.searchFiles(args.query);
          
          case 'refresh_metadata':
            return await this.refreshMetadata();
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`Error in tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error in ${name}: ${error.message}\n\nPlease check the server output panel for details.`,
            },
          ],
        };
      }
    });
  }

  async getAllFiles() {
    const files = Object.entries(this.metadata.files)
      .sort(([, a], [, b]) => new Date(b.created) - new Date(a.created))
      .map(([filePath, metadata]) => ({
        path: path.relative(this.workspaceRoot, filePath),
        ...metadata,
      }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ count: files.length, files }, null, 2),
        },
      ],
    };
  }

  async getFilesByTag(tag) {
    // Validate input
    if (!tag || typeof tag !== 'string') {
      throw new Error('Tag parameter must be a non-empty string');
    }
    
    if (!this.metadata || !this.metadata.files) {
      throw new Error('Metadata not initialized');
    }
    
    const files = Object.entries(this.metadata.files)
      .filter(([, metadata]) => metadata.tags.includes(tag))
      .sort(([, a], [, b]) => new Date(b.created) - new Date(a.created))
      .map(([filePath, metadata]) => ({
        path: path.relative(this.workspaceRoot, filePath),
        ...metadata,
      }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ tag, count: files.length, files }, null, 2),
        },
      ],
    };
  }

  async getRecentFiles(hours) {
    // Validate input
    if (typeof hours !== 'number' || hours <= 0) {
      throw new Error('Hours parameter must be a positive number');
    }
    
    if (!this.metadata || !this.metadata.files) {
      throw new Error('Metadata not initialized');
    }
    
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const files = Object.entries(this.metadata.files)
      .filter(([, metadata]) => new Date(metadata.created) > cutoff)
      .sort(([, a], [, b]) => new Date(b.created) - new Date(a.created))
      .map(([filePath, metadata]) => ({
        path: path.relative(this.workspaceRoot, filePath),
        ...metadata,
      }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ hours, count: files.length, files }, null, 2),
        },
      ],
    };
  }

  async searchFiles(query) {
    // Validate input
    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter must be a non-empty string');
    }
    
    if (!this.metadata || !this.metadata.files) {
      throw new Error('Metadata not initialized');
    }
    
    const lowerQuery = query.toLowerCase();
    
    const files = Object.entries(this.metadata.files)
      .filter(([filePath, metadata]) => {
        const fileName = path.basename(filePath).toLowerCase();
        const summary = metadata.summary.toLowerCase();
        return fileName.includes(lowerQuery) || summary.includes(lowerQuery);
      })
      .sort(([, a], [, b]) => new Date(b.created) - new Date(a.created))
      .map(([filePath, metadata]) => ({
        path: path.relative(this.workspaceRoot, filePath),
        ...metadata,
      }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ query, count: files.length, files }, null, 2),
        },
      ],
    };
  }

  async refreshMetadata() {
    console.error('Refreshing metadata...');
    
    const existingFiles = Object.keys(this.metadata.files);
    let updatedCount = 0;
    let errorCount = 0;
    let staleCount = 0;
    
    // Performance: Process files in batches to avoid overwhelming the file system
    // Batch size of 10 provides good balance between concurrency and resource usage
    const BATCH_SIZE = 10;
    
    const refreshFile = async (filePath) => {
      try {
        // Check if file still exists
        const stats = await fs.stat(filePath);
        const content = await this.readFileContent(filePath, stats);
        
        // Update metadata (keep original creation time, remove stale flag)
        this.metadata.files[filePath] = {
          created: this.metadata.files[filePath].created, // Preserve original
          summary: this.generateSummary(content, filePath),
          tags: this.generateTags(content, filePath),
        };
        
        updatedCount++;
      } catch (error) {
        // File no longer exists or is inaccessible
        console.error(`Failed to refresh ${filePath}:`, error.message);
        errorCount++;
        
        // Mark file as stale (metadata may be outdated)
        this.metadata.files[filePath].stale = true;
        this.metadata.files[filePath].staleReason = error.message;
        staleCount++;
      }
    };
    
    // Process files in batches for better performance
    for (let i = 0; i < existingFiles.length; i += BATCH_SIZE) {
      const batch = existingFiles.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(refreshFile));
    }
    
    // Save updated metadata
    await this.saveMetadata();
    
    const message = staleCount > 0
      ? `Metadata refresh complete. Updated ${updatedCount} files, ${staleCount} marked stale (${errorCount} errors).`
      : `Metadata refresh complete. Updated ${updatedCount} files, ${errorCount} errors.`;
    
    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
    };
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      if (this.watcher) {
        await this.watcher.close();
      }
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    await this.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('Timepon MCP server running');
  }
}

const server = new TimeponServer();
server.run().catch(console.error);
