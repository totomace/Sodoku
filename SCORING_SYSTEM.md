# 🎮 Hệ thống tính điểm Sudoku PvP

## ⚙️ Cấu hình

- **Thời gian mỗi trận**: 600 giây (10 phút)
- **Điểm tối đa**: 1000 điểm
- **Điểm tối thiểu**: 100 điểm

## 📊 Công thức tính điểm

```
Điểm = MAX(100, Điểm_Thời_Gian - Phạt_Lỗi)
```

### 1. Điểm dựa trên thời gian
```
Điểm_Thời_Gian = 1000 - (Thời_gian_hoàn_thành * 2)
```

**Ví dụ:**
- Hoàn thành sau **50 giây** → 1000 - (50 × 2) = **900 điểm**
- Hoàn thành sau **200 giây** → 1000 - (200 × 2) = **600 điểm**
- Hoàn thành sau **450 giây** → 1000 - (450 × 2) = **100 điểm**

### 2. Phạt điểm cho lỗi sai
```
Phạt_Lỗi = Số_lần_kiểm_tra_sai × 50
```

**Ví dụ:**
- Kiểm tra sai **1 lần** → Trừ **50 điểm**
- Kiểm tra sai **3 lần** → Trừ **150 điểm**
- Kiểm tra sai **5 lần** → Trừ **250 điểm**

## 📈 Ví dụ thực tế

### Trường hợp 1: Người chơi giỏi
- Thời gian: 120 giây
- Số lần sai: 0
- **Điểm = 1000 - (120 × 2) - (0 × 50) = 760 điểm** ⭐⭐⭐

### Trường hợp 2: Người chơi trung bình
- Thời gian: 300 giây
- Số lần sai: 2
- **Điểm = 1000 - (300 × 2) - (2 × 50) = 300 điểm** ⭐⭐

### Trường hợp 3: Người chơi mới
- Thời gian: 480 giây
- Số lần sai: 5
- **Điểm = MAX(100, 1000 - 960 - 250) = 100 điểm** ⭐

## 🏆 Bảng xếp hạng

| Điểm | Xếp hạng |
|------|----------|
| 800+ | 🥇 Cao thủ |
| 600-799 | 🥈 Chuyên nghiệp |
| 400-599 | 🥉 Khá giỏi |
| 200-399 | ⭐ Trung bình |
| 100-199 | 🔰 Mới bắt đầu |

## 💾 Lưu trữ dữ liệu

Kết quả được lưu vào `db.json`:
```json
{
  "username": "player1",
  "mode": "PvP",
  "score": 760,
  "timeElapsed": 120,
  "mistakes": 0,
  "opponent": "player2",
  "date": "2025-11-06T10:30:00.000Z"
}
```

## 🎯 Mẹo để đạt điểm cao

1. **Tốc độ**: Hoàn thành càng nhanh càng tốt
2. **Chính xác**: Hạn chế kiểm tra sai
3. **Chiến lược**: Giải các ô dễ trước, khó sau
4. **Luyện tập**: Chơi nhiều để quen thuộc với pattern
