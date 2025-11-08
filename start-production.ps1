# PowerShell Production Start Script
Write-Host "🚀 Starting Sudoku Game Server (Production Mode)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Kill existing processes
Write-Host "🔄 Stopping existing processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Start Redis if not running
$redisProcess = Get-Process redis-server -ErrorAction SilentlyContinue
if (!$redisProcess) {
    Write-Host "🔴 Starting Redis..." -ForegroundColor Red
    Start-Process -FilePath "$PSScriptRoot\redis\redis-server.exe" -WindowStyle Minimized
    Start-Sleep -Seconds 2
}

# Check PostgreSQL
Write-Host "🔍 Checking PostgreSQL..." -ForegroundColor Yellow
$pgService = Get-Service postgresql-x64-16 -ErrorAction SilentlyContinue
if (!$pgService -or $pgService.Status -ne 'Running') {
    Write-Host "❌ PostgreSQL is not running!" -ForegroundColor Red
    Write-Host "Please start PostgreSQL service first" -ForegroundColor Yellow
    exit 1
}

# Start server in cluster mode
Write-Host "🌐 Starting server in cluster mode..." -ForegroundColor Green
$env:NODE_ENV = "production"
node cluster.js

Write-Host "✅ Server started successfully!" -ForegroundColor Green
Write-Host "📊 Access: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🏥 Health check: http://localhost:3000/health" -ForegroundColor Cyan
