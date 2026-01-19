# Timepon Quick Start

Get up and running in 5 minutes.

## Checklist

### 1. Dependencies Installed
- [x] Already done - npm packages installed

### 2. Configure Cursor

**Option A: Run the helper script**
```powershell
cd "C:\Users\Fab2\Desktop\AI\_timecop\mcp-server"
powershell -ExecutionPolicy Bypass -File setup-config.ps1
```

**Option B: Manual configuration**

Add this to your Cursor MCP settings file:

Location: `C:\Users\Fab2\AppData\Roaming\Cursor\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`

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

### 3. Restart Cursor
Close and reopen Cursor completely.

### 4. Test It
Ask the AI in Cursor:
```
Use timepon to show me all files
```

Or:
```
What files were created in the last hour using timepon?
```

### 5. Check the YAML
Open `_timepon.yaml` in your workspace root to see the file tree.

## What You Get

**5 MCP Tools:**
1. `get_all_files` - List everything
2. `get_files_by_tag` - Filter by tag
3. `get_recent_files` - Filter by time
4. `search_files` - Text search
5. `refresh_metadata` - Force rescan

**1 YAML File:**
- `_timepon.yaml` - Human-readable file tree with metadata

## Customization (Optional)

The server automatically ignores common folders (node_modules, .git, etc.) by reading:
- `.tponignore` - Project-specific ignore patterns (created by default)
- `.gitignore` - Your existing git ignore patterns

To customize what's tracked, edit `.tponignore` in your project root using standard gitignore syntax.

## Troubleshooting

**Server not starting?**
- Check Cursor Output panel for errors
- Verify Node.js in PATH: `node --version`
- Check configuration file for typos

**Files not tracked?**
- Ensure workspace path is correct
- Check file isn't in ignored directory (see `.tponignore`)
- Try `refresh_metadata` tool

**Too many files tracked?**
- Add patterns to `.tponignore` to exclude folders/files
- Restart Cursor to reload ignore patterns

## Documentation

- **Full Setup:** See `SETUP.md`
- **Technical Details:** See `mcp-server/README.md`
- **Main README:** See `README.md`

---

**That's it. You're done. The pebble on the beach in Co. Down would be proud.**
