# 🚀 HƯỚNG DẪN KHỞI ĐỘNG SERVER

## ⚡ CÁCH NHANH NHẤT

### Bước 1: Khởi động Redis
**MỞ TERMINAL MỚI** và chạy:
```powershell
redis-server
```
> ⚠️ Để terminal này mở, KHÔNG đóng!

### Bước 2: Kiểm tra dịch vụ (Optional)
Đúp chuột file: **`check-services.bat`**

### Bước 3: Khởi động server
**Đúp chuột file: `start.bat`**

Hoặc chạy PM2 trực tiếp:
```powershell
pm2 start ecosystem.config.js
pm2 logs
```

---

## 🎮 TRUY CẬP GAME

Server chạy tại:
- **Máy này**: http://localhost:3000
- **Máy khác**: http://10.216.72.91:3000

---

## 🔧 QUẢN LÝ

### Restart
```powershell
pm2 restart sudoku-server
```
Hoặc đúp chuột: **`restart.bat`**

### Stop
```powershell
pm2 stop sudoku-server
pm2 delete sudoku-server
```
Hoặc đúp chuột: **`stop.bat`**

### Xem logs
```powershell
pm2 logs sudoku-server
```

### Check health
```powershell
curl http://localhost:3000/health
```

---

## ❗ LỖI THƯỜNG GẶP

### "Unable to connect" / Server không start

**Nguyên nhân**: Redis chưa chạy

**Giải pháp**:
1. Mở PowerShell/CMD mới
2. Chạy: `redis-server`
3. Giữ terminal đó mở
4. Restart server: `pm2 restart sudoku-server`

### "Port 3000 already in use"

**Giải pháp**:
```powershell
# Tìm process
netstat -ano | findstr :3000

# Kill process (thay <PID>)
taskkill /F /PID <PID>
```

### PostgreSQL không chạy

**Giải pháp**:
```powershell
net start postgresql-x64-16
```

Hoặc mở **pgAdmin** để start tự động.

---

## 📁 CÁC FILE QUAN TRỌNG

- **`start.bat`**: Khởi động server (tự check dependencies)
- **`stop.bat`**: Dừng server
- **`restart.bat`**: Restart server
- **`check-services.bat`**: Kiểm tra PostgreSQL, Redis, PM2

---

## 🎯 QUY TRÌNH CHUẨN

```
1. Terminal 1: redis-server          (giữ mở)
2. Terminal 2: pm2 start ... 
3. Trình duyệt: http://localhost:3000
```

---

**Chúc vui vẻ! 🎮🔥**
