# PM2 - Process Manager cho Production

## Tại sao dùng PM2?

✅ **Tự động restart** khi server crash
✅ **Cluster mode** - chạy nhiều workers tự động
✅ **Zero-downtime reload** - update code không downtime
✅ **Load balancing** tự động
✅ **Monitoring** CPU, RAM real-time
✅ **Log management** tự động
✅ **Startup script** - tự chạy khi reboot

## Cài đặt

```powershell
npm install -g pm2
```

## Khởi động Server

### Production Mode (4 workers)
```powershell
.\start-pm2.ps1
```

Hoặc:
```powershell
pm2 start ecosystem.config.js --env production
```

### Test Mode (nhiều connections)
```powershell
pm2 start ecosystem.config.js --env test
```

## Các Lệnh PM2 Quan Trọng

### 1. Quản lý Process
```powershell
# Xem status
pm2 status

# Xem logs real-time
pm2 logs sudoku-server

# Xem logs 100 dòng cuối
pm2 logs sudoku-server --lines 100

# Xem logs chỉ errors
pm2 logs sudoku-server --err

# Stop server
pm2 stop sudoku-server

# Restart server
pm2 restart sudoku-server

# Reload (zero-downtime)
pm2 reload sudoku-server

# Delete khỏi PM2
pm2 delete sudoku-server
```

### 2. Monitoring
```powershell
# Dashboard đẹp
pm2 monit

# Thông tin chi tiết
pm2 show sudoku-server

# List processes
pm2 list
```

### 3. Logs
```powershell
# Xem logs
pm2 logs

# Xóa logs cũ
pm2 flush

# Rotate logs (tạo file mới)
pm2 install pm2-logrotate
```

### 4. Startup (Tự động chạy khi reboot)
```powershell
# Tạo startup script
pm2 startup

# Lưu cấu hình hiện tại
pm2 save

# Xóa startup script
pm2 unstartup
```

## Cấu hình (ecosystem.config.js)

### Cluster Mode
```javascript
instances: 4,        // 4 workers
exec_mode: 'cluster' // Cluster mode
```

### Auto Restart Settings
```javascript
autorestart: true,        // Tự động restart
max_restarts: 10,         // Max 10 lần/phút
min_uptime: '10s',        // Phải chạy 10s mới tính stable
restart_delay: 4000,      // Delay 4s trước khi restart
max_memory_restart: '500M' // Restart nếu RAM > 500MB
```

### Logging
```javascript
error_file: './logs/pm2-error.log',
out_file: './logs/pm2-out.log',
log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
merge_logs: true
```

## So sánh: Manual Cluster vs PM2

### Manual Cluster (cluster.js)
❌ Phải tự code restart logic
❌ Không có monitoring
❌ Không có log management
❌ Không có zero-downtime reload
❌ Khó debug khi có lỗi

### PM2
✅ Tự động restart khi crash
✅ Built-in monitoring (`pm2 monit`)
✅ Log management tự động
✅ Zero-downtime reload (`pm2 reload`)
✅ Easy debugging với logs

## Production Best Practices

### 1. Khởi động Production
```powershell
# Stop tất cả node processes cũ
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Start với PM2
pm2 start ecosystem.config.js --env production

# Kiểm tra status
pm2 status

# Xem logs
pm2 logs sudoku-server --lines 50

# Save để tự động chạy khi reboot
pm2 save
```

### 2. Update Code (Zero Downtime)
```powershell
# Pull code mới từ git
git pull

# Reload tất cả workers (không downtime)
pm2 reload sudoku-server

# Hoặc restart (có 1-2s downtime)
pm2 restart sudoku-server
```

### 3. Monitoring
```powershell
# Dashboard
pm2 monit

# Web monitoring (optional)
pm2 install pm2-server-monit
```

### 4. Logs
```powershell
# Xem logs real-time
pm2 logs sudoku-server

# Xem logs errors
pm2 logs sudoku-server --err

# Flush logs cũ (khi quá lớn)
pm2 flush
```

## Xử lý Crash

### PM2 tự động xử lý:
1. Detect crash
2. Wait 4 seconds (restart_delay)
3. Restart worker
4. Nếu crash liên tục (<10s uptime), đợi lâu hơn
5. Max 10 restarts trong 1 phút

### Xem lý do crash:
```powershell
# Xem logs errors
pm2 logs sudoku-server --err --lines 100

# Xem thông tin chi tiết
pm2 show sudoku-server

# Xem số lần restart
pm2 list
```

## Load Testing với PM2

```powershell
# 1. Start server ở test mode
pm2 start ecosystem.config.js --env test

# 2. Run load test
node load-test.js

# 3. Monitor real-time
pm2 monit

# 4. Xem stats
curl http://localhost:3000/api/stats

# 5. Xem logs
pm2 logs sudoku-server
```

## Troubleshooting

### Server không start
```powershell
# Xem logs errors
pm2 logs sudoku-server --err

# Xem thông tin process
pm2 show sudoku-server

# Delete và start lại
pm2 delete sudoku-server
pm2 start ecosystem.config.js
```

### Server bị restart liên tục
```powershell
# Xem logs để tìm lỗi
pm2 logs sudoku-server --lines 200

# Kiểm tra RAM usage
pm2 monit

# Tăng max_memory_restart nếu cần
# Edit ecosystem.config.js, tăng từ 500M lên 1G
```

### Port đã được sử dụng
```powershell
# Tìm process đang dùng port 3000
$process = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess

# Kill process
Stop-Process -Id $process -Force

# Start lại PM2
pm2 restart sudoku-server
```

## Advanced Features

### 1. Memory Monitoring
```powershell
# Tự động restart khi RAM > 500MB
max_memory_restart: '500M'
```

### 2. CPU Monitoring
```powershell
pm2 monit
# Hiển thị CPU usage real-time
```

### 3. Log Rotation
```powershell
# Cài đặt log rotation
pm2 install pm2-logrotate

# Cấu hình
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

### 4. Notifications (optional)
```powershell
# Email notification khi crash
pm2 install pm2-notify
```

## Kết luận

**PM2 là PHẢI CÓ cho production!**

- ✅ Server crash? PM2 tự restart
- ✅ Update code? `pm2 reload` không downtime
- ✅ Monitor? `pm2 monit` real-time
- ✅ Logs? Tự động quản lý
- ✅ Reboot? Tự động start lại

**Không dùng PM2 = Server sập là CHẾT!** 💀
**Dùng PM2 = Server sập cũng TỰ ĐỘNG SỐNG LẠI!** 🚀
