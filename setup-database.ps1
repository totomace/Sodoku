# Script chạy file SQL
Write-Host "=== Tạo Database và Tables ===" -ForegroundColor Cyan

# Thêm PostgreSQL vào PATH
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"

# Nhập mật khẩu
$password = Read-Host "Nhập mật khẩu PostgreSQL" -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

Write-Host "Đang chạy setup.sql..." -ForegroundColor Yellow

# Chạy file SQL
& psql -U postgres -f "database\setup.sql"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Setup hoàn tất!" -ForegroundColor Green
    Write-Host "`n🚀 Tiếp theo:" -ForegroundColor Yellow
    Write-Host "1. Cập nhật mật khẩu trong file .env" -ForegroundColor White
    Write-Host "2. Chạy: .\enable-postgres.ps1" -ForegroundColor White
} else {
    Write-Host "`n❌ Có lỗi xảy ra!" -ForegroundColor Red
}

pause
