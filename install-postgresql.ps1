# Script cài PostgreSQL (Chạy as Administrator)
Write-Host "=== Cài đặt PostgreSQL ===" -ForegroundColor Cyan

$installerPath = "$env:TEMP\postgresql-installer.exe"

if (-Not (Test-Path $installerPath)) {
    Write-Host "Đang tải PostgreSQL..." -ForegroundColor Yellow
    curl.exe -L -o $installerPath "https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64.exe"
    Write-Host "✅ Đã tải xong!" -ForegroundColor Green
}

Write-Host "`nĐang cài đặt PostgreSQL..." -ForegroundColor Yellow
Write-Host "Mật khẩu mặc định: postgres" -ForegroundColor Cyan
Write-Host "Port: 5432" -ForegroundColor Cyan

# Cài đặt tự động
Start-Process -FilePath $installerPath -ArgumentList "--mode unattended --superpassword postgres --serverport 5432" -Wait -NoNewWindow

Write-Host "`n✅ Cài đặt hoàn tất!" -ForegroundColor Green
Write-Host "`n📝 Thông tin kết nối:" -ForegroundColor Cyan
Write-Host "  User: postgres" -ForegroundColor White
Write-Host "  Password: postgres" -ForegroundColor White
Write-Host "  Port: 5432" -ForegroundColor White
Write-Host "  Database: (chưa tạo)" -ForegroundColor White

Write-Host "`n🔧 Tiếp theo:" -ForegroundColor Yellow
Write-Host "1. Chờ vài giây để PostgreSQL khởi động" -ForegroundColor White
Write-Host "2. Chạy: .\create-database.ps1" -ForegroundColor White

# Thêm PostgreSQL vào PATH
$pgPath = "C:\Program Files\PostgreSQL\16\bin"
if (Test-Path $pgPath) {
    $env:Path += ";$pgPath"
    Write-Host "`n✅ Đã thêm PostgreSQL vào PATH" -ForegroundColor Green
}

pause
