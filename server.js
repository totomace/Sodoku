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
const GAME_DURATION = 600; // Thời gian mỗi trận: 600 giây (10 phút)
const STARTING_SCORE = 1000; // Điểm khởi đầu
const PENALTY_PER_MISTAKE = 100; // Mỗi lần sai trừ 100 điểm

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
function calculateScore(startingScore, mistakes) {
    // Điểm = Điểm ban đầu - (số lần sai × 100)
    return Math.max(0, startingScore - (mistakes * PENALTY_PER_MISTAKE));
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
        
        // Tính thời gian đã trôi qua từ lần chuyển lượt cuối
        const timeSinceLastTurn = Math.floor((now - game.lastTurnTime) / 1000);
        
        // Trừ thời gian của người đang chơi
        const currentPlayer = (game.currentTurn === 1) ? game.p1 : game.p2;
        currentPlayer.timeLeft = Math.max(0, currentPlayer.timeLeft - 1);
        
        // Gửi cập nhật timer cho cả 2 người
        io.to(roomName).emit('updateTimer', { 
            p1TimeLeft: game.p1.timeLeft,
            p2TimeLeft: game.p2.timeLeft,
            currentTurn: game.currentTurn
        });
        
        // Kiểm tra nếu hết giờ
        if (currentPlayer.timeLeft <= 0) {
            const winner = (game.currentTurn === 1) ? game.p2 : game.p1;
            const loser = currentPlayer;
            
            io.to(roomName).emit('gameResult', { 
                winner: winner.username, 
                loser: loser.username,
                score: winner.score,
                winnerMistakes: winner.mistakes,
                loserMistakes: loser.mistakes,
                reason: `${loser.username} hết thời gian!`
            });
            
            if(connectedUsers[game.p1.id]) connectedUsers[game.p1.id].status = 'online';
            if(connectedUsers[game.p2.id]) connectedUsers[game.p2.id].status = 'online';
            broadcastUserList();
            delete activeGames[roomName];
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
    socket.on('findMatch', () => {
        if (!socket.username || !connectedUsers[socket.id]) {
            console.error(`Lỗi: ${socket.id} tìm trận nhưng chưa đăng ký tên.`);
            socket.emit('forceReload', { message: "Lỗi đồng bộ, vui lòng tải lại trang!" });
            return;
        }
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
            const matchData = {
                room: roomName, puzzle: gameData.puzzle, solution: gameData.solution,
                p1: { id: player1_socket.id, username: player1_socket.username, mistakes: 0, timeLeft: GAME_DURATION, score: STARTING_SCORE },
                p2: { id: player2_socket.id, username: player2_socket.username, mistakes: 0, timeLeft: GAME_DURATION, score: STARTING_SCORE },
                boardState: stringToBoard(gameData.puzzle),
                solutionBoard: stringToBoard(gameData.solution),
                startTime: Date.now(), 
                currentTurn: 1, // 1 = player1, 2 = player2
                lastTurnTime: Date.now()
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
        
        // Chuyển lượt
        game.currentTurn = (game.currentTurn === 1) ? 2 : 1;
        game.lastTurnTime = Date.now();
        
        // Thông báo chuyển lượt
        io.to(gameRoom).emit('turnChanged', { 
            currentTurn: game.currentTurn,
            p1TimeLeft: game.p1.timeLeft,
            p2TimeLeft: game.p2.timeLeft
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
            currentPlayer.score = calculateScore(STARTING_SCORE, currentPlayer.mistakes);
            
            // Kiểm tra nếu hết điểm = THUA
            if (currentPlayer.score <= 0) {
                const winnerUsername = opponent.username;
                const loserUsername = currentPlayer.username;
                
                // Lưu kết quả
                const db = readDB();
                db.gameHistory.push({
                    username: winnerUsername,
                    mode: 'PvP',
                    score: opponent.score,
                    mistakes: opponent.mistakes,
                    opponent: loserUsername,
                    reason: 'Đối thủ hết điểm',
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
            
            // Lưu kết quả vào database
            const db = readDB();
            db.gameHistory.push({
                username: winnerUsername,
                mode: 'PvP',
                score: currentPlayer.score,
                mistakes: currentPlayer.mistakes,
                opponent: loserUsername,
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
        const winnerUsername = (game.p1.username === socket.username) ? game.p2.username : game.p1.username;
        io.to(gameRoom).emit('gameResult', { winner: winnerUsername, loser: socket.username });
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
            if (opponentSocket) {
                opponentSocket.emit('gameResult', { winner: opponentSocket.username, loser: socket.username });
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