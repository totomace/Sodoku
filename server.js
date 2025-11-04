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
        const timeElapsed = Math.floor((now - game.startTime) / 1000);
        const timeLeft = game.duration - timeElapsed;
        io.to(roomName).emit('updateTimer', { timeLeft: timeLeft });
        if (timeLeft <= 0) {
            io.to(roomName).emit('gameResult', { draw: true, winner: null, loser: null });
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
                p1: { id: player1_socket.id, username: player1_socket.username },
                p2: { id: player2_socket.id, username: player2_socket.username },
                boardState: stringToBoard(gameData.puzzle),
                solutionBoard: stringToBoard(gameData.solution),
                startTime: Date.now(), duration: 600
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
                p1: { id: player1_socket.id, username: player1_socket.username },
                p2: { id: player2_socket.id, username: player2_socket.username },
                boardState: stringToBoard(gameData.puzzle),
                solutionBoard: stringToBoard(gameData.solution),
                startTime: Date.now(), duration: 600
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
            io.to(gameRoom).emit('chatMessage', {
                username: socket.username,
                message: message
            });
        }
    });

    // 6. User điền số
    socket.on('makeMove', (data) => {
        const gameRoom = getSocketRoom(socket);
        if (!gameRoom || !activeGames[gameRoom]) return;
        activeGames[gameRoom].boardState[data.row][data.col] = data.num;
        socket.to(gameRoom).emit('opponentMove', data);
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
        if (isFull && errors.length === 0) {
            io.to(gameRoom).emit('gameResult', { winner: socket.username, loser: (game.p1.username === socket.username) ? game.p2.username : game.p1.username });
            if(connectedUsers[game.p1.id]) connectedUsers[game.p1.id].status = 'online';
            if(connectedUsers[game.p2.id]) connectedUsers[game.p2.id].status = 'online';
            broadcastUserList();
            delete activeGames[gameRoom];
        } else {
            socket.emit('checkResult', { errors: errors });
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
server.listen(PORT, () => { 
    console.log(`OK! Server (Express + Socket.io) đang chạy tại http://localhost:${PORT}`);
});