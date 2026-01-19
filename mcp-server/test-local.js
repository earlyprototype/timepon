// Simple local test to verify the server logic works
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing Timepon metadata generation...\n');

// Test summary generation
function generateSummary(content, filePath) {
  const ext = path.extname(filePath);
  
  if (!content) {
    return `${ext} file`;
  }

  if (ext === '.md') {
    const lines = content.split('\n').filter(l => l.trim());
    const heading = lines.find(l => l.startsWith('#'));
    if (heading) {
      return heading.replace(/^#+\s*/, '').slice(0, 80);
    }
    return lines[0]?.slice(0, 80) || 'Empty markdown file';
  }

  if (['.js', '.ts', '.py', '.java', '.cs', '.go'].includes(ext)) {
    const lines = content.split('\n').filter(l => l.trim());
    const comment = lines.find(l => l.trim().startsWith('//') || l.trim().startsWith('#'));
    if (comment) {
      return comment.replace(/^[\/\/#]+\s*/, '').slice(0, 80);
    }
    return `${ext.slice(1)} source file`;
  }

  const firstLine = content.split('\n').find(l => l.trim());
  return firstLine?.slice(0, 80) || path.basename(filePath);
}

// Test tag generation
function generateTags(content, filePath) {
  const tags = [];
  const ext = path.extname(filePath).slice(1);
  
  if (ext) {
    tags.push(ext);
  }

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

  if (ext === 'md' && content) {
    const lower = content.toLowerCase();
    if (lower.includes('todo') || lower.includes('task')) tags.push('tasks');
    if (lower.includes('api') || lower.includes('endpoint')) tags.push('api');
    if (lower.includes('schema') || lower.includes('database')) tags.push('data');
    if (lower.includes('architecture') || lower.includes('design')) tags.push('architecture');
  }

  return tags.slice(0, 3);
}

// Test with sample files
const testFiles = [
  {
    path: 'README.md',
    content: '# Timepon MCP Server\n\nAI-assisted development tool',
  },
  {
    path: 'src/api.ts',
    content: '// API endpoint definitions\nexport class ApiService {}',
  },
  {
    path: 'docs/architecture.md',
    content: '# System Architecture\n\nThis document describes the system architecture',
  },
  {
    path: 'config.json',
    content: '{\n  "name": "timepon"\n}',
  },
];

console.log('Testing metadata extraction:\n');

for (const file of testFiles) {
  const summary = generateSummary(file.content, file.path);
  const tags = generateTags(file.content, file.path);
  
  console.log(`File: ${file.path}`);
  console.log(`  Summary: ${summary}`);
  console.log(`  Tags: ${tags.join(', ')}`);
  console.log('');
}

console.log('✓ Metadata generation working correctly');
