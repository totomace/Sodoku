# Script để bật PostgreSQL
$env:DB_TYPE = "postgres"

# Cấu hình PostgreSQL (thay đổi nếu cần)
# $env:PGUSER = "postgres"
# $env:PGPASSWORD = "your_password"
# $env:PGHOST = "localhost"
# $env:PGPORT = "5432"
# $env:PGDATABASE = "sudoku_game"

Write-Host "✅ Đã bật PostgreSQL mode" -ForegroundColor Green
Write-Host "Khởi động server..." -ForegroundColor Yellow

# Khởi động lại PM2 với environment mới
pm2 restart sudoku-server --update-env

Write-Host "`n💡 Nếu lỗi kết nối PostgreSQL:" -ForegroundColor Cyan
Write-Host "1. Cài PostgreSQL: https://www.postgresql.org/download/" -ForegroundColor White
Write-Host "2. Hoặc dùng PostgreSQL cloud miễn phí:" -ForegroundColor White  
Write-Host "   - Neon.tech (serverless): https://neon.tech" -ForegroundColor White
Write-Host "   - Supabase: https://supabase.com" -ForegroundColor White
Write-Host "   - Render: https://render.com`n" -ForegroundColor White
