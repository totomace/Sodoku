-- Tạo database
CREATE DATABASE sudoku_game;

-- Kết nối vào database
\c sudoku_game;

-- Tạo bảng users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tạo bảng game_history
CREATE TABLE IF NOT EXISTS game_history (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    score INTEGER NOT NULL,
    mistakes INTEGER DEFAULT 0,
    opponent VARCHAR(50),
    result VARCHAR(10),
    reason TEXT,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tạo indexes để tăng tốc truy vấn
CREATE INDEX IF NOT EXISTS idx_username ON game_history(username);
CREATE INDEX IF NOT EXISTS idx_date ON game_history(date DESC);
CREATE INDEX IF NOT EXISTS idx_mode_result ON game_history(mode, result);

-- Hiển thị thông tin
\dt
SELECT 'Database sudoku_game đã sẵn sàng!' as status;
