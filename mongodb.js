const { MongoClient } = require('mongodb');

// URL kết nối MongoDB
// Nếu dùng MongoDB local: mongodb://localhost:27017
// Nếu dùng MongoDB Atlas (cloud): mongodb+srv://username:password@cluster.mongodb.net
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = 'sudoku_game';

let db = null;
let client = null;

// Kết nối MongoDB
async function connectDB() {
    try {
        client = new MongoClient(MONGO_URL);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('✅ Đã kết nối MongoDB thành công!');
        
        // Tạo indexes
        await createIndexes();
        
        return db;
    } catch (error) {
        console.error('❌ Lỗi kết nối MongoDB:', error);
        throw error;
    }
}

// Tạo indexes cho performance
async function createIndexes() {
    try {
        // Index cho users
        await db.collection('users').createIndex({ username: 1 }, { unique: true });
        
        // Index cho gameHistory
        await db.collection('gameHistory').createIndex({ username: 1 });
        await db.collection('gameHistory').createIndex({ date: -1 });
        
        console.log('✅ Đã tạo indexes');
    } catch (error) {
        console.error('Lỗi tạo indexes:', error);
    }
}

// Lấy database instance
function getDB() {
    if (!db) {
        throw new Error('Database chưa được khởi tạo! Gọi connectDB() trước.');
    }
    return db;
}

// Đóng kết nối
async function closeDB() {
    if (client) {
        await client.close();
        console.log('Đã đóng kết nối MongoDB');
    }
}

// === USER OPERATIONS ===

async function findUser(username) {
    const db = getDB();
    return await db.collection('users').findOne({ username });
}

async function createUser(username, password) {
    const db = getDB();
    const user = {
        username,
        password,
        createdAt: new Date()
    };
    await db.collection('users').insertOne(user);
    return user;
}

async function getAllUsers() {
    const db = getDB();
    return await db.collection('users').find({}).toArray();
}

// === GAME HISTORY OPERATIONS ===

async function addGameHistory(historyData) {
    const db = getDB();
    const history = {
        ...historyData,
        date: historyData.date || new Date().toISOString()
    };
    await db.collection('gameHistory').insertOne(history);
    return history;
}

async function getGameHistory(username, limit = 50) {
    const db = getDB();
    return await db.collection('gameHistory')
        .find({ username })
        .sort({ date: -1 })
        .limit(limit)
        .toArray();
}

async function getAllGameHistory(limit = 100) {
    const db = getDB();
    return await db.collection('gameHistory')
        .find({})
        .sort({ date: -1 })
        .limit(limit)
        .toArray();
}

// === LEADERBOARD ===

async function getLeaderboard(mode = 'PvP', limit = 10) {
    const db = getDB();
    
    // Aggregation để tính điểm trung bình và số trận thắng
    const leaderboard = await db.collection('gameHistory').aggregate([
        { $match: { mode, result: 'win' } },
        {
            $group: {
                _id: '$username',
                totalWins: { $sum: 1 },
                avgScore: { $avg: '$score' },
                bestScore: { $max: '$score' },
                totalGames: { $sum: 1 }
            }
        },
        { $sort: { totalWins: -1, avgScore: -1 } },
        { $limit: limit }
    ]).toArray();
    
    return leaderboard;
}

// === MIGRATION: Import từ JSON cũ ===

async function migrateFromJSON(jsonData) {
    const db = getDB();
    
    try {
        // Import users
        if (jsonData.users && jsonData.users.length > 0) {
            // Xóa users hiện có để tránh duplicate
            await db.collection('users').deleteMany({});
            await db.collection('users').insertMany(jsonData.users);
            console.log(`✅ Đã import ${jsonData.users.length} users`);
        }
        
        // Import game history
        if (jsonData.gameHistory && jsonData.gameHistory.length > 0) {
            await db.collection('gameHistory').deleteMany({});
            await db.collection('gameHistory').insertMany(jsonData.gameHistory);
            console.log(`✅ Đã import ${jsonData.gameHistory.length} game history records`);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Lỗi migration:', error);
        throw error;
    }
}

module.exports = {
    connectDB,
    getDB,
    closeDB,
    findUser,
    createUser,
    getAllUsers,
    addGameHistory,
    getGameHistory,
    getAllGameHistory,
    getLeaderboard,
    migrateFromJSON
};
