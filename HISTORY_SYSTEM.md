# 📊 Hệ thống Lưu Lịch Sử PvP

## ✅ Hoàn thành

Hệ thống lưu lịch sử đã được cập nhật đầy đủ cho chế độ PvP!

---

## 📝 Những gì được lưu

### Mỗi khi kết thúc trận đấu, hệ thống sẽ lưu cho **CẢ 2 NGƯỜI CHƠI**:

1. **Tên người chơi** (username)
2. **Chế độ chơi** (PvP)
3. **Điểm số** cuối cùng
4. **Số lần kiểm tra sai** (mistakes)
5. **Tên đối thủ** (opponent)
6. **Kết quả** (win/lose)
7. **Lý do** thắng/thua
8. **Thời gian** (date)

---

## 🏆 Các trường hợp lưu lịch sử

### 1. Hoàn thành bảng
```javascript
Người THẮNG:
- result: 'win'
- reason: 'Hoàn thành bảng'

Người THUA:
- result: 'lose'
- reason: 'Đối thủ hoàn thành trước'
```

### 2. Đối thủ hết điểm (về 0)
```javascript
Người THẮNG:
- result: 'win'
- reason: 'Đối thủ hết điểm'

Người THUA:
- result: 'lose'
- reason: 'Hết điểm'
- score: 0
```

### 3. Đối thủ hết thời gian
```javascript
Người THẮNG:
- result: 'win'
- reason: 'Đối thủ hết thời gian'

Người THUA:
- result: 'lose'
- reason: 'Hết thời gian'
```

### 4. Đầu hàng
```javascript
Người THẮNG:
- result: 'win'
- reason: 'Đối thủ đầu hàng'

Người THUA:
- result: 'lose'
- reason: 'Đầu hàng'
```

### 5. Thoát game / Ngắt kết nối
```javascript
Người THẮNG:
- result: 'win'
- reason: 'Đối thủ thoát game'

Người THUA:
- result: 'lose'
- reason: 'Thoát game'
```

---

## 📱 Giao diện hiển thị lịch sử

### File: `public/history.html`

Truy cập: `http://localhost:3000/history.html`

### Hiển thị:

```
╔════════════════════════════════════════════════╗
║         Lịch Sử Đấu                           ║
║         Lịch sử của: client01                 ║
╚════════════════════════════════════════════════╝

┌────────────────────────────────────────────────┐
│ 🏆 THẮNG vs client02                          │
│ - Hoàn thành bảng                             │
│ 06/11/2025, 15:30:45                          │
│ ❌ Sai: 2 lần                    800 điểm     │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ 💀 THUA vs client03                           │
│ - Hết điểm                                    │
│ 06/11/2025, 15:25:12                          │
│ ❌ Sai: 10 lần                   0 điểm       │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ Chơi đơn: Dễ                                  │
│ 04/11/2025, 08:31:48                          │
│                                     0 điểm     │
└────────────────────────────────────────────────┘
```

---

## 🎨 Màu sắc

- **🏆 THẮNG**: Màu xanh lá (`#28a745`)
- **💀 THUA**: Màu đỏ (`#dc3545`)
- **Chơi đơn**: Màu theo độ khó

---

## 📊 Cấu trúc dữ liệu trong `db.json`

```json
{
  "gameHistory": [
    {
      "username": "client01",
      "mode": "PvP",
      "score": 800,
      "mistakes": 2,
      "opponent": "client02",
      "result": "win",
      "reason": "Hoàn thành bảng",
      "date": "2025-11-06T15:30:45.123Z"
    },
    {
      "username": "client02",
      "mode": "PvP",
      "score": 900,
      "mistakes": 1,
      "opponent": "client01",
      "result": "lose",
      "reason": "Đối thủ hoàn thành trước",
      "date": "2025-11-06T15:30:45.123Z"
    }
  ]
}
```

---

## 🔧 File đã cập nhật

1. **`server.js`**
   - ✅ Lưu lịch sử khi hoàn thành bảng
   - ✅ Lưu lịch sử khi hết điểm
   - ✅ Lưu lịch sử khi hết thời gian
   - ✅ Lưu lịch sử khi đầu hàng
   - ✅ Lưu lịch sử khi ngắt kết nối
   - ✅ Lưu cho CẢ 2 người chơi

2. **`public/js/history.js`**
   - ✅ Hiển thị kết quả PvP (thắng/thua)
   - ✅ Hiển thị tên đối thủ
   - ✅ Hiển thị lý do thắng/thua
   - ✅ Hiển thị số lần sai
   - ✅ Màu sắc phân biệt thắng/thua

---

## 📈 Thống kê có thể làm thêm (tương lai)

- Tổng số trận đã chơi
- Tỷ lệ thắng/thua
- Điểm trung bình
- Đối thủ gặp nhiều nhất
- Cách thắng phổ biến nhất
- Bảng xếp hạng (leaderboard)

---

## 🎮 Cách xem lịch sử

1. Đăng nhập vào game
2. Từ menu chính, click **"Lịch Sử"**
3. Xem tất cả các trận đã chơi (cả đơn và PvP)
4. Trận mới nhất hiển thị ở trên cùng

---

## ✨ Tính năng nổi bật

✅ **Lưu cả 2 người**: Cả người thắng và thua đều có lịch sử  
✅ **Chi tiết đầy đủ**: Điểm, số lần sai, đối thủ, lý do  
✅ **Phân biệt rõ**: Màu xanh = thắng, đỏ = thua  
✅ **Thời gian thực**: Tự động lưu ngay khi kết thúc  
✅ **Không mất dữ liệu**: Lưu vào file `db.json`  

---

**Chúc bạn chơi vui và có nhiều chiến thắng! 🏆**
