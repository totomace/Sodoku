// Cấu hình hệ thống
module.exports = {
    // Server
    PORT: process.env.PORT || 3000,
    HOST: '0.0.0.0',
    
    // Database
    DB_FILE: './data/db.json',
    PUZZLE_FILE: './data/puzzles.json',
    
    // Cache
    CACHE_TTL: 5000, // 5 giây
    
    // Game settings
    STARTING_SCORE: 1000,
    DEFAULT_TURN_TIME: 30, // giây
    DEFAULT_TIMEOUT_PENALTY: 50,
    DEFAULT_MISTAKE_PENALTY: 100,
    
    // Cleanup
    GAME_TIMEOUT: 15 * 60 * 1000, // 15 phút
    CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 phút
    
    // History
    MAX_HISTORY_PER_USER: 100,
    MAX_HISTORY_RESPONSE: 50,
    
    // Socket.io
    SOCKET_PING_TIMEOUT: 60000,
    SOCKET_PING_INTERVAL: 25000,
    
    // Broadcast throttle
    BROADCAST_THROTTLE: 100, // ms
    
    // Request limits
    REQUEST_SIZE_LIMIT: '10kb',
    STATIC_CACHE_MAX_AGE: '1d'
};
