// ============================================
// SOCKET.IO SERVICE - XỬ LÝ GAME LOGIC
// ============================================
const { readDB, writeDB, readPuzzles } = require('./database.service');
const { stringToBoard, calculateScore, getSocketRoom } = require('../utils/helpers');
const { 
    STARTING_SCORE, 
    DEFAULT_TURN_TIME, 
    DEFAULT_TIMEOUT_PENALTY,
    DEFAULT_MISTAKE_PENALTY 
} = require('../config/constants');

// Biến global (shared state)
let io = null;
const connectedUsers = {};
const activeGames = {};
let allPuzzles = [];

// Broadcast throttling
let lastBroadcastTime = 0;
const BROADCAST_THROTTLE = 100; // 100ms minimum giữa các broadcast

/**
 * Khởi tạo Socket.io service
 */
function initializeSocketService(socketIo) {
    io = socketIo;
    allPuzzles = readPuzzles();
    
    // Khởi động các timers
    setupTimers();
    
    console.log('✅ Socket.io service initialized');
}

/**
 * Setup timers (turn timer, cleanup)
 */
function setupTimers() {
    // Timer kiểm tra thời gian lượt (mỗi giây)
    setInterval(() => {
        const now = Date.now();
        const gameKeys = Object.keys(activeGames);
        
        for (const roomName of gameKeys) {
            const game = activeGames[roomName];
            if (!game || !game.currentTurn) continue;
            
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
                handleTurnTimeout(roomName, game, currentPlayer, opponent);
            }
        }
    }, 1000);
    
    // Cleanup games cũ (mỗi 5 phút)
    setInterval(() => {
        const now = Date.now();
        const gameKeys = Object.keys(activeGames);
        let cleaned = 0;
        
        for (const roomName of gameKeys) {
            const game = activeGames[roomName];
            // Xóa game quá 30 phút không hoạt động
            if (now - game.lastTurnTime > 30 * 60 * 1000) {
                delete activeGames[roomName];
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} inactive games`);
        }
    }, 5 * 60 * 1000);
}

/**
 * Xử lý khi hết thời gian lượt
 */
function handleTurnTimeout(roomName, game, currentPlayer, opponent) {
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
        endGame(roomName, game, opponent.username, currentPlayer.username, 
                opponent.score, opponent.mistakes, currentPlayer.mistakes, 
                `${currentPlayer.username} đã hết điểm!`, 'Đối thủ hết điểm', 'Hết điểm');
        return;
    }
    
    // Chuyển lượt
    game.currentTurn = (game.currentTurn === 1) ? 2 : 1;
    game.turnTimeLeft = game.settings.turnTimeLimit;
    game.lastTurnTime = Date.now();
    
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

/**
 * Kết thúc game và lưu lịch sử
 */
function endGame(roomName, game, winnerUsername, loserUsername, 
                 winnerScore, winnerMistakes, loserMistakes, 
                 displayReason, winReason, loseReason) {
    // Lưu lịch sử
    const db = readDB();
    
    // Người THẮNG
    db.gameHistory.push({
        username: winnerUsername,
        mode: 'PvP',
        score: winnerScore,
        mistakes: winnerMistakes,
        opponent: loserUsername,
        result: 'win',
        reason: winReason,
        date: new Date().toISOString()
    });
    
    // Người THUA
    db.gameHistory.push({
        username: loserUsername,
        mode: 'PvP',
        score: game.p1.username === loserUsername ? game.p1.score : game.p2.score,
        mistakes: loserMistakes,
        opponent: winnerUsername,
        result: 'lose',
        reason: loseReason,
        date: new Date().toISOString()
    });
    
    writeDB(db);
    
    // Thông báo kết quả
    io.to(roomName).emit('gameResult', { 
        winner: winnerUsername, 
        loser: loserUsername,
        score: winnerScore,
        winnerMistakes: winnerMistakes,
        loserMistakes: loserMistakes,
        reason: displayReason
    });
    
    // Cập nhật trạng thái users
    if (connectedUsers[game.p1.id]) connectedUsers[game.p1.id].status = 'online';
    if (connectedUsers[game.p2.id]) connectedUsers[game.p2.id].status = 'online';
    broadcastUserList();
    
    // Xóa game
    delete activeGames[roomName];
}

/**
 * Broadcast danh sách users
 */
function broadcastUserList() {
    const now = Date.now();
    if (now - lastBroadcastTime < BROADCAST_THROTTLE) return;
    lastBroadcastTime = now;
    
    const userList = Object.values(connectedUsers).map(u => ({
        username: u.username,
        status: u.status
    }));
    io.emit('userList', userList);
}

/**
 * Helper: Gửi chat message cho socket
 */
function addChatMessage(socket, data) {
    socket.emit('chatMessage', data);
}

/**
 * Xử lý socket event: registerUser
 */
function handleRegisterUser(socket, username) {
    socket.username = username;
    connectedUsers[socket.id] = { username: username, status: 'online' };
    broadcastUserList();
}

/**
 * Xử lý socket event: cancelMatch
 */
function handleCancelMatch(socket) {
    if (!connectedUsers[socket.id]) return;
    
    // Chuyển về trạng thái online
    connectedUsers[socket.id].status = 'online';
    broadcastUserList();
    
    console.log(`${socket.username} đã hủy tìm trận`);
}

/**
 * Xử lý socket event: findMatch
 */
function handleFindMatch(socket, settings = {}) {
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
        const gameSettings = player1_socket.gameSettings || {
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
            turnTimeLeft: gameSettings.turnTimeLimit,
            settings: gameSettings
        };
        
        activeGames[roomName] = matchData;
        io.to(roomName).emit('matchFound', matchData);
        broadcastUserList();
        
        addChatMessage(player1_socket, { isSystem: true, message: `Đã tìm thấy trận! Đối thủ: ${player2_socket.username}`});
        addChatMessage(player2_socket, { isSystem: true, message: `Đã tìm thấy trận! Đối thủ: ${player1_socket.username}`});
    } else {
        addChatMessage(socket, { isSystem: true, message: 'Bạn là người đầu tiên, vui lòng chờ...' });
    }
}

/**
 * Xử lý socket event: makeMove
 */
function handleMakeMove(socket, data) {
    const gameRoom = getSocketRoom(socket, activeGames);
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
    game.turnTimeLeft = game.settings.turnTimeLimit;
    game.lastTurnTime = Date.now();
    
    // Thông báo chuyển lượt
    io.to(gameRoom).emit('turnChanged', { 
        currentTurn: game.currentTurn,
        turnTimeLeft: game.turnTimeLeft
    });
}

/**
 * Xử lý socket event: checkGame
 */
function handleCheckGame(socket) {
    const gameRoom = getSocketRoom(socket, activeGames);
    if (!gameRoom || !activeGames[gameRoom]) return;
    
    const game = activeGames[gameRoom];
    let errors = [];
    let isFull = true;
    
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (game.boardState[r][c] === 0) { 
                isFull = false; 
            } else if (game.boardState[r][c] !== game.solutionBoard[r][c] && game.boardState[r][c] !== 0) {
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
            endGame(gameRoom, game, opponent.username, currentPlayer.username, 
                    opponent.score, opponent.mistakes, currentPlayer.mistakes, 
                    `${currentPlayer.username} đã hết điểm!`, 'Đối thủ hết điểm', 'Hết điểm');
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
        endGame(gameRoom, game, socket.username, opponent.username, 
                currentPlayer.score, currentPlayer.mistakes, opponent.mistakes, 
                'Hoàn thành bảng!', 'Hoàn thành bảng', 'Đối thủ hoàn thành trước');
    } else {
        socket.emit('checkResult', { 
            errors: errors,
            mistakes: currentPlayer.mistakes,
            score: currentPlayer.score
        });
    }
}

/**
 * Xử lý socket event: surrender
 */
function handleSurrender(socket) {
    const gameRoom = getSocketRoom(socket, activeGames);
    if (!gameRoom || !activeGames[gameRoom]) return;
    
    const game = activeGames[gameRoom];
    const currentPlayer = (game.p1.id === socket.id) ? game.p1 : game.p2;
    const opponent = (game.p1.id === socket.id) ? game.p2 : game.p1;
    
    endGame(gameRoom, game, opponent.username, currentPlayer.username, 
            opponent.score, opponent.mistakes, currentPlayer.mistakes, 
            `${currentPlayer.username} đã đầu hàng!`, 'Đối thủ đầu hàng', 'Đầu hàng');
}

/**
 * Xử lý socket event: chatMessage
 */
function handleChatMessage(socket, message) {
    const gameRoom = getSocketRoom(socket, activeGames);
    if (gameRoom) {
        // Nếu đang trong game, chỉ gửi cho người trong phòng
        io.to(gameRoom).emit('chatMessage', {
            username: socket.username,
            message: message
        });
    } else {
        // Nếu đang ở lobby, gửi lại cho chính mình
        socket.emit('chatMessage', {
            username: socket.username,
            message: message,
            isSystem: false
        });
    }
}

/**
 * Xử lý socket event: disconnect
 */
function handleDisconnect(socket) {
    console.log(`Người dùng ${socket.id} đã ngắt kết nối.`);
    
    const gameRoom = getSocketRoom(socket, activeGames);
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
            
            if (connectedUsers[opponentId]) { 
                connectedUsers[opponentId].status = 'online'; 
            }
        }
        
        delete activeGames[gameRoom];
    }
    
    delete connectedUsers[socket.id];
    broadcastUserList();
}

module.exports = {
    initializeSocketService,
    connectedUsers,
    activeGames,
    broadcastUserList,
    handleRegisterUser,
    handleCancelMatch,
    handleFindMatch,
    handleMakeMove,
    handleCheckGame,
    handleSurrender,
    handleChatMessage,
    handleDisconnect
};
