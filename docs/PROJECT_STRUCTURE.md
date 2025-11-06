# 🎮 Sudoku PvP Game - Cấu trúc dự án

## 📁 Cấu trúc thư mục (MVC Pattern)

```
Sodoku/
├── 📂 src/                      # Source code chính
│   ├── 📂 config/              # Cấu hình
│   │   └── constants.js        # Các hằng số, config
│   │
│   ├── 📂 controllers/         # Controllers (xử lý logic)
│   │   ├── auth.controller.js  # Đăng ký, đăng nhập
│   │   └── game.controller.js  # Lưu game, lịch sử
│   │
│   ├── 📂 models/              # Models (data structures) - TODO
│   │   ├── User.js
│   │   └── Game.js
│   │
│   ├── 📂 routes/              # API Routes
│   │   └── api.routes.js       # Định nghĩa các endpoint
│   │
│   ├── 📂 services/            # Business logic
│   │   ├── database.service.js # Đọc/ghi DB với cache
│   │   └── socket.service.js   # Socket.io logic
│   │
│   ├── 📂 middleware/          # Middleware - TODO
│   │   ├── auth.middleware.js  # Kiểm tra đăng nhập
│   │   └── error.middleware.js # Xử lý lỗi
│   │
│   └── 📂 utils/               # Tiện ích
│       └── helpers.js          # Hàm helper
│
├── 📂 public/                  # Static files
│   ├── 📂 js/                  # JavaScript client
│   │   ├── auth.js
│   │   ├── game.js
│   │   ├── history.js
│   │   └── pvp.js
│   ├── game.html
│   ├── history.html
│   ├── index.html
│   ├── login.html
│   ├── pvp.html
│   └── splash.html
│
├── 📂 data/                    # Dữ liệu
│   ├── db.json                 # Database JSON
│   └── puzzles.json            # Đề bài Sudoku
│
├── 📂 logs/                    # Log files - TODO
│   └── app.log
│
├── 📂 docs/                    # Tài liệu
│   ├── HISTORY_SYSTEM.md
│   ├── SCORING_SYSTEM.md
│   └── TURN_BASED_SYSTEM.md
│
├── server.js                   # Entry point chính
├── server.new.js               # Server mới (đang phát triển)
├── package.json
├── .gitignore
└── README.md

```

## 🎯 Mô hình MVC (Model-View-Controller)

### 1. **Model** (src/models/) - TODO
- Định nghĩa cấu trúc dữ liệu
- Validation
- Business rules

### 2. **View** (public/)
- HTML, CSS, JavaScript client-side
- Giao diện người dùng

### 3. **Controller** (src/controllers/)
- Nhận request từ routes
- Gọi services xử lý
- Trả về response

### 4. **Routes** (src/routes/)
- Định nghĩa API endpoints
- Kết nối URL với controllers

### 5. **Services** (src/services/)
- Business logic chính
- Tương tác database
- Socket.io logic

### 6. **Utils** (src/utils/)
- Hàm helper dùng chung
- Không chứa business logic

## 📊 Luồng xử lý request

```
Client Request 
    ↓
Routes (api.routes.js)
    ↓
Controller (auth.controller.js / game.controller.js)
    ↓
Service (database.service.js)
    ↓
Data (db.json)
    ↓
Response → Client
```

## 🚀 Ưu điểm cấu trúc mới

### ✅ Tách biệt rõ ràng
- Mỗi file có 1 nhiệm vụ cụ thể
- Dễ tìm kiếm và sửa lỗi
- Code không lặp lại

### ✅ Dễ mở rộng
- Thêm feature mới không ảnh hưởng code cũ
- Thêm controller/service mới dễ dàng
- Scale lên database thật đơn giản

### ✅ Dễ test
- Test từng module độc lập
- Mock data dễ dàng
- Unit test / Integration test

### ✅ Team work
- Nhiều người làm song song
- Conflict code ít hơn
- Review code dễ dàng

## 🔄 Migration từ server.js cũ

### Đã tách:
- ✅ Config → `src/config/constants.js`
- ✅ Database → `src/services/database.service.js`
- ✅ Helpers → `src/utils/helpers.js`
- ✅ Auth API → `src/controllers/auth.controller.js`
- ✅ Game API → `src/controllers/game.controller.js`
- ✅ Routes → `src/routes/api.routes.js`
- ✅ Socket → `src/services/socket.service.js` (một phần)

### Cần làm tiếp:
- ⏳ Hoàn thiện socket.service.js
- ⏳ Tạo Models
- ⏳ Thêm Middleware
- ⏳ Logger system
- ⏳ Error handling

## 📝 Conventions

### Naming:
- **Files**: `lowercase.type.js` (vd: `auth.controller.js`)
- **Classes**: `PascalCase` (vd: `AuthController`)
- **Functions**: `camelCase` (vd: `getUserById`)
- **Constants**: `UPPER_SNAKE_CASE` (vd: `DEFAULT_TURN_TIME`)

### Folders:
- Số nhiều: `controllers`, `routes`, `services`
- Tên ngắn gọn, mô tả rõ

## 🛠️ Cách sử dụng

### Development:
```bash
npm start
# hoặc
node server.js  # Server cũ (đang dùng)
node server.new.js  # Server mới (testing)
```

### Production:
```bash
NODE_ENV=production node server.js
```

## 📚 Tài liệu thêm

Xem thư mục `docs/` để biết chi tiết:
- Turn-based system
- Scoring system
- History system

---

**Version**: 2.0  
**Last updated**: Nov 6, 2025  
**Maintainer**: totomace
