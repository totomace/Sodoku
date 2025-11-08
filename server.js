const express = require('express');
const path = require('path');
const fs = require('fs'); 
const bcrypt = require('bcrypt');
const http = require('http'); 
const { Server } = require("socket.io"); 

const app = express();
const server = http.createServer(app); 
const io = new Server(server); 

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const PUZZLE_FILE = path.join(__dirname, 'puzzles.json'); 
const STARTING_SCORE = 1000; // Điểm khởi đầu
const DEFAULT_TURN_TIME = 30; // Thời gian mỗi lượt mặc định (giây)
const DEFAULT_TIMEOUT_PENALTY = 50; // Phạt khi hết thời gian lượt
const DEFAULT_MISTAKE_PENALTY = 100; // Phạt khi kiểm tra sai

// --- Middlewares ---
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

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

// === API HTTP (Đầy đủ) ===
app.post('/api/register', async (req, res) => { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ thông tin' }); const db = readDB(); if (db.users.find(user => user.username === username)) return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại' }); const hashedPassword = await bcrypt.hash(password, 10); const newUser = { id: Date.now().toString(), username, password: hashedPassword }; db.users.push(newUser); writeDB(db); res.status(201).json({ success: true, message: 'Đăng ký thành công' }); });
app.post('/api/login', async (req, res) => { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ thông tin' }); const db = readDB(); const user = db.users.find(u => u.username === username); if (!user) return res.status(400).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu sai' }); const isMatch = await bcrypt.compare(password, user.password); if (isMatch) res.status(200).json({ success: true, message: 'Đăng nhập thành công' }); else res.status(400).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu sai' }); });
app.post('/api/save-game', (req, res) => { const { username, mode, score } = req.body; if (!username || !mode || score === undefined) return res.status(400).json({ success: false, message: 'Thiếu thông tin game' }); const db = readDB(); const newGame = { username: username, mode: mode, score: score, date: new Date().toISOString() }; db.gameHistory.push(newGame); writeDB(db); res.status(201).json({ success: true, message: 'Đã lưu kết quả' }); });
app.get('/api/history/:username', (req, res) => { const { username } = req.params; const db = readDB(); const userHistory = db.gameHistory.filter(game => game.username.toLowerCase() === username.toLowerCase()); res.status(200).json({ success: true, data: userHistory }); });
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'splash.html')); });

// === LOGIC GLOBAL (Timer, Lists) ===
const allPuzzles = readPuzzles(); 
let connectedUsers = {}; 
let activeGames = {};
let publicRooms = []; // Danh sách phòng động

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
                const db = readDB();
                db.gameHistory.push({
                    username: opponent.username,
                    mode: 'PvP',
                    score: opponent.score,
                    mistakes: opponent.mistakes,
                    opponent: currentPlayer.username,
                    result: 'win',
                    reason: 'Đối thủ hết điểm',
                    date: new Date().toISOString()
                });
                db.gameHistory.push({
                    username: currentPlayer.username,
                    mode: 'PvP',
                    score: 0,
                    mistakes: currentPlayer.mistakes,
                    opponent: opponent.username,
                    result: 'lose',
                    reason: 'Hết điểm',
                    date: new Date().toISOString()
                });
                writeDB(db);
                
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
io.on('connection', (socket) => {
    console.log(`Một người vừa kết nối: ${socket.id}`);
    
    // 1. User đăng ký tên
    socket.on('registerUser', (username) => {
        socket.username = username;
        connectedUsers[socket.id] = { username: username, status: 'online' };
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
            io.to(targetSocketId).emit('receiveInvite', { fromUsername: socket.username });
        } else {
            addChatMessage(socket, { isSystem: true, message: `Không tìm thấy ${data.targetUsername} hoặc họ đang bận.` });
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
            const matchData = {
                room: roomName, puzzle: gameData.puzzle, solution: gameData.solution,
                p1: { id: player1_socket.id, username: player1_socket.username, mistakes: 0, score: STARTING_SCORE },
                p2: { id: player2_socket.id, username: player2_socket.username, mistakes: 0, score: STARTING_SCORE },
                boardState: stringToBoard(gameData.puzzle),
                solutionBoard: stringToBoard(gameData.solution),
                startTime: Date.now(),
                currentTurn: 1,
                lastTurnTime: Date.now()
            };
            activeGames[roomName] = matchData;
            io.to(roomName).emit('matchFound', matchData);
            broadcastUserList();
            broadcastRoomList(); // Cập nhật danh sách phòng
            cleanupEmptyRooms();
            addChatMessage(player1_socket, { isSystem: true, message: `${player2_socket.username} đã chấp nhận!`});
            addChatMessage(player2_socket, { isSystem: true, message: `Bạn đã chấp nhận ${player1_socket.username}!`});
        } else {
            addChatMessage(socket, { isSystem: true, message: `${data.targetUsername} đã offline hoặc vào trận khác.`});
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
    socket.on('makeMove', (data) => {
        const gameRoom = getSocketRoom(socket);
        if (!gameRoom || !activeGames[gameRoom]) return;
        const game = activeGames[gameRoom];
        
        // Kiểm tra xem có phải lượt của người này không
        const playerNum = (game.p1.id === socket.id) ? 1 : 2;
        if (playerNum !== game.currentTurn) {
            socket.emit('gameAlert', { message: 'Chưa đến lượt của bạn!' });
            return;
        }
        
        // Cập nhật bảng
        game.boardState[data.row][data.col] = data.num;
        socket.to(gameRoom).emit('opponentMove', data);
        
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
                const db = readDB();
                // Lưu cho người THẮNG
                db.gameHistory.push({
                    username: winnerUsername,
                    mode: 'PvP',
                    score: opponent.score,
                    mistakes: opponent.mistakes,
                    opponent: loserUsername,
                    result: 'win',
                    reason: 'Đối thủ hết điểm',
                    date: new Date().toISOString()
                });
                // Lưu cho người THUA
                db.gameHistory.push({
                    username: loserUsername,
                    mode: 'PvP',
                    score: 0,
                    mistakes: currentPlayer.mistakes,
                    opponent: winnerUsername,
                    result: 'lose',
                    reason: 'Hết điểm',
                    date: new Date().toISOString()
                });
                writeDB(db);
                
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
            const db = readDB();
            // Lưu cho người THẮNG
            db.gameHistory.push({
                username: winnerUsername,
                mode: 'PvP',
                score: currentPlayer.score,
                mistakes: currentPlayer.mistakes,
                opponent: loserUsername,
                result: 'win',
                reason: 'Hoàn thành bảng',
                date: new Date().toISOString()
            });
            // Lưu cho người THUA
            db.gameHistory.push({
                username: loserUsername,
                mode: 'PvP',
                score: opponent.score,
                mistakes: opponent.mistakes,
                opponent: winnerUsername,
                result: 'lose',
                reason: 'Đối thủ hoàn thành trước',
                date: new Date().toISOString()
            });
            writeDB(db);
            
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
        const db = readDB();
        // Người THẮNG
        db.gameHistory.push({
            username: winnerUsername,
            mode: 'PvP',
            score: opponent.score,
            mistakes: opponent.mistakes,
            opponent: loserUsername,
            result: 'win',
            reason: 'Đối thủ đầu hàng',
            date: new Date().toISOString()
        });
        // Người THUA
        db.gameHistory.push({
            username: loserUsername,
            mode: 'PvP',
            score: currentPlayer.score,
            mistakes: currentPlayer.mistakes,
            opponent: winnerUsername,
            result: 'lose',
            reason: 'Đầu hàng',
            date: new Date().toISOString()
        });
        writeDB(db);
        
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
    socket.on('disconnect', () => {
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
            const db = readDB();
            // Người THẮNG (ở lại)
            db.gameHistory.push({
                username: opponent.username,
                mode: 'PvP',
                score: opponent.score,
                mistakes: opponent.mistakes,
                opponent: currentPlayer.username,
                result: 'win',
                reason: 'Đối thủ thoát game',
                date: new Date().toISOString()
            });
            // Người THUA (ngắt kết nối)
            db.gameHistory.push({
                username: currentPlayer.username,
                mode: 'PvP',
                score: currentPlayer.score,
                mistakes: currentPlayer.mistakes,
                opponent: opponent.username,
                result: 'lose',
                reason: 'Thoát game',
                date: new Date().toISOString()
            });
            writeDB(db);
            
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
        }
        delete connectedUsers[socket.id];
        broadcastUserList();
        broadcastRoomList();
    });

}); // === KẾT THÚC io.on('connection') ===


// === Khởi động Server ===
server.listen(PORT, '0.0.0.0', () => { 
    console.log(`OK! Server (Express + Socket.io) đang chạy tại:`);
    console.log(`  - Local:   http://localhost:${PORT}`);
    console.log(`  - Network: http://10.216.72.91:${PORT}`);
    console.log(`\nMáy khác có thể truy cập qua: http://10.216.72.91:${PORT}`);
});