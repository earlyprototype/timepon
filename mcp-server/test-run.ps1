# Test Timepon MCP Server
# This script manually tests the server functionality

Write-Host "Timepon MCP Server Test" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""

$serverPath = Split-Path $PSScriptRoot -Parent
$env:TIMEPON_WORKSPACE = $serverPath

Write-Host "Workspace: $env:TIMEPON_WORKSPACE" -ForegroundColor Yellow
Write-Host ""

Write-Host "Starting server in test mode..." -ForegroundColor Green
Write-Host "The server will watch for file changes. Create some test files to see it work." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

# Run the server
node "$PSScriptRoot\index.js"
