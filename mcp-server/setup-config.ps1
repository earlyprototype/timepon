# Timepon MCP Server Configuration Helper
# This script helps you configure the Timepon MCP server in Cursor

Write-Host "Timepon MCP Server Configuration Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get paths
$serverPath = (Get-Item $PSScriptRoot).FullName
$indexPath = Join-Path $serverPath "index.js"
$workspacePath = Split-Path $serverPath -Parent

Write-Host "Detected paths:" -ForegroundColor Yellow
Write-Host "  Server: $indexPath"
Write-Host "  Workspace: $workspacePath"
Write-Host ""

# Create MCP configuration JSON
$mcpConfig = @{
    timepon = @{
        command = "node"
        args = @($indexPath)
        env = @{
            TIMEPON_WORKSPACE = $workspacePath
        }
    }
}

$jsonConfig = $mcpConfig | ConvertTo-Json -Depth 10

Write-Host "MCP Configuration to add to Cursor:" -ForegroundColor Green
Write-Host ""
Write-Host $jsonConfig
Write-Host ""

# Try to find Cursor settings paths
$possiblePaths = @(
    "$env:APPDATA\Cursor\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json",
    "$env:APPDATA\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json"
)

$foundPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path (Split-Path $path -Parent)) {
        $foundPath = $path
        break
    }
}

if ($foundPath) {
    Write-Host "Found Cursor MCP settings location:" -ForegroundColor Yellow
    Write-Host "  $foundPath"
    Write-Host ""
    
    if (Test-Path $foundPath) {
        Write-Host "Settings file exists. You'll need to merge this config with existing settings." -ForegroundColor Yellow
    } else {
        Write-Host "Settings file doesn't exist yet. Creating it..." -ForegroundColor Yellow
        
        $fullConfig = @{
            mcpServers = $mcpConfig
        }
        
        $dir = Split-Path $foundPath -Parent
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        
        $fullConfig | ConvertTo-Json -Depth 10 | Set-Content $foundPath -Encoding UTF8
        Write-Host "Configuration file created!" -ForegroundColor Green
    }
} else {
    Write-Host "Could not locate Cursor MCP settings directory." -ForegroundColor Red
    Write-Host "Please manually add the configuration above to your Cursor MCP settings." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart Cursor to load the MCP server"
Write-Host "  2. Check the Output panel for MCP logs"
Write-Host "  3. Ask the AI to use timepon tools (e.g., 'Show me recent files')"
Write-Host ""
