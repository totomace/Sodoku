// ============================================
// SERVER MỚI - MODULAR MVC ARCHITECTURE
// ============================================
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");

// Import modules
const config = require('./src/config/constants');
const apiRoutes = require('./src/routes/api.routes');
const socketService = require('./src/services/socket.service');

// ===== EXPRESS SETUP =====
const app = express();
const server = http.createServer(app);

// ===== SOCKET.IO SETUP =====
const io = new Server(server, {
    pingTimeout: config.SOCKET_PING_TIMEOUT,
    pingInterval: config.SOCKET_PING_INTERVAL,
    transports: ['websocket', 'polling'],
    allowUpgrades: true
});

// ===== MIDDLEWARES =====
app.use(express.json({ limit: config.REQUEST_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
    index: false,
    maxAge: config.STATIC_CACHE_MAX_AGE,
    etag: true
}));

// ===== ROUTES =====
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'splash.html'));
});

// ===== SOCKET.IO INITIALIZATION =====
socketService.initializeSocketService(io);

// ===== SOCKET.IO EVENT HANDLERS =====
io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);
    
    // 1. User registration
    socket.on('registerUser', (username) => {
        socketService.handleRegisterUser(socket, username);
    });
    
    // 2. Matchmaking
    socket.on('findMatch', (settings) => {
        socketService.handleFindMatch(socket, settings);
    });
    
    socket.on('cancelMatch', () => {
        socketService.handleCancelMatch(socket);
    });
    
    // 3. Game actions
    socket.on('makeMove', (data) => {
        socketService.handleMakeMove(socket, data);
    });
    
    socket.on('checkGame', () => {
        socketService.handleCheckGame(socket);
    });
    
    socket.on('surrender', () => {
        socketService.handleSurrender(socket);
    });
    
    // 4. Chat
    socket.on('chatMessage', (message) => {
        socketService.handleChatMessage(socket, message);
    });
    
    // 5. Disconnect
    socket.on('disconnect', () => {
        socketService.handleDisconnect(socket);
    });
});

// ===== START SERVER =====
server.listen(config.PORT, config.HOST, () => {
    console.log('\n='.repeat(60));
    console.log('🚀 SUDOKU SERVER STARTED');
    console.log('='.repeat(60));
    console.log(`📍 Local:   http://localhost:${config.PORT}`);
    console.log(`🌐 Network: http://10.216.72.91:${config.PORT}`);
    console.log('='.repeat(60));
    console.log('✅ Express server running');
    console.log('✅ Socket.io initialized');
    console.log('✅ Database cache enabled');
    console.log('='.repeat(60) + '\n');
});
