# PM2 Startup Script
# Để PM2 tự động chạy khi Windows khởi động

# 1. Tạo startup script
pm2 startup

# 2. Sau khi start app, save để tự động chạy lại
pm2 save

Write-Host "PM2 startup script created!" -ForegroundColor Green
Write-Host "Server se tu dong chay khi Windows khoi dong lai" -ForegroundColor Cyan
