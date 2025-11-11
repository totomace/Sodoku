# 🎮 Hệ thống Lượt Chơi (Turn-Based)

## 📋 Tổng quan

Sudoku là một trò chơi đố số trong đó người chơi phải điền các số từ 1 đến 9 vào một bảng 9×9, được chia thành 9 ô vuông con 3×3. Quy tắc là:

-Mỗi hàng chỉ chứa số 1–9 và không trùng lặp
-Mỗi cột chỉ chứa số 1–9 và không trùng lặp
-Mỗi ô vuông 3×3 cũng phải đủ số 1–9 và không được trùng nhau

Game Sudoku PvP giờ hoạt động theo hệ thống **lượt chơi** giống cờ vua:
- ⏱️ Mỗi người có đồng hồ riêng (600 giây = 10 phút)
- 🎯 Chỉ đồng hồ người đang chơi mới chạy
- 🔄 Sau mỗi nước đi, tự động chuyển lượt
- 💰 Điểm số cố định: 1000 điểm ban đầu

---

## 🎲 Luật chơi

### 1. Khởi đầu trận đấu
- **Player 1 đi trước** (người tạo/tìm trận trước)
- Cả 2 người đều có **1000 điểm** và **10 phút**
- Đồng hồ Player 1 bắt đầu chạy ngay

### 2. Trong lượt chơi
- ✅ **Người có lượt**: 
  - Có thể điền số vào ô trống
  - Đồng hồ của họ đang chạy (giảm dần)
  - Viền bảng điểm **phát sáng vàng** ⭐
  
- ⛔ **Người chờ lượt**:
  - Không thể điền số (sẽ báo lỗi)
  - Đồng hồ của họ dừng lại
  - Xem đối thủ đang làm gì

### 3. Chuyển lượt
Sau mỗi nước đi (điền 1 số):
- Tự động chuyển sang người kia
- Đồng hồ người trước **dừng**
- Đồng hồ người sau **chạy tiếp**

### 4. Điểm số
- **Bắt đầu**: 1000 điểm
- **Mỗi lần kiểm tra SAI**: -100 điểm
- **Về 0 điểm**: THUA ngay lập tức ❌

### 5. Cách thắng
Có 4 cách để thắng:
1. ✅ **Hoàn thành bảng đúng** trước đối thủ
2. ⏰ Đối thủ **hết thời gian**
3. 💰 Đối thủ **hết điểm** (về 0)
4. 🏳️ Đối thủ **đầu hàng**

---

## 🎨 Giao diện

### Bảng điểm hiển thị:
```
┌─────────────────────────────┐
│  ⭐ Bạn (Player1) [SÁNG]   │ ← Lượt của bạn
│  ⏰ 9:30                    │
│  💰 Điểm: 800               │
│  ❌ Sai: 2 lần              │
└─────────────────────────────┘

┌─────────────────────────────┐
│  Đối thủ (Player2)          │ ← Đang chờ
│  ⏰ 9:45                    │
│  💰 Điểm: 1000              │
│  ❌ Sai: 0 lần              │
└─────────────────────────────┘
```

### Thông báo chat:
- `🎮 Đến lượt bạn!` - Khi được chơi
- `⏸️ Đối thủ đang suy nghĩ...` - Khi chờ lượt
- `⏸️ Chưa đến lượt của bạn!` - Khi cố điền số sai lượt

---

## ⚙️ Cấu hình hệ thống

### Tham số trong `server.js`:
```javascript
const GAME_DURATION = 600;        // Thời gian mỗi người: 10 phút
const STARTING_SCORE = 1000;      // Điểm ban đầu
const PENALTY_PER_MISTAKE = 100;  // Mỗi lần sai trừ 100 điểm
```

---

## 💡 Chiến thuật chơi

### 1. Quản lý thời gian
- ⏱️ Đừng suy nghĩ quá lâu mỗi nước
- 🚀 Đi nhanh các ô dễ
- 🤔 Dành thời gian cho ô khó

### 2. Quản lý điểm
- ⚠️ **TRÁNH** kiểm tra khi chưa chắc chắn
- ✅ Chỉ kiểm tra khi **gần hoàn thành**
- 💀 Nhớ: Hết điểm = THUA ngay!

### 3. Chiến lược
- 👀 Quan sát đối thủ đang điền gì
- 🎯 Ưu tiên hoàn thành các vùng/hàng/cột
- 🧠 Giải thông minh, không vội vàng

---

## 🐛 Xử lý lỗi

### Nếu cố điền số sai lượt:
```
⏸️ Chưa đến lượt của bạn!
```

### Nếu hết thời gian:
```
⏰ [Tên] hết thời gian!
Người thắng: [Đối thủ]
```

### Nếu hết điểm:
```
💰 [Tên] đã hết điểm!
Người thắng: [Đối thủ]
```

---

## 🎯 Ví dụ một trận đấu

### Phút 1:
- P1 điền số → Chuyển lượt P2
- P2 điền số → Chuyển lượt P1
- P1 điền số → Chuyển lượt P2

### Phút 5:
- P1: 5:30 còn lại, 800 điểm (sai 2 lần)
- P2: 4:30 còn lại, 900 điểm (sai 1 lần)

### Phút 8:
- P1 hoàn thành bảng → Kiểm tra
- ✅ Đúng hết → **P1 THẮNG!**

---

## 📊 So sánh với chế độ cũ

| Tính năng | Chế độ cũ | Chế độ mới (Turn-Based) |
|-----------|-----------|-------------------------|
| Thời gian | Chung 10 phút | Riêng mỗi người 10 phút |
| Điền số | Tự do bất kỳ lúc nào | Chỉ khi đến lượt |
| Đồng hồ | Chạy liên tục | Chỉ chạy khi đến lượt |
| Chiến thuật | Tốc độ | Tốc độ + Tính toán |
| Công bằng | ✅ | ✅✅✅ |

---

## 🚀 Lợi ích

✅ **Công bằng hơn**: Mỗi người có thời gian riêng  
✅ **Chiến thuật cao hơn**: Phải suy nghĩ trước khi đi  
✅ **Ít gian lận**: Không thể spam điền số  
✅ **Giống game thật**: Như chơi cờ vua, cờ tướng  
✅ **Thú vị hơn**: Có áp lực khi đến lượt mình  

---

**Chúc bạn chơi vui vẻ! 🎮🏆**
