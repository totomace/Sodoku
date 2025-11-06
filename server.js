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
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'login.html')); });

// === LOGIC GLOBAL (Timer, Lists) ===
const allPuzzles = readPuzzles(); 
let connectedUsers = {}; 
let activeGames = {}; 

setInterval(() => {
    const now = Date.now();
    for (const roomName in activeGames) {
        const game = activeGames[roomName];
        
        // Trừ thời gian của lượt hiện tại
        game.turnTimeLeft = Math.max(0, game.turnTimeLeft - 1);
        
        const currentPlayer = (game.currentTurn === 1) ? game.p1 : game.p2;
        const opponent = (game.currentTurn === 1) ? game.p2 : game.p1;
        
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
            
            // Thông báo
            io.to(roomName).emit('turnTimeout', {
                player: currentPlayer.username,
                penalty: penalty,
                newScore: currentPlayer.score
            });
            
            // Kiểm tra nếu hết điểm = THUA
            if (currentPlayer.score <= 0) {
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
                continue;
            }
            
            // Chuyển lượt
            game.currentTurn = (game.currentTurn === 1) ? 2 : 1;
            game.turnTimeLeft = game.settings.turnTimeLimit; // Reset thời gian lượt mới
            game.lastTurnTime = now;
            
            // Broadcast điểm mới
            io.to(roomName).emit('updateScores', {
                p1Score: game.p1.score,
                p2Score: game.p2.score,
                p1Mistakes: game.p1.mistakes,
                p2Mistakes: game.p2.mistakes
            });
            
            // Thông báo chuyển lượt
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
        
        connectedUsers[socket.id].status = 'waiting';
        broadcastUserList();
        addChatMessage(socket, { isSystem: true, message: 'Đang tìm đối thủ...' });
        const waitingPlayerId = Object.keys(connectedUsers).find(id =>
            connectedUsers[id].status === 'waiting' && id !== socket.id
        );
        if (waitingPlayerId) {
            const player1_socket = socket;
            const player2_socket = io.sockets.sockets.get(waitingPlayerId);
            connectedUsers[player1_socket.id].status = 'playing';
            connectedUsers[player2_socket.id].status = 'playing';
            const roomName = `room_${player1_socket.id}`;
            player1_socket.join(roomName);
            player2_socket.join(roomName);
            const gameData = allPuzzles[Math.floor(Math.random() * allPuzzles.length)];
            
            // Lấy settings (ưu tiên settings của người tạo phòng)
            const settings = player1_socket.gameSettings || {
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
                currentTurn: 1, // 1 = player1, 2 = player2
                lastTurnTime: Date.now(),
                turnTimeLeft: settings.turnTimeLimit, // Thời gian còn lại của lượt hiện tại
                settings: settings // Lưu settings vào game
            };
            activeGames[roomName] = matchData;
            io.to(roomName).emit('matchFound', matchData);
            broadcastUserList();
            addChatMessage(player1_socket, { isSystem: true, message: `Đã tìm thấy trận! Đối thủ: ${player2_socket.username}`});
            addChatMessage(player2_socket, { isSystem: true, message: `Đã tìm thấy trận! Đối thủ: ${player1_socket.username}`});
        } else {
            addChatMessage(socket, { isSystem: true, message: 'Bạn là người đầu tiên, vui lòng chờ...' });
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
            const roomName = `room_${player1_socket.id}`;
            player1_socket.join(roomName);
            player2_socket.join(roomName);
            const gameData = allPuzzles[Math.floor(Math.random() * allPuzzles.length)];
            const matchData = {
                room: roomName, puzzle: gameData.puzzle, solution: gameData.solution,
                p1: { id: player1_socket.id, username: player1_socket.username, mistakes: 0, timeLeft: GAME_DURATION, score: STARTING_SCORE },
                p2: { id: player2_socket.id, username: player2_socket.username, mistakes: 0, timeLeft: GAME_DURATION, score: STARTING_SCORE },
                boardState: stringToBoard(gameData.puzzle),
                solutionBoard: stringToBoard(gameData.solution),
                startTime: Date.now(),
                currentTurn: 1,
                lastTurnTime: Date.now()
            };
            activeGames[roomName] = matchData;
            io.to(roomName).emit('matchFound', matchData);
            broadcastUserList();
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
    });

    // 9. User ngắt kết nối
    socket.on('disconnect', () => {
        console.log(`Người dùng ${socket.id} đã ngắt kết nối.`);
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
        }
        delete connectedUsers[socket.id];
        broadcastUserList();
    });

}); // === KẾT THÚC io.on('connection') ===


// === Khởi động Server ===
server.listen(PORT, '0.0.0.0', () => { 
    console.log(`OK! Server (Express + Socket.io) đang chạy tại:`);
    console.log(`  - Local:   http://localhost:${PORT}`);
    console.log(`  - Network: http://10.216.72.91:${PORT}`);
    console.log(`\nMáy khác có thể truy cập qua: http://10.216.72.91:${PORT}`);
});