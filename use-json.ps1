# Script để quay lại JSON mode
$env:DB_TYPE = "json"

Write-Host "✅ Đã chuyển về JSON mode" -ForegroundColor Green
Write-Host "Khởi động lại server..." -ForegroundColor Yellow

pm2 restart sudoku-server --update-env

Write-Host "`n📁 Đang sử dụng db.json để lưu trữ" -ForegroundColor Cyan
