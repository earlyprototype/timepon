# Timepon MCP Server - Workspace Installer
# This script installs Timepon to the current workspace

param(
    [string]$WorkspacePath = (Get-Location).Path
)

Write-Host "======================================"
Write-Host "Timepon Workspace Installer"
Write-Host "======================================"
Write-Host ""

# Validate workspace path
if (-not (Test-Path $WorkspacePath)) {
    Write-Host "ERROR: Workspace path does not exist: $WorkspacePath" -ForegroundColor Red
    exit 1
}

Write-Host "Workspace: $WorkspacePath" -ForegroundColor Cyan
Write-Host ""

# Path to the Timepon server
$timeponServerPath = Join-Path $PSScriptRoot "index.js"
if (-not (Test-Path $timeponServerPath)) {
    Write-Host "ERROR: Timepon server not found at: $timeponServerPath" -ForegroundColor Red
    exit 1
}

# Create .cursor directory in workspace if it doesn't exist
$cursorDir = Join-Path $WorkspacePath ".cursor"
if (-not (Test-Path $cursorDir)) {
    New-Item -ItemType Directory -Path $cursorDir | Out-Null
    Write-Host "Created .cursor directory" -ForegroundColor Green
}

# Create or update workspace mcp.json
$mcpConfigPath = Join-Path $cursorDir "mcp.json"
$mcpConfig = @{
    mcpServers = @{
        timepon = @{
            command = "node"
            args = @($timeponServerPath)
            env = @{
                TIMEPON_WORKSPACE = $WorkspacePath
            }
        }
    }
}

# If config exists, merge with existing
if (Test-Path $mcpConfigPath) {
    Write-Host "Updating existing mcp.json..." -ForegroundColor Yellow
    $existing = Get-Content $mcpConfigPath -Raw | ConvertFrom-Json
    
    # Add timepon to existing servers
    if (-not $existing.mcpServers) {
        $existing | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value @{}
    }
    $existing.mcpServers | Add-Member -MemberType NoteProperty -Name "timepon" -Value $mcpConfig.mcpServers.timepon -Force
    
    $existing | ConvertTo-Json -Depth 10 | Set-Content $mcpConfigPath
} else {
    Write-Host "Creating new mcp.json..." -ForegroundColor Green
    $mcpConfig | ConvertTo-Json -Depth 10 | Set-Content $mcpConfigPath
}

Write-Host ""
Write-Host "SUCCESS: Timepon installed to workspace!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart Cursor" -ForegroundColor White
Write-Host "2. Timepon will start tracking files in this workspace" -ForegroundColor White
Write-Host "3. Check _timepon.yaml for tracked files" -ForegroundColor White
Write-Host ""
Write-Host "Config file: $mcpConfigPath" -ForegroundColor Gray
