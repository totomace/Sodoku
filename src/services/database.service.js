const fs = require('fs');
const path = require('path');
const config = require('../config/constants');

// Cache database
let dbCache = null;
let dbCacheTime = 0;

class DatabaseService {
    static readDB() {
        try {
            const DB_FILE = path.join(__dirname, '../../', config.DB_FILE);
            
            // Sử dụng cache nếu còn hiệu lực
            if (dbCache && (Date.now() - dbCacheTime) < config.CACHE_TTL) {
                return dbCache;
            }
            
            if (!fs.existsSync(DB_FILE)) {
                const initialDB = { users: [], gameHistory: [] };
                fs.writeFileSync(DB_FILE, JSON.stringify(initialDB));
                dbCache = initialDB;
                dbCacheTime = Date.now();
                return initialDB;
            }
            
            const data = fs.readFileSync(DB_FILE, 'utf8');
            const db = JSON.parse(data);
            if (!db.users) db.users = [];
            if (!db.gameHistory) db.gameHistory = [];
            
            // Cập nhật cache
            dbCache = db;
            dbCacheTime = Date.now();
            return db;
        } catch (error) {
            console.error("Lỗi đọc DB:", error);
            return { users: [], gameHistory: [] };
        }
    }

    static writeDB(data) {
        try {
            const DB_FILE = path.join(__dirname, '../../', config.DB_FILE);
            
            // Ghi bất đồng bộ
            fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), (err) => {
                if (err) console.error("Lỗi ghi DB:", err);
            });
            
            // Cập nhật cache ngay
            dbCache = data;
            dbCacheTime = Date.now();
        } catch (error) {
            console.error("Lỗi writeDB:", error);
        }
    }

    static readPuzzles() {
        try {
            const PUZZLE_FILE = path.join(__dirname, '../../', config.PUZZLE_FILE);
            
            if (!fs.existsSync(PUZZLE_FILE)) {
                console.error("LỖI: Không tìm thấy file puzzles.json!");
                return [];
            }
            const data = fs.readFileSync(PUZZLE_FILE, 'utf8');
            return JSON.parse(data).puzzles;
        } catch (error) {
            console.error("Lỗi đọc file puzzle:", error);
            return [];
        }
    }
}

module.exports = DatabaseService;
