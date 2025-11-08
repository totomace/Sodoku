# PM2 - Quick Reference

## 🚀 Khởi động Server

```powershell
# Production (4 workers)
pm2 start ecosystem.config.js --env production

# Hoặc dùng script
.\start-pm2.ps1

# Save để tự động chạy khi reboot
pm2 save
```

## 📊 Monitoring

```powershell
# Status tổng quan
pm2 status

# Dashboard đẹp (real-time CPU/RAM)
pm2 monit

# Logs real-time
pm2 logs sudoku-server

# Chi tiết 1 process
pm2 show sudoku-server
```

## 🔄 Quản lý Process

```powershell
# Restart (có downtime ~1s)
pm2 restart sudoku-server

# Reload (zero-downtime)
pm2 reload sudoku-server

# Stop
pm2 stop sudoku-server

# Delete
pm2 delete sudoku-server

# Restart tất cả
pm2 restart all
```

## 📝 Logs

```powershell
# Xem 50 dòng cuối
pm2 logs sudoku-server --lines 50

# Chỉ errors
pm2 logs sudoku-server --err

# Xóa logs cũ
pm2 flush
```

## ⚡ Tại sao PM2 tốt hơn cluster.js?

| Tính năng | cluster.js | PM2 |
|-----------|------------|-----|
| Tự động restart khi crash | ❌ Phải tự code | ✅ Built-in |
| Zero-downtime reload | ❌ Không có | ✅ `pm2 reload` |
| Monitoring | ❌ Không có | ✅ `pm2 monit` |
| Logs | ❌ Phải tự quản lý | ✅ Tự động |
| Load balancing | ❌ Thủ công | ✅ Tự động |
| Startup script | ❌ Không có | ✅ `pm2 save` |

## 🔥 Các tính năng tự động

✅ **Auto-restart**: Server crash → tự động restart sau 4s
✅ **Memory limit**: RAM > 500MB → tự restart
✅ **Max restarts**: Tối đa 10 lần/phút (tránh crash loop)
✅ **Min uptime**: Phải chạy 10s mới tính stable
✅ **Cluster mode**: 4 workers load balancing tự động
✅ **Log rotation**: Logs tự động xoay vòng

## 📈 Production Checklist

- [x] PM2 installed (`npm install -g pm2`)
- [x] ecosystem.config.js created
- [x] Server started (`pm2 start ecosystem.config.js`)
- [x] Saved configuration (`pm2 save`)
- [ ] Setup startup script (`pm2 startup`) - optional
- [ ] Configure log rotation (`pm2 install pm2-logrotate`) - optional

## 🆘 Troubleshooting

### Server không start
```powershell
pm2 logs sudoku-server --err --lines 100
```

### Server bị restart liên tục
```powershell
# Xem logs
pm2 logs sudoku-server --lines 200

# Kiểm tra RAM
pm2 monit
```

### Update code
```powershell
# Pull code mới
git pull

# Reload (không downtime)
pm2 reload sudoku-server
```

## 💡 Tips

- Dùng `pm2 monit` để xem real-time performance
- Dùng `pm2 reload` thay vì `restart` để không có downtime
- Check logs thường xuyên: `pm2 logs sudoku-server`
- Save sau khi start: `pm2 save` để tự động chạy khi reboot
