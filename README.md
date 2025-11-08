# 🎮 SUDOKU MULTIPLAYER - QUICK START

## 🚀 Chạy Server (1 lệnh)

```bash
npm start
```

Lệnh này sẽ tự động:
1. ✅ Check PostgreSQL → Tự động khởi động nếu cần
2. ✅ Check Redis → Báo lỗi nếu chưa chạy
3. ✅ Start PM2 (4 workers)
4. ✅ Hiện logs real-time

---

## ⚡ Nếu lỗi Redis

### Cách 1: Terminal riêng
```powershell
redis-server
```
Giữ terminal mở, rồi chạy lại `npm start`

### Cách 2: File .bat
Đúp chuột: **`start-redis.bat`**

---

## 🎯 Các lệnh khác

```bash
npm run logs      # Xem logs
npm run restart   # Restart server
npm run stop      # Dừng server
```

---

## 🌐 Truy cập

- **Máy này**: http://localhost:3000
- **Máy khác**: http://10.216.72.91:3000

---

**Chúc vui vẻ! 🔥**
