# Hướng dẫn cài đặt PostgreSQL

## Cách 1: Download và cài đặt (Windows)

1. **Download PostgreSQL**:
   - Truy cập: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
   - Chọn version mới nhất cho Windows (khuyên dùng 16.x)
   - Download và chạy installer

2. **Cài đặt**:
   - Chọn "Next" qua các bước
   - **Quan trọng**: Nhớ mật khẩu bạn đặt cho user `postgres`
   - Port mặc định: `5432` (giữ nguyên)
   - Locale: `Default locale`
   - Chờ cài đặt xong

3. **Tạo database**:
   Mở PowerShell và chạy:
   ```powershell
   # Đăng nhập vào PostgreSQL
   psql -U postgres
   
   # Nhập mật khẩu bạn đã đặt
   # Sau đó chạy lệnh SQL:
   CREATE DATABASE sudoku_game;
   \q
   ```

4. **Cấu hình project**:
   Mở file `.env` và chỉnh:
   ```
   DB_TYPE=postgres
   PGUSER=postgres
   PGPASSWORD=YOUR_PASSWORD_HERE
   PGDATABASE=sudoku_game
   ```

5. **Chạy script bật PostgreSQL**:
   ```powershell
   .\enable-postgres.ps1
   ```

## Cách 2: Dùng PostgreSQL Cloud (Không cần cài - Miễn phí)

### Neon.tech (Khuyên dùng)
1. Đăng ký: https://neon.tech
2. Tạo project mới
3. Copy connection string
4. Sửa file `.env`:
   ```
   DB_TYPE=postgres
   PGHOST=ep-xxx.region.aws.neon.tech
   PGUSER=your_user
   PGPASSWORD=your_password
   PGDATABASE=neondb
   PGPORT=5432
   ```

### Supabase
1. Đăng ký: https://supabase.com
2. Tạo project mới
3. Vào Settings → Database → Connection String
4. Copy URI mode và cập nhật `.env`

## Kiểm tra kết nối

```powershell
# Test connection
node -e "const pg = require('./postgres'); pg.connectDB().then(() => console.log('OK')).catch(console.error)"
```

## Chuyển đổi giữa các database

```powershell
# Dùng PostgreSQL
.\enable-postgres.ps1

# Quay lại JSON
.\use-json.ps1
```

## Migration dữ liệu

Khi bật PostgreSQL lần đầu, dữ liệu từ `db.json` sẽ tự động được migrate sang PostgreSQL.
File backup sẽ được lưu tại `db.backup.json`.

## Troubleshooting

### Lỗi: "password authentication failed"
- Kiểm tra mật khẩu trong `.env`
- Reset mật khẩu PostgreSQL nếu quên

### Lỗi: "could not connect to server"
- Kiểm tra PostgreSQL service đã chạy chưa:
  ```powershell
  Get-Service -Name postgresql*
  ```
- Nếu chưa chạy:
  ```powershell
  Start-Service postgresql-x64-16
  ```

### Lỗi: "database does not exist"
- Tạo database:
  ```powershell
  psql -U postgres -c "CREATE DATABASE sudoku_game;"
  ```
