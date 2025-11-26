require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs'); 
const bcrypt = require('bcrypt');
const http = require('http'); 
const { Server } = require("socket.io");
const postgres = require('./postgres');
const redisClient = require('./redis-client');
const antiCheat = require('./anti-cheat');
const queueManager = require('./queue-manager');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const app = express();
const server = http.createServer(app); 
const io = new Server(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS || "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB
    transports: ['websocket', 'polling']
});
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const PUZZLE_FILE = path.join(__dirname, 'puzzles.json'); 
const STARTING_SCORE = 1000;
const DEFAULT_TURN_TIME = 30;
const DEFAULT_TIMEOUT_PENALTY = 50;
const DEFAULT_MISTAKE_PENALTY = 100;

// --- Security Middlewares ---
app.use(helmet({
    contentSecurityPolicy: false, // Tắt CSP cho game
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(compression()); // Nén response
app.use(morgan('combined')); // Logging

// Rate limiting cho API
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 100, // Tối đa 100 requests
    message: { success: false, message: 'Quá nhiều requests, vui lòng thử lại sau' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiting cho register (chống spam account)
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 giờ
    max: process.env.NODE_ENV === 'test' ? 10000 : 5, // Test mode: 10000, Production: 5
    message: { success: false, message: 'Đã đăng ký quá nhiều tài khoản, vui lòng thử lại sau 1 giờ' },
    skipSuccessfulRequests: true
});

// Rate limiting cho login (chống brute force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: process.env.NODE_ENV === 'test' ? 10000 : 10, // Test mode: 10000, Production: 10
    message: { success: false, message: 'Đăng nhập thất bại quá nhiều, vui lòng thử lại sau 15 phút' },
    skipSuccessfulRequests: true
});

app.use(express.json({ limit: '1mb' })); // Giới hạn request body
app.use(express.static(path.join(__dirname, 'public'), { 
    index: false,
    maxAge: '1d', // Cache static files
    etag: true
}));

// === CÁC HÀM HỖ TRỢ (Phải nằm ngoài) ===
function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialDB = { users: [], gameHistory: [] };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialDB));
            return initialDB;
        }
        const data = fs.readFileSync(DB_FILE);
        const db = JSON.parse(data);
        if (!db.users) db.users = [];
        if (!db.gameHistory) db.gameHistory = [];
        return db;
    } catch (error) {
        console.error("Lỗi đọc DB:", error);
        return { users: [], gameHistory: [] }; 
    }
}
function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Lỗi ghi DB:", error);
    }
}
function readPuzzles() {
    try {
        if (!fs.existsSync(PUZZLE_FILE)) {
            console.error("LỖI: Không tìm thấy file puzzles.json!");
            return [];
        }
        const data = fs.readFileSync(PUZZLE_FILE);
        return JSON.parse(data).puzzles; // Trả về mảng puzzles
    } catch (error) {
        console.error("Lỗi đọc file puzzle:", error);
        return []; 
    }
}
function addChatMessage(socket, data) {
    socket.emit('chatMessage', {
        username: (data.isSystem) ? "Hệ thống" : socket.username,
        message: data.message,
        isSystem: data.isSystem || false
    });
}
function getSocketRoom(socket) {
    const rooms = Array.from(socket.rooms);
    return rooms[1]; 
}
function stringToBoard(str) {
    let board = [];
    for (let r = 0; r < 9; r++) {
        board.push(str.substring(r*9, r*9 + 9).split('').map(Number));
    }
    return board;
}
function calculateScore(startingScore, mistakes, mistakePenalty = DEFAULT_MISTAKE_PENALTY) {
    // Điểm = Điểm ban đầu - (số lần sai × penalty)
    return Math.max(0, startingScore - (mistakes * mistakePenalty));
}
function broadcastUserList() {
    const userList = Object.values(connectedUsers).map(u => ({
        username: u.username,
        status: u.status
    }));
    io.emit('updateUserList', userList);
}

// === API HTTP với Rate Limiting ===
app.post('/api/register', registerLimiter, async (req, res) => { 
    const { username, password } = req.body; 
    
    // Validate input
    if (!username || !password) return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ thông tin' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ success: false, message: 'Username phải từ 3-20 ký tự' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Mật khẩu phải ít nhất 6 ký tự' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ success: false, message: 'Username chỉ được chứa chữ, số và _' }); 
    
    try {
        // Kiểm tra user đã tồn tại
        const existingUser = await postgres.findUser(username);
        if (existingUser) return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại' });
        
        // Thêm vào queue thay vì gọi trực tiếp database
        const hashedPassword = await bcrypt.hash(password, 10);
        const job = await queueManager.addRegistration(username, hashedPassword);
        
        // Trả về ngay lập tức (không đợi job hoàn thành)
        res.status(202).json({ 
            success: true, 
            message: 'Đăng ký đang được xử lý',
            jobId: job.id 
        });
    } catch (error) {
        console.error('Lỗi đăng ký:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});
app.post('/api/login', loginLimiter, async (req, res) => { 
    const { username, password } = req.body; 
    if (!username || !password) return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ thông tin' }); 
    
    try {
        const user = await postgres.findUser(username);
        if (!user) return res.status(400).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu sai' }); 
        
        const isMatch = await bcrypt.compare(password, user.password); 
        if (isMatch) res.status(200).json({ success: true, message: 'Đăng nhập thành công' }); 
        else res.status(400).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu sai' }); 
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});
app.post('/api/save-game', apiLimiter, async (req, res) => { 
    const { username, mode, score, mistakes, opponent, result, reason } = req.body; 
    if (!username || !mode || score === undefined) return res.status(400).json({ success: false, message: 'Thiếu thông tin game' }); 
    
    try {
        await postgres.addGameHistory({ username, mode, score, mistakes: mistakes || 0, opponent, result, reason });
        res.status(201).json({ success: true, message: 'Đã lưu kết quả' }); 
    } catch (error) {
        console.error('Lỗi lưu game:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});
app.get('/api/history/:username', apiLimiter, async (req, res) => { 
    const { username } = req.params; 
    
    try {
        const userHistory = await postgres.getGameHistory(username);
        res.status(200).json({ success: true, data: userHistory }); 
    } catch (error) {
        console.error('Lỗi lấy lịch sử:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'splash.html')); });

// Queue stats endpoint
app.get('/api/queue/stats', async (req, res) => {
    try {
        const stats = await queueManager.getQueueStats();
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error('Lỗi lấy queue stats:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check PostgreSQL
        await postgres.pool.query('SELECT 1');
        
        // Get queue stats
        const queueStats = await queueManager.getQueueStats();
        
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            connections: Object.keys(connectedUsers).length,
            activeGames: Object.keys(activeGames).length,
            database: 'connected',
            redis: 'connected',
            queue: queueStats
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Stats endpoint
app.get('/api/stats', apiLimiter, (req, res) => {
    res.json({
        onlineUsers: Object.keys(connectedUsers).length,
        activeGames: Object.keys(activeGames).length,
        publicRooms: publicRooms.length,
        uptime: Math.floor(process.uptime())
    });
});

// === LOGIC GLOBAL (Timer, Lists) ===
const allPuzzles = readPuzzles(); 
let connectedUsers = {}; 
let activeGames = {};
let publicRooms = []; // Danh sách phòng động
// Pending invites: inviterSocketId -> { targetId, timer }
let pendingInvites = {};

function createNewRoom() {
    // Tìm ID nhỏ nhất còn thiếu (để tái sử dụng số phòng)
    let roomNumber = 1;
    const existingNumbers = publicRooms.map(r => parseInt(r.name.match(/\d+/)[0])).sort((a, b) => a - b);
    
    for (let num of existingNumbers) {
        if (num === roomNumber) {
            roomNumber++;
        } else {
            break;
        }
    }
    
    const room = {
        id: `room${roomNumber}`,
        name: `Phòng ${roomNumber}`,
        player1: null,
        player2: null,
        player1Id: null,
        player2Id: null,
        player1Ready: false,
        player2Ready: false,
        spectators: [],
        playerCount: 0,
        status: 'waiting', // waiting, ready, playing
        type: 'public' // public hoặc private
    };
    publicRooms.push(room);
    
    // Sắp xếp phòng theo số thứ tự
    publicRooms.sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)[0]);
        const numB = parseInt(b.name.match(/\d+/)[0]);
        return numA - numB;
    });
    
    return room;
}

// Tạo phòng trống ban đầu
createNewRoom();

function broadcastRoomList() {
    const roomListData = publicRooms.map(room => ({
        id: room.id,
        name: room.name,
        player1: room.player1,
        player2: room.player2,
        player1Ready: room.player1Ready,
        player2Ready: room.player2Ready,
        playerCount: room.playerCount,
        status: room.status,
        spectatorCount: room.spectators.length
    }));
    io.emit('roomList', roomListData);
}

function getOrCreateAvailableRoom() {
    // Tìm phòng trống hoặc chờ 1 người
    let room = publicRooms.find(r => r.playerCount < 2 && r.status === 'waiting');
    
    // Nếu không có phòng trống, tạo mới
    if (!room) {
        room = createNewRoom();
    }
    
    return room;
}

function cleanupEmptyRooms() {
    // Xóa tất cả phòng trống (phòng riêng không còn ai)
    const beforeCount = publicRooms.length;
    publicRooms = publicRooms.filter(r => r.playerCount > 0);
    const afterCount = publicRooms.length;
    
    if (beforeCount !== afterCount) {
        console.log(`[Cleanup] Đã xóa ${beforeCount - afterCount} phòng trống`);
    }
}

function resetRoomAfterGame(roomId) {
    const room = publicRooms.find(r => r.id === roomId);
    if (room) {
        room.player1 = null;
        room.player2 = null;
        room.player1Id = null;
        room.player2Id = null;
        room.playerCount = 0;
        room.status = 'waiting';
        room.player1Ready = false;
        room.player2Ready = false;
    }
    cleanupEmptyRooms();
    broadcastRoomList();
}

setInterval(() => {
    const now = Date.now();
    for (const roomName in activeGames) {
        const game = activeGames[roomName];
        
        // Trừ thời gian của lượt hiện tại
        game.turnTimeLeft = Math.max(0, game.turnTimeLeft - 1);
        
        const currentPlayer = (game.currentTurn === 1) ? game.p1 : game.p2;
        const opponent = (game.currentTurn === 1) ? game.p2 : game.p1;
        
        // Debug log
        if (game.turnTimeLeft % 5 === 0) {
            console.log(`[${roomName}] Lượt ${game.currentTurn}, Thời gian còn: ${game.turnTimeLeft}s`);
        }
        
        // Gửi cập nhật timer
        io.to(roomName).emit('updateTurnTimer', { 
            turnTimeLeft: game.turnTimeLeft,
            currentTurn: game.currentTurn,
            p1Score: game.p1.score,
            p2Score: game.p2.score
        });
        
        // Kiểm tra nếu hết thời gian lượt
        if (game.turnTimeLeft <= 0) {
            // Trừ điểm người chơi hiện tại
            const penalty = game.settings.timeoutPenalty;
            currentPlayer.mistakes++;
            currentPlayer.score = Math.max(0, currentPlayer.score - penalty);
            
            // Kiểm tra nếu hết điểm = THUA
            if (currentPlayer.score <= 0) {
                // Thông báo timeout trước
                io.to(roomName).emit('turnTimeout', {
                    player: currentPlayer.username,
                    penalty: penalty,
                    newScore: currentPlayer.score,
                    message: `${currentPlayer.username} hết thời gian!`
                });
                
                // Lưu lịch sử
                (async () => {
                    await postgres.addGameHistory({
                        username: opponent.username,
                        mode: 'PvP',
                        score: opponent.score,
                        mistakes: opponent.mistakes,
                        opponent: currentPlayer.username,
                        result: 'win',
                        reason: 'Đối thủ hết điểm'
                    });
                    await postgres.addGameHistory({
                        username: currentPlayer.username,
                        mode: 'PvP',
                        score: 0,
                        mistakes: currentPlayer.mistakes,
                        opponent: opponent.username,
                        result: 'lose',
                        reason: 'Hết điểm'
                    });
                })().catch(err => console.error('Lỗi lưu game history:', err));
                
                io.to(roomName).emit('gameResult', { 
                    winner: opponent.username, 
                    loser: currentPlayer.username,
                    score: opponent.score,
                    winnerMistakes: opponent.mistakes,
                    loserMistakes: currentPlayer.mistakes,
                    reason: `${currentPlayer.username} đã hết điểm!`
                });
                
                if(connectedUsers[game.p1.id]) connectedUsers[game.p1.id].status = 'online';
                if(connectedUsers[game.p2.id]) connectedUsers[game.p2.id].status = 'online';
                broadcastUserList();
                delete activeGames[roomName];
                resetRoomAfterGame(roomName);
                continue;
            }
            
            // Chuyển lượt
            game.currentTurn = (game.currentTurn === 1) ? 2 : 1;
            game.turnTimeLeft = game.settings.turnTimeLimit; // Reset thời gian lượt mới
            game.lastTurnTime = now;
            
            // 1. Thông báo timeout
            io.to(roomName).emit('turnTimeout', {
                player: currentPlayer.username,
                penalty: penalty,
                newScore: currentPlayer.score,
                message: `${currentPlayer.username} hết thời gian!`
            });
            
            // 2. Broadcast điểm mới
            io.to(roomName).emit('updateScores', {
                p1Score: game.p1.score,
                p2Score: game.p2.score,
                p1Mistakes: game.p1.mistakes,
                p2Mistakes: game.p2.mistakes
            });
            
            // 3. Thông báo chuyển lượt
            io.to(roomName).emit('turnChanged', { 
                currentTurn: game.currentTurn,
                turnTimeLeft: game.turnTimeLeft
            });
        }
    }
}, 1000);

// === LOGIC SOCKET.IO (KHỐI CHÍNH) ===
// TẤT CẢ socket.on(...) PHẢI NẰM BÊN TRONG KHỐI NÀY
// Rate limiting cho socket events
const socketRateLimits = new Map();

function checkSocketRateLimit(socketId, event, maxPerMinute = 60) {
    const key = `${socketId}:${event}`;
    const now = Date.now();
    
    if (!socketRateLimits.has(key)) {
        socketRateLimits.set(key, { count: 1, resetTime: now + 60000 });
        return true;
    }
    
    const limit = socketRateLimits.get(key);
    
    if (now > limit.resetTime) {
        limit.count = 1;
        limit.resetTime = now + 60000;
        return true;
    }
    
    if (limit.count >= maxPerMinute) {
        return false;
    }
    
    limit.count++;
    return true;
}

// Cleanup rate limit map mỗi 5 phút
setInterval(() => {
    const now = Date.now();
    for (const [key, limit] of socketRateLimits.entries()) {
        if (now > limit.resetTime) {
            socketRateLimits.delete(key);
        }
    }
}, 5 * 60 * 1000);

io.on('connection', (socket) => {
    console.log(`Một người vừa kết nối: ${socket.id}`);
    
    // Giới hạn số kết nối từ 1 IP
    const clientIp = socket.handshake.address;
    const connectionsFromIp = Object.values(io.sockets.sockets)
        .filter(s => s.handshake.address === clientIp).length;
    
    if (connectionsFromIp > 10) {
        console.log(`⚠️ Quá nhiều kết nối từ IP ${clientIp}`);
        socket.emit('error', { message: 'Quá nhiều kết nối từ IP này' });
        socket.disconnect(true);
        return;
    }
    
    // 1. User đăng ký tên
    socket.on('registerUser', async (username) => {
        if (!checkSocketRateLimit(socket.id, 'registerUser', 5)) {
            socket.emit('error', { message: 'Quá nhiều requests, vui lòng chờ' });
            return;
        }
        
        // Validate username
        if (!username || typeof username !== 'string' || username.length < 3 || username.length > 20) {
            socket.emit('error', { message: 'Username không hợp lệ' });
            return;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            socket.emit('error', { message: 'Username chỉ được chứa chữ, số và _' });
            return;
        }
        
        socket.username = username;
        connectedUsers[socket.id] = { username: username, status: 'online' };
        
        // Lưu user online vào Redis
        await redisClient.setUserOnline(username, socket.id);
        
        broadcastUserList(); 
    });

    // 2. User tìm trận ngẫu nhiên
    socket.on('findMatch', (settings = {}) => {
        if (!socket.username || !connectedUsers[socket.id]) {
            console.error(`Lỗi: ${socket.id} tìm trận nhưng chưa đăng ký tên.`);
            socket.emit('forceReload', { message: "Lỗi đồng bộ, vui lòng tải lại trang!" });
            return;
        }
        
        // Lưu settings của người chơi
        socket.gameSettings = {
            turnTimeLimit: parseInt(settings.turnTimeLimit) || DEFAULT_TURN_TIME,
            timeoutPenalty: parseInt(settings.timeoutPenalty) || DEFAULT_TIMEOUT_PENALTY,
            mistakePenalty: parseInt(settings.mistakePenalty) || DEFAULT_MISTAKE_PENALTY
        };
        
        // Tìm người cũng đang tìm random (chỉ ghép random với random)
        connectedUsers[socket.id].status = 'waiting';
        connectedUsers[socket.id].waitingType = 'random'; // Đánh dấu đang chờ random
        broadcastUserList();
        addChatMessage(socket, { isSystem: true, message: 'Đang tìm đối thủ...' });
        
        const waitingPlayerId = Object.keys(connectedUsers).find(id =>
            connectedUsers[id].status === 'waiting' && 
            connectedUsers[id].waitingType === 'random' && 
            id !== socket.id
        );
            
            if (waitingPlayerId) {
                // 2 người cùng random → Vào thẳng
                const player1_socket = socket;
                const player2_socket = io.sockets.sockets.get(waitingPlayerId);
                connectedUsers[player1_socket.id].status = 'playing';
                connectedUsers[player2_socket.id].status = 'playing';
                
                // Tạo phòng mới
                const room = getOrCreateAvailableRoom();
                room.player1 = player1_socket.username;
                room.player2 = player2_socket.username;
                room.player1Id = player1_socket.id;
                room.player2Id = player2_socket.id;
                room.playerCount = 2;
                room.status = 'playing';
                room.type = 'random';
                
                const roomName = room.id;
                player1_socket.join(roomName);
                player2_socket.join(roomName);
                player1_socket.currentRoomId = roomName;
                player2_socket.currentRoomId = roomName;
                
                const gameData = allPuzzles[Math.floor(Math.random() * allPuzzles.length)];
                
                // Lấy settings
                const settings = player1_socket.gameSettings || {
                    turnTimeLimit: DEFAULT_TURN_TIME,
                    timeoutPenalty: DEFAULT_TIMEOUT_PENALTY,
                    mistakePenalty: DEFAULT_MISTAKE_PENALTY
                };
                
                const matchData = {
                    room: roomName, 
                    puzzle: gameData.puzzle, 
                    solution: gameData.solution,
                    p1: { id: player1_socket.id, username: player1_socket.username, mistakes: 0, score: STARTING_SCORE },
                    p2: { id: player2_socket.id, username: player2_socket.username, mistakes: 0, score: STARTING_SCORE },
                    boardState: stringToBoard(gameData.puzzle),
                    solutionBoard: stringToBoard(gameData.solution),
                    startTime: Date.now(), 
                    currentTurn: 1,
                    lastTurnTime: Date.now(),
                    turnTimeLeft: settings.turnTimeLimit,
                    settings: settings
                };
                activeGames[roomName] = matchData;
                io.to(roomName).emit('matchFound', matchData);
                broadcastUserList();
                broadcastRoomList();
                cleanupEmptyRooms();
                addChatMessage(player1_socket, { isSystem: true, message: `Đã tìm thấy trận! Đối thủ: ${player2_socket.username}`});
                addChatMessage(player2_socket, { isSystem: true, message: `Đã tìm thấy trận! Đối thủ: ${player1_socket.username}`});
            } else {
                // Không có ai → Chỉ đợi, KHÔNG tạo phòng trong publicRooms
                // Người tìm random chỉ ghép với random, không tạo phòng công khai
                addChatMessage(socket, { isSystem: true, message: 'Bạn là người đầu tiên, vui lòng chờ...' });
            }
    });

    // 2.5. User hủy tìm trận
    socket.on('cancelMatch', () => {
        if (connectedUsers[socket.id] && connectedUsers[socket.id].status === 'waiting') {
            connectedUsers[socket.id].status = 'online';
            delete connectedUsers[socket.id].waitingType; // Xóa flag waitingType
            broadcastUserList();
            addChatMessage(socket, { isSystem: true, message: 'Đã hủy tìm trận.' });
        }
    });

    // 3. User mời riêng
    socket.on('privateInvite', (data) => {
        if (!socket.username) return;
        const targetSocketId = Object.keys(connectedUsers).find(id => 
            connectedUsers[id].username === data.targetUsername &&
            connectedUsers[id].status === 'online'
        );
        if (targetSocketId) {
            // Clear any previous pending invite from this inviter
            if (pendingInvites[socket.id] && pendingInvites[socket.id].timer) {
                clearTimeout(pendingInvites[socket.id].timer);
            }

            // Store pending invite and set a timeout (30s)
            const timer = setTimeout(() => {
                // If still pending, notify inviter of timeout and cleanup
                if (pendingInvites[socket.id] && pendingInvites[socket.id].targetId === targetSocketId) {
                    io.to(socket.id).emit('inviteTimeout', { targetUsername: data.targetUsername, message: `Lời mời tới ${data.targetUsername} đã hết hạn.` });
                    delete pendingInvites[socket.id];
                }
            }, 30000);

            pendingInvites[socket.id] = { targetId: targetSocketId, timer };

            // Notify recipient and ack inviter
            io.to(targetSocketId).emit('receiveInvite', { fromUsername: socket.username });
            socket.emit('inviteSent', { targetUsername: data.targetUsername });
        } else {
            addChatMessage(socket, { isSystem: true, message: `Không tìm thấy ${data.targetUsername} hoặc họ đang bận.` });
            socket.emit('inviteFailed', { targetUsername: data.targetUsername, message: 'Người chơi không khả dụng.' });
        }
    });

    // 4. User chấp nhận mời riêng
    socket.on('acceptInvite', (data) => {
        if (!socket.username) return;
        const inviterSocketId = Object.keys(connectedUsers).find(id =>
            connectedUsers[id].username === data.targetUsername &&
            connectedUsers[id].status === 'online'
        );
        if (inviterSocketId) {
            // Ensure the invite is still pending and intended for this socket
            const pending = pendingInvites[inviterSocketId];
            if (!pending || pending.targetId !== socket.id) {
                socket.emit('inviteFailed', { targetUsername: data.targetUsername, message: 'Lời mời không còn hợp lệ hoặc đã hết hạn.' });
                return;
            }

            // Clear invite timeout
            if (pending.timer) clearTimeout(pending.timer);
            delete pendingInvites[inviterSocketId];
            const player1_socket = io.sockets.sockets.get(inviterSocketId);
            const player2_socket = socket;
            connectedUsers[player1_socket.id].status = 'playing';
            connectedUsers[player2_socket.id].status = 'playing';
            
            // Tạo hoặc lấy phòng có sẵn
            const room = getOrCreateAvailableRoom();
            room.player1 = player1_socket.username;
            room.player2 = player2_socket.username;
            room.playerCount = 2;
            room.status = 'playing';
            room.type = 'private';
            
            const roomName = room.id;
            player1_socket.join(roomName);
            player2_socket.join(roomName);
            const gameData = allPuzzles[Math.floor(Math.random() * allPuzzles.length)];
            const settings = {
                turnTimeLimit: DEFAULT_TURN_TIME,
                timeoutPenalty: DEFAULT_TIMEOUT_PENALTY,
                mistakePenalty: DEFAULT_MISTAKE_PENALTY
            };
            const matchData = {
                room: roomName, puzzle: gameData.puzzle, solution: gameData.solution,
                p1: { id: player1_socket.id, username: player1_socket.username, mistakes: 0, score: STARTING_SCORE },
                p2: { id: player2_socket.id, username: player2_socket.username, mistakes: 0, score: STARTING_SCORE },
                boardState: stringToBoard(gameData.puzzle),
                solutionBoard: stringToBoard(gameData.solution),
                startTime: Date.now(),
                currentTurn: 1,
                lastTurnTime: Date.now(),
                turnTimeLeft: settings.turnTimeLimit,
                settings: settings
            };
            activeGames[roomName] = matchData;
            io.to(roomName).emit('matchFound', matchData);
            // Notify inviter that invite was accepted (optional small ack)
            io.to(inviterSocketId).emit('inviteAccepted', { by: player2_socket.username, room: roomName });
            broadcastUserList();
            broadcastRoomList(); // Cập nhật danh sách phòng
            cleanupEmptyRooms();
            addChatMessage(player1_socket, { isSystem: true, message: `${player2_socket.username} đã chấp nhận!`});
            addChatMessage(player2_socket, { isSystem: true, message: `Bạn đã chấp nhận ${player1_socket.username}!`});
        } else {
            addChatMessage(socket, { isSystem: true, message: `${data.targetUsername} đã offline hoặc vào trận khác.`});
        }
    });

    // 3.5 User từ chối lời mời (notify inviter)
    socket.on('declineInvite', (data) => {
        if (!socket.username) return;
        // find inviter by username
        const inviterSocketId = Object.keys(connectedUsers).find(id => connectedUsers[id].username === data.fromUsername);
        if (inviterSocketId) {
            // Clear pending invite if matches
            const pending = pendingInvites[inviterSocketId];
            if (pending && pending.targetId === socket.id) {
                if (pending.timer) clearTimeout(pending.timer);
                delete pendingInvites[inviterSocketId];
            }
            io.to(inviterSocketId).emit('inviteDeclined', { by: socket.username });
        }
    });

    // 5. User chat
    socket.on('chatMessage', (message) => {
        const gameRoom = getSocketRoom(socket);
        if (gameRoom) {
            // Nếu đang trong game, chỉ gửi cho người trong phòng
            io.to(gameRoom).emit('chatMessage', {
                username: socket.username,
                message: message
            });
        } else {
            // Nếu đang ở lobby, gửi lại cho chính mình (chat cá nhân)
            socket.emit('chatMessage', {
                username: socket.username,
                message: message,
                isSystem: false
            });
        }
    });

    // 6. User điền số
    socket.on('makeMove', async (data) => {
        if (!checkSocketRateLimit(socket.id, 'makeMove', 120)) {
            socket.emit('error', { message: 'Quá nhiều nước đi, vui lòng chờ' });
            return;
        }
        
        // Anti-cheat: Kiểm tra tốc độ đi nước
        if (!antiCheat.checkMoveSpeed(socket.id, Date.now())) {
            socket.emit('error', { message: 'Phát hiện hành vi bất thường. Bạn đã bị cấm tạm thời.' });
            socket.disconnect(true);
            antiCheat.scheduleBanRemoval(socket.id);
            return;
        }
        
        // Kiểm tra nếu user đã bị ban
        if (antiCheat.isBanned(socket.id)) {
            socket.emit('error', { message: 'Bạn đã bị cấm do hành vi gian lận' });
            socket.disconnect(true);
            return;
        }
        
        const gameRoom = getSocketRoom(socket);
        if (!gameRoom || !activeGames[gameRoom]) return;
        const game = activeGames[gameRoom];
        
        // Validate move data
        if (!data || typeof data.row !== 'number' || typeof data.col !== 'number' || typeof data.num !== 'number') {
            socket.emit('error', { message: 'Dữ liệu nước đi không hợp lệ' });
            return;
        }
        
        if (data.row < 0 || data.row > 8 || data.col < 0 || data.col > 8) {
            socket.emit('error', { message: 'Vị trí không hợp lệ' });
            return;
        }
        
        if (data.num < 0 || data.num > 9) {
            socket.emit('error', { message: 'Số không hợp lệ' });
            return;
        }
        
        // Kiểm tra xem có phải lượt của người này không
        const playerNum = (game.p1.id === socket.id) ? 1 : 2;
        if (playerNum !== game.currentTurn) {
            socket.emit('gameAlert', { message: 'Chưa đến lượt của bạn!' });
            return;
        }
        
        // Cập nhật bảng
        game.boardState[data.row][data.col] = data.num;
        socket.to(gameRoom).emit('opponentMove', data);
        
        // Lưu nước đi vào Redis
        const move = {
            player: socket.username,
            playerNum: playerNum,
            row: data.row,
            col: data.col,
            num: data.num,
            timestamp: Date.now()
        };
        await redisClient.saveMoveHistory(gameRoom, move);
        
        // Lưu trạng thái game vào Redis
        await redisClient.saveGameState(gameRoom, {
            boardState: game.boardState,
            p1Score: game.p1.score,
            p2Score: game.p2.score,
            p1Mistakes: game.p1.mistakes,
            p2Mistakes: game.p2.mistakes,
            currentTurn: game.currentTurn,
            turnTimeLeft: game.turnTimeLeft
        });
        
        // Chuyển lượt và RESET thời gian lượt mới
        game.currentTurn = (game.currentTurn === 1) ? 2 : 1;
        game.turnTimeLeft = game.settings.turnTimeLimit; // Reset thời gian
        game.lastTurnTime = Date.now();
        
        // Thông báo chuyển lượt
        io.to(gameRoom).emit('turnChanged', { 
            currentTurn: game.currentTurn,
            turnTimeLeft: game.turnTimeLeft
        });
    });

    // 7. User kiểm tra
    socket.on('checkGame', () => {
        const gameRoom = getSocketRoom(socket);
        if (!gameRoom || !activeGames[gameRoom]) return;
        const game = activeGames[gameRoom];
        let errors = []; let isFull = true;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (game.boardState[r][c] === 0) { isFull = false; }
                else if (game.boardState[r][c] !== game.solutionBoard[r][c] && game.boardState[r][c] !== 0) {
                    errors.push([r, c]);
                }
            }
        }
        
        const currentPlayer = (game.p1.id === socket.id) ? game.p1 : game.p2;
        const opponent = (game.p1.id === socket.id) ? game.p2 : game.p1;
        
        // Nếu có lỗi, trừ điểm
        if (errors.length > 0) {
            currentPlayer.mistakes++;
            currentPlayer.score = calculateScore(STARTING_SCORE, currentPlayer.mistakes, game.settings.mistakePenalty);
            
            // Kiểm tra nếu hết điểm = THUA
            if (currentPlayer.score <= 0) {
                const winnerUsername = opponent.username;
                const loserUsername = currentPlayer.username;
                
                // Lưu kết quả cho CẢ 2 NGƯỜI
                (async () => {
                    // Lưu cho người THẮNG
                    await postgres.addGameHistory({
                        username: winnerUsername,
                        mode: 'PvP',
                        score: opponent.score,
                        mistakes: opponent.mistakes,
                        opponent: loserUsername,
                        result: 'win',
                        reason: 'Đối thủ hết điểm'
                    });
                    // Lưu cho người THUA
                    await postgres.addGameHistory({
                        username: loserUsername,
                        mode: 'PvP',
                        score: 0,
                        mistakes: currentPlayer.mistakes,
                        opponent: winnerUsername,
                        result: 'lose',
                        reason: 'Hết điểm'
                    });
                })().catch(err => console.error('Lỗi lưu game history:', err));
                
                io.to(gameRoom).emit('gameResult', { 
                    winner: winnerUsername, 
                    loser: loserUsername,
                    score: opponent.score,
                    winnerMistakes: opponent.mistakes,
                    loserMistakes: currentPlayer.mistakes,
                    reason: `${loserUsername} đã hết điểm!`
                });
                
                if(connectedUsers[game.p1.id]) connectedUsers[game.p1.id].status = 'online';
                if(connectedUsers[game.p2.id]) connectedUsers[game.p2.id].status = 'online';
                broadcastUserList();
                delete activeGames[gameRoom];
                resetRoomAfterGame(gameRoom);
                return;
            }
            
            // Broadcast điểm mới cho cả 2 người
            io.to(gameRoom).emit('updateScores', {
                p1Score: game.p1.score,
                p2Score: game.p2.score,
                p1Mistakes: game.p1.mistakes,
                p2Mistakes: game.p2.mistakes
            });
        }
        
        // Nếu hoàn thành đúng hết = THẮNG
        if (isFull && errors.length === 0) {
            const winnerUsername = socket.username;
            const loserUsername = opponent.username;
            
            // Lưu kết quả cho CẢ 2 NGƯỜI
            (async () => {
                // Lưu cho người THẮNG
                await postgres.addGameHistory({
                    username: winnerUsername,
                    mode: 'PvP',
                    score: currentPlayer.score,
                    mistakes: currentPlayer.mistakes,
                    opponent: loserUsername,
                    result: 'win',
                    reason: 'Hoàn thành bảng'
                });
                // Lưu cho người THUA
                await postgres.addGameHistory({
                    username: loserUsername,
                    mode: 'PvP',
                    score: opponent.score,
                    mistakes: opponent.mistakes,
                    opponent: winnerUsername,
                    result: 'lose',
                    reason: 'Đối thủ hoàn thành trước'
                });
            })().catch(err => console.error('Lỗi lưu game history:', err));
            
            io.to(gameRoom).emit('gameResult', { 
                winner: winnerUsername, 
                loser: loserUsername,
                score: currentPlayer.score,
                winnerMistakes: currentPlayer.mistakes,
                loserMistakes: opponent.mistakes,
                reason: 'Hoàn thành bảng!'
            });
            if(connectedUsers[game.p1.id]) connectedUsers[game.p1.id].status = 'online';
            if(connectedUsers[game.p2.id]) connectedUsers[game.p2.id].status = 'online';
            broadcastUserList();
            delete activeGames[gameRoom];
            resetRoomAfterGame(gameRoom);
        } else {
            socket.emit('checkResult', { 
                errors: errors,
                mistakes: currentPlayer.mistakes,
                score: currentPlayer.score
            });
        }
    });

    // 8. User đầu hàng
    socket.on('surrender', () => {
        const gameRoom = getSocketRoom(socket);
        if (!gameRoom || !activeGames[gameRoom]) return;
        const game = activeGames[gameRoom];
        
        const currentPlayer = (game.p1.id === socket.id) ? game.p1 : game.p2;
        const opponent = (game.p1.id === socket.id) ? game.p2 : game.p1;
        const winnerUsername = opponent.username;
        const loserUsername = currentPlayer.username;
        
        // Lưu lịch sử cho CẢ 2 NGƯỜI
        (async () => {
            // Người THẮNG
            await postgres.addGameHistory({
                username: winnerUsername,
                mode: 'PvP',
                score: opponent.score,
                mistakes: opponent.mistakes,
                opponent: loserUsername,
                result: 'win',
                reason: 'Đối thủ đầu hàng'
            });
            // Người THUA
            await postgres.addGameHistory({
                username: loserUsername,
                mode: 'PvP',
                score: currentPlayer.score,
                mistakes: currentPlayer.mistakes,
                opponent: winnerUsername,
                result: 'lose',
                reason: 'Đầu hàng'
            });
        })().catch(err => console.error('Lỗi lưu game history:', err));
        
        io.to(gameRoom).emit('gameResult', { 
            winner: winnerUsername, 
            loser: loserUsername,
            score: opponent.score,
            winnerMistakes: opponent.mistakes,
            loserMistakes: currentPlayer.mistakes,
            reason: `${loserUsername} đã đầu hàng!`
        });
        if(connectedUsers[game.p1.id]) connectedUsers[game.p1.id].status = 'online';
        if(connectedUsers[game.p2.id]) connectedUsers[game.p2.id].status = 'online';
        broadcastUserList();
        delete activeGames[gameRoom];
        resetRoomAfterGame(gameRoom);
    });

    // === ROOM SYSTEM HANDLERS ===
    
    // Lấy danh sách phòng
    socket.on('getRoomList', () => {
        broadcastRoomList();
    });

    // Tạo phòng riêng với ID tùy chọn
    socket.on('createPrivateRoom', (data) => {
        const roomId = data.roomId;
        
        // Kiểm tra xem phòng đã tồn tại chưa
        const existingRoom = publicRooms.find(r => r.id === roomId);
        if (existingRoom) {
            socket.emit('error', { message: 'ID phòng này đã được sử dụng! Vui lòng chọn ID khác.' });
            return;
        }
        
        // Tạo phòng mới
        const room = {
            id: roomId,
            name: `Phòng #${roomId}`,
            player1: socket.username,
            player2: null,
            player1Id: socket.id,
            player2Id: null,
            player1Ready: false,
            player2Ready: false,
            spectators: [],
            playerCount: 1,
            status: 'waiting',
            type: 'private'
        };
        
        publicRooms.push(room);
        socket.join(roomId);
        socket.currentRoomId = roomId;
        connectedUsers[socket.id].status = 'waiting';
        
        socket.emit('privateRoomCreated', { 
            roomId: roomId,
            message: `Phòng #${roomId} đã được tạo! Chia sẻ ID này để bạn bè có thể tham gia.`
        });
        
        broadcastRoomList();
        broadcastUserList();
    });
    
    // Tham gia phòng riêng bằng ID
    socket.on('joinPrivateRoom', (data) => {
        const roomId = data.roomId;
        const room = publicRooms.find(r => r.id === roomId);
        
        if (!room) {
            socket.emit('error', { message: 'Không tìm thấy phòng với ID này!' });
            return;
        }
        
        if (room.playerCount >= 2) {
            socket.emit('error', { message: 'Phòng đã đầy hoặc đang chơi!' });
            return;
        }
        
        if (room.status !== 'waiting') {
            socket.emit('error', { message: 'Phòng không ở trạng thái chờ!' });
            return;
        }
        
        // Thêm vào phòng
        room.player2 = socket.username;
        room.player2Id = socket.id;
        room.playerCount = 2;
        room.status = 'ready';
        socket.join(roomId);
        socket.currentRoomId = roomId;
        connectedUsers[socket.id].status = 'waiting';
        
        // Thông báo cho cả 2 người
        io.to(roomId).emit('roomFull', { 
            player1: room.player1,
            player2: room.player2,
            roomId: roomId
        });
        
        broadcastRoomList();
        broadcastUserList();
    });

    // Vào phòng chơi
    socket.on('joinRoom', (data) => {
        const room = publicRooms.find(r => r.id === data.roomId);
        
        if (!room) {
            socket.emit('error', { message: 'Phòng không tồn tại!' });
            return;
        }

        if (room.playerCount >= 2) {
            socket.emit('error', { message: 'Phòng đã đầy hoặc đang chơi!' });
            return;
        }
        
        if (room.status !== 'waiting') {
            socket.emit('error', { message: 'Phòng không ở trạng thái chờ!' });
            return;
        }

        // Thêm người chơi vào phòng
        if (!room.player1) {
            room.player1 = socket.username;
            room.player1Id = socket.id;
            room.playerCount = 1;
            socket.join(data.roomId);
            socket.currentRoomId = data.roomId; // Lưu room ID vào socket
            connectedUsers[socket.id].status = 'waiting';
            socket.emit('joinedRoom', { roomId: data.roomId, waiting: true });
            broadcastRoomList();
            broadcastUserList();
        } else if (!room.player2) {
            room.player2 = socket.username;
            room.player2Id = socket.id;
            room.playerCount = 2;
            room.status = 'ready'; // Đổi thành ready, chưa playing
            socket.join(data.roomId);
            socket.currentRoomId = data.roomId;
            connectedUsers[socket.id].status = 'waiting';
            
            // Thông báo cho cả 2 người là phòng đã đủ
            io.to(data.roomId).emit('roomFull', { 
                player1: room.player1,
                player2: room.player2,
                roomId: data.roomId
            });
        }
        
        broadcastUserList();
        broadcastRoomList();
        cleanupEmptyRooms();
    });

    // Người chơi nhấn Ready
    socket.on('playerReady', (data) => {
        const room = publicRooms.find(r => r.id === data.roomId);
        
        if (!room) return;

        // Đánh dấu người chơi ready
        if (room.player1Id === socket.id) {
            room.player1Ready = true;
        } else if (room.player2Id === socket.id) {
            room.player2Ready = true;
        }

        // Thông báo trạng thái ready
        io.to(data.roomId).emit('readyStatus', {
            player1Ready: room.player1Ready,
            player2Ready: room.player2Ready
        });

        broadcastRoomList();

        // Nếu cả 2 đã ready, bắt đầu game
        if (room.player1Ready && room.player2Ready) {
            room.status = 'playing';
            
            const player1Socket = io.sockets.sockets.get(room.player1Id);
            const player2Socket = io.sockets.sockets.get(room.player2Id);
            
            if (player1Socket && player2Socket) {
                connectedUsers[player1Socket.id].status = 'playing';
                connectedUsers[player2Socket.id].status = 'playing';
                
                const gameData = allPuzzles[Math.floor(Math.random() * allPuzzles.length)];
                const settings = {
                    turnTimeLimit: DEFAULT_TURN_TIME,
                    timeoutPenalty: DEFAULT_TIMEOUT_PENALTY,
                    mistakePenalty: DEFAULT_MISTAKE_PENALTY
                };
                
                const matchData = {
                    room: data.roomId,
                    puzzle: gameData.puzzle,
                    solution: gameData.solution,
                    p1: { id: player1Socket.id, username: player1Socket.username, mistakes: 0, score: STARTING_SCORE },
                    p2: { id: player2Socket.id, username: player2Socket.username, mistakes: 0, score: STARTING_SCORE },
                    boardState: stringToBoard(gameData.puzzle),
                    solutionBoard: stringToBoard(gameData.solution),
                    startTime: Date.now(),
                    currentTurn: 1,
                    lastTurnTime: Date.now(),
                    turnTimeLeft: settings.turnTimeLimit,
                    settings: settings,
                    p1Board: stringToBoard(gameData.puzzle),
                    p2Board: stringToBoard(gameData.puzzle)
                };
                
                activeGames[data.roomId] = matchData;
                
                io.to(data.roomId).emit('matchFound', {
                    p1: { username: player1Socket.username },
                    p2: { username: player2Socket.username }
                });
                
                setTimeout(() => {
                    io.to(data.roomId).emit('gameStart', {
                        puzzle: gameData.puzzle,
                        solution: gameData.solution,
                        p1: { username: player1Socket.username },
                        p2: { username: player2Socket.username },
                        startingScore: STARTING_SCORE,
                        turnTimeLimit: settings.turnTimeLimit
                    });
                    
                    broadcastUserList();
                    broadcastRoomList();
                }, 2500);
            }
        }
    });

    // Thoát phòng
    socket.on('leaveRoom', (data) => {
        const room = publicRooms.find(r => r.id === data.roomId);
        
        if (!room) return;

        // Xóa người chơi khỏi phòng
        if (room.player1Id === socket.id) {
            room.player1 = null;
            room.player1Id = null;
            room.player1Ready = false;
            room.playerCount--;
        } else if (room.player2Id === socket.id) {
            room.player2 = null;
            room.player2Id = null;
            room.player2Ready = false;
            room.playerCount--;
        }

        // Reset status nếu chưa đủ 2 người
        if (room.playerCount < 2) {
            room.status = 'waiting';
        }

        socket.leave(data.roomId);
        socket.currentRoomId = null;
        
        // Thông báo cho người còn lại
        io.to(data.roomId).emit('playerLeft', {
            message: `${socket.username} đã rời phòng`
        });
        
        if (connectedUsers[socket.id]) {
            connectedUsers[socket.id].status = 'online';
        }

        socket.emit('leftRoom');
        broadcastUserList();
        broadcastRoomList();
        cleanupEmptyRooms();
    });

    // Xem phòng (spectator)
    socket.on('spectateRoom', (data) => {
        const room = publicRooms.find(r => r.id === data.roomId);
        
        if (!room) {
            socket.emit('error', { message: 'Phòng không tồn tại!' });
            return;
        }

        if (room.status !== 'playing') {
            socket.emit('error', { message: 'Phòng chưa bắt đầu chơi!' });
            return;
        }

        // Thêm vào danh sách spectators
        room.spectators.push(socket.id);
        socket.join(data.roomId);
        
        // Broadcast cập nhật danh sách phòng
        broadcastRoomList();
        
        // Gửi trạng thái game hiện tại
        const game = activeGames[data.roomId];
        if (game) {
            socket.emit('spectateStart', {
                p1: { username: game.p1.username, score: game.p1.score, mistakes: game.p1.mistakes },
                p2: { username: game.p2.username, score: game.p2.score, mistakes: game.p2.mistakes },
                puzzle: game.puzzle,
                p1Board: game.p1Board,
                p2Board: game.p2Board,
                currentTurn: game.currentTurn,
                turnTimeLeft: game.turnTimeLeft
            });
        }
    });

    // 9. User ngắt kết nối
    socket.on('disconnect', async () => {
        console.log(`Người dùng ${socket.id} đã ngắt kết nối.`);
        
        // Xóa khỏi phòng công khai nếu có
        publicRooms.forEach(room => {
            if (room.player1 === socket.username || room.player1Id === socket.id) {
                room.player1 = null;
                room.player1Id = null;
                room.playerCount--;
            }
            if (room.player2 === socket.username || room.player2Id === socket.id) {
                room.player2 = null;
                room.player2Id = null;
                room.playerCount--;
            }
            if (room.playerCount === 0) {
                room.status = 'waiting';
            }
            room.spectators = room.spectators.filter(id => id !== socket.id);
        });
        
        // Broadcast danh sách phòng sau khi cập nhật
        broadcastRoomList();
        
        cleanupEmptyRooms();
        
        const gameRoom = getSocketRoom(socket);
        if (gameRoom && activeGames[gameRoom]) {
            const game = activeGames[gameRoom];
            const opponentId = (game.p1.id === socket.id) ? game.p2.id : game.p1.id;
            const opponentSocket = io.sockets.sockets.get(opponentId);
            
            const currentPlayer = (game.p1.id === socket.id) ? game.p1 : game.p2;
            const opponent = (game.p1.id === socket.id) ? game.p2 : game.p1;
            
            // Lưu lịch sử cho CẢ 2 NGƯỜI
            (async () => {
                // Người THẮNG (ở lại)
                await postgres.addGameHistory({
                    username: opponent.username,
                    mode: 'PvP',
                    score: opponent.score,
                    mistakes: opponent.mistakes,
                    opponent: currentPlayer.username,
                    result: 'win',
                    reason: 'Đối thủ thoát game'
                });
                // Người THUA (ngắt kết nối)
                await postgres.addGameHistory({
                    username: currentPlayer.username,
                    mode: 'PvP',
                    score: currentPlayer.score,
                    mistakes: currentPlayer.mistakes,
                    opponent: opponent.username,
                    result: 'lose',
                    reason: 'Thoát game'
                });
            })().catch(err => console.error('Lỗi lưu game history:', err));
            
            if (opponentSocket) {
                opponentSocket.emit('gameResult', { 
                    winner: opponent.username, 
                    loser: currentPlayer.username,
                    score: opponent.score,
                    winnerMistakes: opponent.mistakes,
                    loserMistakes: currentPlayer.mistakes,
                    reason: `${currentPlayer.username} đã thoát game!`
                });
                if(connectedUsers[opponentId]) { connectedUsers[opponentId].status = 'online'; }
            }
            delete activeGames[gameRoom];
            resetRoomAfterGame(gameRoom);
            
            // Xóa game state khỏi Redis
            await redisClient.deleteGameState(gameRoom);
            await redisClient.deleteMoveHistory(gameRoom);
        }
        
        // Xóa user khỏi Redis
        if (socket.username) {
            await redisClient.removeUserOnline(socket.username);
        }
        
        delete connectedUsers[socket.id];
        broadcastUserList();
        broadcastRoomList();
    });

}); // === KẾT THÚC io.on('connection') ===


// === Khởi động Server ===
async function startServer() {
    try {
        // Kết nối Redis
        await redisClient.connectRedis();
        console.log('✅ Redis đã sẵn sàng!');
        
        // Kết nối và tạo bảng PostgreSQL
        await postgres.connectDB();
        await postgres.createTables();
        console.log('✅ PostgreSQL đã sẵn sàng!');
        
        // Khởi động server
        server.listen(PORT, '0.0.0.0', () => { 
            console.log(`OK! Server (Express + Socket.io) đang chạy tại:`);
            console.log(`  - Local:   http://localhost:${PORT}`);
            console.log(`  - Network: http://10.216.72.91:${PORT}`);
            console.log(`\nMáy khác có thể truy cập qua: http://10.216.72.91:${PORT}`);
            console.log(`\n📬 Message Queue đã sẵn sàng!`);
        });

        // Graceful handling of listen errors (e.g. port already in use)
        server.on('error', (err) => {
            if (err && err.code === 'EADDRINUSE') {
                console.error(`❌ Lỗi: Port ${PORT} đã được sử dụng. Dừng process khác hoặc đổi PORT.`);
                console.error(`  - Tìm process (PowerShell): netstat -ano | findstr :${PORT}`);
                console.error(`  - Dừng process: Stop-Process -Id <PID> -Force  OR  taskkill /PID <PID> /F`);
                console.error(`  - Hoặc chạy server trên port khác: $env:PORT=3001; node server.js`);
                process.exit(1);
            } else {
                console.error('Lỗi server:', err);
            }
        });
    } catch (error) {
        console.error('❌ Lỗi khởi động server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
async function gracefulShutdown() {
    console.log('\n🛑 Đang dừng server...');
    
    try {
        // Đóng queue trước
        await queueManager.closeQueue();
        console.log('✅ Queue đã đóng');
        
        // Đóng Redis
        await redisClient.client.quit();
        console.log('✅ Redis đã đóng');
        
        // Đóng PostgreSQL
        await postgres.pool.end();
        console.log('✅ PostgreSQL đã đóng');
        
        // Đóng server
        server.close(() => {
            console.log('✅ Server đã dừng');
            process.exit(0);
        });
    } catch (error) {
        console.error('❌ Lỗi khi dừng server:', error);
        process.exit(1);
    }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

startServer();