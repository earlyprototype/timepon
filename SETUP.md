# Timepon Setup Guide

Complete guide for setting up the Timepon MCP server in Cursor.

## Prerequisites

- Node.js installed (v18 or higher)
- Cursor IDE
- PowerShell (Windows)

## Step 1: Install Dependencies

```powershell
cd "C:\Users\Fab2\Desktop\AI\_timecop\mcp-server"
npm install
```

This installs:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `chokidar` - Cross-platform file watcher
- `yaml` - YAML parser/serializer

## Step 2: Configure Cursor

You need to add the Timepon server to your Cursor MCP settings.

### Option A: Automatic Configuration (Recommended)

Run the configuration helper:

```powershell
cd "C:\Users\Fab2\Desktop\AI\_timecop\mcp-server"
powershell -ExecutionPolicy Bypass -File setup-config.ps1
```

This will detect your Cursor settings location and provide the configuration JSON.

### Option B: Manual Configuration

1. Find your Cursor MCP settings file. It's usually at one of these locations:
   - `C:\Users\Fab2\AppData\Roaming\Cursor\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`
   - Or search for `cline_mcp_settings.json` in your Cursor AppData

2. Open the file (or create it if it doesn't exist)

3. Add the timepon server to the `mcpServers` object:

```json
{
  "mcpServers": {
    "timepon": {
      "command": "node",
      "args": ["C:\\Users\\Fab2\\Desktop\\AI\\_timecop\\mcp-server\\index.js"],
      "env": {
        "TIMEPON_WORKSPACE": "C:\\Users\\Fab2\\Desktop\\AI\\_timecop"
      }
    }
  }
}
```

**Important Notes:**
- Use double backslashes (`\\`) in Windows paths
- Adjust the paths if your workspace is in a different location
- If you already have other MCP servers configured, add timepon alongside them

Example with multiple servers:

```json
{
  "mcpServers": {
    "timepon": {
      "command": "node",
      "args": ["C:\\Users\\Fab2\\Desktop\\AI\\_timecop\\mcp-server\\index.js"],
      "env": {
        "TIMEPON_WORKSPACE": "C:\\Users\\Fab2\\Desktop\\AI\\_timecop"
      }
    },
    "another-server": {
      "command": "node",
      "args": ["path\\to\\another\\server.js"]
    }
  }
}
```

## Step 3: Restart Cursor

Close and reopen Cursor completely. The Timepon server will start automatically in the background.

## Step 4: Verify It's Working

### Check Server Status

1. Open Cursor's Output panel:
   - Press `Ctrl+Shift+P` (Command Palette)
   - Type "Output: Show Output Channels"
   - Look for MCP-related logs

2. You should see messages like:
   ```
   Timepon MCP server started. Watching: C:\Users\Fab2\Desktop\AI\_timecop
   File watcher initialized
   ```

### Test with AI

Ask the AI in Cursor:

```
Use the timepon tools to show me all files
```

Or:

```
What files were created in the last hour?
```

The AI should use the `get_all_files` or `get_recent_files` tools to respond.

### Check the YAML

Open `_timepon.yaml` in your workspace root. It should contain a file tree structure:

```yaml
workspace: C:\Users\Fab2\Desktop\AI\_timecop
lastUpdated: '2026-01-18T03:30:00.000Z'
files:
  README.md:
    created: '2026-01-18T02:30:15.000Z'
    summary: 'Timepon Setup Guide'
    tags:
      - md
      - docs
```

## Available Commands

Once configured, the AI can use these tools:

### `get_all_files`
List all tracked files with metadata

Example: "Show me all tracked files"

### `get_files_by_tag`
Filter by tag (md, js, docs, code, config, api, data, etc.)

Example: "Show me all markdown files" or "Find files tagged with 'api'"

### `get_recent_files`
Get files created within a time period

Example: "What files were created in the last 2 hours?"

### `search_files`
Search by filename or summary content

Example: "Search for schema-related files"

### `refresh_metadata`
Force rescan of the workspace

Example: "Refresh the file tracking data"

## Troubleshooting

### Server Not Starting

**Symptom:** No files being tracked, AI says timepon tools don't exist

**Solutions:**
1. Check the MCP settings file path is correct
2. Verify Node.js is in your PATH: `node --version`
3. Check for typos in the configuration JSON
4. Look at Cursor's Output panel for error messages
5. Restart Cursor completely (not just reload window)

### Files Not Being Tracked

**Symptom:** YAML file is empty or missing files

**Possible causes:**
- File is in an ignored directory (`node_modules`, `.git`, etc.)
- File is binary (images, executables, etc.)
- File is too large (>1MB)
- Wrong workspace path in configuration

**Solutions:**
1. Check the `TIMEPON_WORKSPACE` environment variable points to the correct location
2. Verify the file is a text file
3. Check file size
4. Use the `refresh_metadata` tool to force rescan

### Wrong Workspace

**Symptom:** Tracking files from the wrong directory

**Solution:**
Update the `TIMEPON_WORKSPACE` env var in your MCP settings:

```json
"env": {
  "TIMEPON_WORKSPACE": "C:\\Path\\To\\Your\\Actual\\Workspace"
}
```

### Permission Errors

**Symptom:** Error messages about file access

**Solution:**
Ensure Cursor/Node.js has permission to:
- Read files in your workspace
- Write to `_timepon.yaml`
- Watch for file system changes

## Advanced Configuration

### Ignore Additional Directories

To ignore more directories, edit `index.js` and add patterns to `ignoredPatterns`:

```javascript
const ignoredPatterns = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.cursor/**',
  '**/dist/**',
  '**/build/**',
  '**/_timepon.yaml',
  '**/mcp-server/**',
  '**/YOUR_CUSTOM_PATTERN/**', // Add here
];
```

### Change Metadata Location

To store `_timepon.yaml` elsewhere, modify the `yamlPath` in `index.js`:

```javascript
this.yamlPath = path.join(this.workspaceRoot, 'custom-folder', 'metadata.yaml');
```

### Adjust File Size Limit

To track larger files, change the size check in `readFileContent()`:

```javascript
// Current: Skip files >1MB
if (stats.size > 1024 * 1024) {
  return '';
}

// Change to 5MB:
if (stats.size > 5 * 1024 * 1024) {
  return '';
}
```

## Uninstalling

1. Remove the `timepon` entry from your Cursor MCP settings
2. Restart Cursor
3. Delete the `mcp-server` folder
4. Delete `_timepon.yaml` from your workspace

## Support

If you encounter issues:
1. Check this troubleshooting guide
2. Review the logs in Cursor's Output panel
3. Verify your configuration matches the examples
4. Ensure all paths use double backslashes on Windows
