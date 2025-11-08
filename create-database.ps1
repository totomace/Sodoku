# Script tạo database sudoku_game
Write-Host "=== Tạo Database ===" -ForegroundColor Cyan

# Thêm PostgreSQL vào PATH tạm thời
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"
$env:PGPASSWORD = "postgres"

Write-Host "Đang tạo database sudoku_game..." -ForegroundColor Yellow

# Tạo database
& psql -U postgres -c "CREATE DATABASE sudoku_game;"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Đã tạo database thành công!" -ForegroundColor Green
    
    Write-Host "`n📊 Kiểm tra kết nối:" -ForegroundColor Cyan
    & psql -U postgres -d sudoku_game -c "SELECT version();"
    
    Write-Host "`n✅ PostgreSQL đã sẵn sàng!" -ForegroundColor Green
    Write-Host "`n🚀 Tiếp theo:" -ForegroundColor Yellow
    Write-Host "1. Chạy: .\enable-postgres.ps1" -ForegroundColor White
    Write-Host "2. Server sẽ tự động migrate dữ liệu từ JSON" -ForegroundColor White
} else {
    Write-Host "❌ Lỗi tạo database!" -ForegroundColor Red
    Write-Host "Database có thể đã tồn tại. Thử kết nối..." -ForegroundColor Yellow
    & psql -U postgres -l
}

pause
