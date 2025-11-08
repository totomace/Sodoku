# Script để reset mật khẩu PostgreSQL
Write-Host "=== Reset PostgreSQL Password ===" -ForegroundColor Cyan

# Tìm file pg_hba.conf
$pgDataPath = "C:\Program Files\PostgreSQL\16\data"
$pgHbaFile = Join-Path $pgDataPath "pg_hba.conf"

Write-Host "`n1. Backup file pg_hba.conf..." -ForegroundColor Yellow
Copy-Item $pgHbaFile "$pgHbaFile.backup" -Force

Write-Host "2. Sửa pg_hba.conf để tạm thời cho phép kết nối không cần mật khẩu..." -ForegroundColor Yellow
$content = Get-Content $pgHbaFile
$newContent = $content -replace "md5", "trust" -replace "scram-sha-256", "trust"
$newContent | Set-Content $pgHbaFile

Write-Host "3. Restart PostgreSQL service..." -ForegroundColor Yellow
Restart-Service postgresql-x64-16

Start-Sleep -Seconds 3

Write-Host "4. Đặt mật khẩu mới là '12345'..." -ForegroundColor Yellow
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -U postgres -c "ALTER USER postgres WITH PASSWORD '12345';"

Write-Host "5. Khôi phục lại file pg_hba.conf..." -ForegroundColor Yellow
Copy-Item "$pgHbaFile.backup" $pgHbaFile -Force

Write-Host "6. Restart PostgreSQL service lần cuối..." -ForegroundColor Yellow
Restart-Service postgresql-x64-16

Start-Sleep -Seconds 3

Write-Host "`n=== Hoàn tất! Mật khẩu đã được đặt thành '12345' ===" -ForegroundColor Green
Write-Host "Test kết nối: " -NoNewline
$env:PGPASSWORD="12345"
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -U postgres -c "SELECT 'OK' as status;"
