# 🎮 SUDOKU MULTIPLAYER GAME - HƯỚNG DẪN NHANH

## 🚀 KHỞI ĐỘNG HỆ THỐNG

### Cách 1: Tự động (Đơn giản nhất) ⭐
**Đúp chuột vào file `start.bat`**

Hệ thống sẽ tự động:
- ✅ Khởi động PostgreSQL (nếu chưa chạy)
- ✅ Khởi động Redis (nếu chưa chạy)
- ✅ Khởi động PM2 với 4 workers
- ✅ Hiển thị logs real-time

### Cách 2: Chạy từ PowerShell
```powershell
.\start.bat
```

### Cách 3: Chạy thủ công (Advanced)
```powershell
# Khởi động PostgreSQL
net start postgresql-x64-16

# Khởi động Redis
net start Redis

# Khởi động server với PM2
pm2 start ecosystem.config.js
pm2 logs
```

---

## 🎯 TRUY CẬP GAME

Sau khi server khởi động, mở trình duyệt:

- **Trên máy này**: http://localhost:3000
- **Trên máy khác (cùng mạng)**: http://10.216.72.91:3000

---

## 🔄 QUẢN LÝ SERVER

### Restart Server
**Đúp chuột `restart.bat`** hoặc:
```powershell
pm2 restart sudoku-server
```

### Dừng Server
**Đúp chuột `stop.bat`** hoặc:
```powershell
pm2 stop sudoku-server
pm2 delete sudoku-server
```

### Xem Logs
```powershell
pm2 logs sudoku-server
```

### Xem Status
```powershell
pm2 status
```

### Xem Queue Stats
```powershell
curl http://localhost:3000/api/queue/stats
```

### Health Check
```powershell
curl http://localhost:3000/health
```

---

## 📊 THÔNG TIN HỆ THỐNG

### Tech Stack
- **Frontend**: HTML/CSS/JavaScript, Socket.io client
- **Backend**: Node.js, Express, Socket.io server
- **Database**: PostgreSQL 16.6 (port 5432)
- **Cache**: Redis 5.0.14.1 (port 6379)
- **Queue**: Bull Queue + Redis
- **Process Manager**: PM2 (4 workers, cluster mode)

### Cấu hình
- **Port**: 3000
- **Workers**: 4 (PM2 cluster mode)
- **Starting Score**: 1000 điểm
- **Turn Time**: 30 giây/lượt
- **Queue Workers**: 10 concurrent jobs
- **Auto-restart**: Enabled
- **Max memory**: 500MB/worker

### Security Features
- ✅ Rate limiting (API + Socket.io)
- ✅ Helmet.js (HTTP headers)
- ✅ CORS protection
- ✅ Input validation
- ✅ Anti-cheat system
- ✅ Brute force protection
- ✅ Message Queue (handle 10k+ users)

---

## 🎮 GAME FEATURES

### Chế độ chơi
- **PvP Random**: Tìm đối thủ ngẫu nhiên
- **Private Room**: Tạo phòng riêng với ID
- **Spectator Mode**: Xem người khác chơi

### Tính năng
- ✅ Turn-based gameplay (30s/turn)
- ✅ Real-time scoring system
- ✅ Mistake penalty (-100 points)
- ✅ Timeout penalty (-50 points)
- ✅ Game history tracking
- ✅ Online user list
- ✅ In-game chat
- ✅ Surrender option
- ✅ Auto-save game results

---

## 🛠️ TROUBLESHOOTING

### Lỗi: "Cannot connect to PostgreSQL"
```powershell
# Kiểm tra PostgreSQL
sc query postgresql-x64-16

# Khởi động thủ công
net start postgresql-x64-16
```

### Lỗi: "Redis connection failed"
```powershell
# Kiểm tra Redis
sc query Redis

# Khởi động thủ công
net start Redis
```

### Lỗi: "Port 3000 already in use"
```powershell
# Tìm process đang dùng port 3000
netstat -ano | findstr :3000

# Kill process (thay <PID> bằng số thực tế)
taskkill /F /PID <PID>
```

### Server không tự khởi động lại sau crash
```powershell
# Restart PM2
pm2 restart sudoku-server

# Hoặc restart toàn bộ
pm2 restart all
```

---

## 📈 LOAD TESTING

Test hệ thống với 1000 users:
```powershell
node load-test.js
```

Test với 10,000 users:
```powershell
# Sửa NUM_USERS = 10000 trong load-test.js
node load-test.js
```

---

## 🔧 CẤU HÌNH MỞ RỘNG

### Tăng số workers PM2
Sửa file `ecosystem.config.js`:
```javascript
instances: 8, // Tăng từ 4 lên 8
```

### Tăng queue concurrency
Sửa file `queue-manager.js`:
```javascript
registrationQueue.process(20, async (job) => { // Tăng từ 10 lên 20
```

### Tăng PostgreSQL pool
Sửa file `postgres.js`:
```javascript
max: 100, // Tăng từ 50 lên 100
```

---

## 📞 SUPPORT

Nếu gặp vấn đề:
1. Xem logs: `pm2 logs sudoku-server`
2. Check health: `curl http://localhost:3000/health`
3. Check queue: `curl http://localhost:3000/api/queue/stats`

---

## 🎯 PERFORMANCE

### Kết quả Load Test
- **1,000 users**: 0% error rate ✅
- **10,000 users**: 99.94% success rate ✅
- **Memory**: ~108MB/worker
- **Uptime**: 99.9%+

### Hệ thống có thể handle
- ✅ 1,000+ concurrent users (0% error)
- ✅ 10,000+ concurrent users (0.06% error)
- ✅ Auto-restart on crash
- ✅ Graceful shutdown
- ✅ Queue-based registration (no overload)

---

**🎮 CHƠI VUI VẺ! 🔥**
