const redis = require('redis');

let client = null;

async function connectRedis() {
    if (client) return client;
    
    client = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
    });

    client.on('error', (err) => console.error('Redis Error:', err));
    client.on('connect', () => console.log('✅ Redis đã kết nối!'));
    
    await client.connect();
    return client;
}

// Lưu trạng thái game đang chơi
async function saveGameState(roomId, gameData) {
    try {
        await client.set(`game:${roomId}`, JSON.stringify(gameData), {
            EX: 3600 // Hết hạn sau 1 giờ
        });
    } catch (error) {
        console.error('Lỗi lưu game state:', error);
    }
}

// Lấy trạng thái game
async function getGameState(roomId) {
    try {
        const data = await client.get(`game:${roomId}`);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Lỗi lấy game state:', error);
        return null;
    }
}

// Xóa game state khi kết thúc
async function deleteGameState(roomId) {
    try {
        await client.del(`game:${roomId}`);
    } catch (error) {
        console.error('Lỗi xóa game state:', error);
    }
}

// Lưu lượt đi (history của từng nước)
async function saveMoveHistory(roomId, move) {
    try {
        await client.rPush(`moves:${roomId}`, JSON.stringify(move));
        await client.expire(`moves:${roomId}`, 3600); // Hết hạn sau 1 giờ
    } catch (error) {
        console.error('Lỗi lưu move history:', error);
    }
}

// Lấy lịch sử các nước đi
async function getMoveHistory(roomId) {
    try {
        const moves = await client.lRange(`moves:${roomId}`, 0, -1);
        return moves.map(m => JSON.parse(m));
    } catch (error) {
        console.error('Lỗi lấy move history:', error);
        return [];
    }
}

// Xóa lịch sử nước đi
async function deleteMoveHistory(roomId) {
    try {
        await client.del(`moves:${roomId}`);
    } catch (error) {
        console.error('Lỗi xóa move history:', error);
    }
}

// Lưu user online
async function setUserOnline(username, socketId) {
    try {
        await client.hSet('users:online', username, socketId);
    } catch (error) {
        console.error('Lỗi set user online:', error);
    }
}

// Xóa user khi offline
async function removeUserOnline(username) {
    try {
        await client.hDel('users:online', username);
    } catch (error) {
        console.error('Lỗi remove user online:', error);
    }
}

// Lấy danh sách user online
async function getOnlineUsers() {
    try {
        return await client.hGetAll('users:online');
    } catch (error) {
        console.error('Lỗi lấy online users:', error);
        return {};
    }
}

// Đóng kết nối Redis
async function closeRedis() {
    if (client) {
        await client.quit();
        client = null;
    }
}

module.exports = {
    connectRedis,
    saveGameState,
    getGameState,
    deleteGameState,
    saveMoveHistory,
    getMoveHistory,
    deleteMoveHistory,
    setUserOnline,
    removeUserOnline,
    getOnlineUsers,
    closeRedis
};
