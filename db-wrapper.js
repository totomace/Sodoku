// Database wrapper - Hỗ trợ JSON, MongoDB, PostgreSQL
const fs = require('fs');
const path = require('path');

// Biến để chọn database type
const DB_TYPE = process.env.DB_TYPE || 'json'; // 'json', 'mongodb', 'postgres'

let mongodb = null;
let postgres = null;

if (DB_TYPE === 'mongodb') {
    mongodb = require('./mongodb');
} else if (DB_TYPE === 'postgres') {
    postgres = require('./postgres');
}

const DB_FILE = path.join(__dirname, 'db.json');

// === JSON FUNCTIONS (Backup/Fallback) ===

function readJSONDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const defaultData = { users: [], gameHistory: [] };
            fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        const db = JSON.parse(data);
        if (!db.users) db.users = [];
        if (!db.gameHistory) db.gameHistory = [];
        return db;
    } catch (error) {
        console.error('❌ Lỗi đọc JSON:', error);
        return { users: [], gameHistory: [] };
    }
}

function writeJSONDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Lỗi ghi JSON:', error);
    }
}

// === WRAPPER FUNCTIONS ===

async function initDB() {
    console.log(`🔧 Database mode: ${DB_TYPE.toUpperCase()}`);
    
    if (DB_TYPE === 'postgres') {
        try {
            await postgres.connectDB();
            console.log('✅ Sử dụng PostgreSQL');
            
            // Migration từ JSON sang PostgreSQL nếu cần
            const jsonData = readJSONDB();
            if (jsonData.users.length > 0 || jsonData.gameHistory.length > 0) {
                console.log('🔄 Đang migrate dữ liệu từ JSON sang PostgreSQL...');
                await postgres.migrateFromJSON(jsonData);
                console.log('✅ Migration hoàn tất!');
                
                // Backup file JSON cũ
                const backupFile = DB_FILE.replace('.json', '.backup.json');
                fs.copyFileSync(DB_FILE, backupFile);
                console.log(`💾 Đã backup JSON vào: ${backupFile}`);
            }
        } catch (error) {
            console.error('❌ Lỗi kết nối PostgreSQL, fallback sang JSON');
            process.env.DB_TYPE = 'json';
        }
    } else if (DB_TYPE === 'mongodb') {
        try {
            await mongodb.connectDB();
            console.log('✅ Sử dụng MongoDB');
            
            const jsonData = readJSONDB();
            if (jsonData.users.length > 0 || jsonData.gameHistory.length > 0) {
                console.log('🔄 Đang migrate dữ liệu từ JSON sang MongoDB...');
                await mongodb.migrateFromJSON(jsonData);
                console.log('✅ Migration hoàn tất!');
            }
        } catch (error) {
            console.error('❌ Lỗi kết nối MongoDB, fallback sang JSON');
            process.env.DB_TYPE = 'json';
        }
    } else {
        console.log('📁 Sử dụng JSON file database');
    }
}

async function findUser(username) {
    if (DB_TYPE === 'postgres') {
        return await postgres.findUser(username);
    } else if (DB_TYPE === 'mongodb') {
        return await mongodb.findUser(username);
    } else {
        const db = readJSONDB();
        return db.users.find(u => u.username === username);
    }
}

async function createUser(username, hashedPassword) {
    if (DB_TYPE === 'postgres') {
        return await postgres.createUser(username, hashedPassword);
    } else if (DB_TYPE === 'mongodb') {
        return await mongodb.createUser(username, hashedPassword);
    } else {
        const db = readJSONDB();
        const newUser = {
            id: Date.now().toString(),
            username,
            password: hashedPassword
        };
        db.users.push(newUser);
        writeJSONDB(db);
        return newUser;
    }
}

async function addGameHistory(historyData) {
    if (DB_TYPE === 'postgres') {
        return await postgres.addGameHistory(historyData);
    } else if (DB_TYPE === 'mongodb') {
        return await mongodb.addGameHistory(historyData);
    } else {
        const db = readJSONDB();
        db.gameHistory.push(historyData);
        writeJSONDB(db);
        return historyData;
    }
}

async function getGameHistory(username) {
    if (DB_TYPE === 'postgres') {
        return await postgres.getGameHistory(username);
    } else if (DB_TYPE === 'mongodb') {
        return await mongodb.getGameHistory(username);
    } else {
        const db = readJSONDB();
        return db.gameHistory.filter(game => 
            game.username.toLowerCase() === username.toLowerCase()
        );
    }
}

async function getAllUsers() {
    if (DB_TYPE === 'postgres') {
        return await postgres.getAllUsers();
    } else if (DB_TYPE === 'mongodb') {
        return await mongodb.getAllUsers();
    } else {
        const db = readJSONDB();
        return db.users;
    }
}

async function getLeaderboard(mode, limit) {
    if (DB_TYPE === 'postgres') {
        return await postgres.getLeaderboard(mode, limit);
    } else if (DB_TYPE === 'mongodb') {
        return await mongodb.getLeaderboard(mode, limit);
    } else {
        // Simple leaderboard từ JSON
        const db = readJSONDB();
        const wins = {};
        db.gameHistory
            .filter(g => g.mode === mode && g.result === 'win')
            .forEach(g => {
                if (!wins[g.username]) {
                    wins[g.username] = { username: g.username, totalWins: 0, scores: [] };
                }
                wins[g.username].totalWins++;
                wins[g.username].scores.push(g.score);
            });
        
        return Object.values(wins)
            .map(w => ({
                username: w.username,
                total_wins: w.totalWins,
                avg_score: Math.round(w.scores.reduce((a, b) => a + b, 0) / w.scores.length),
                best_score: Math.max(...w.scores)
            }))
            .sort((a, b) => b.total_wins - a.total_wins || b.avg_score - a.avg_score)
            .slice(0, limit || 10);
    }
}

// Export cả 2 interface cũ và mới
module.exports = {
    // New async interface
    initDB,
    findUser,
    createUser,
    addGameHistory,
    getGameHistory,
    getAllUsers,
    getLeaderboard,
    
    // Old sync interface (for backward compatibility)
    readDB: readJSONDB,
    writeDB: writeJSONDB,
    
    // Config
    DB_TYPE
};
