require('dotenv').config();
const { Pool } = require('pg');

// Cấu hình kết nối PostgreSQL với pool tối ưu
const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'sudoku_game',
    password: process.env.PGPASSWORD || 'postgres',
    port: parseInt(process.env.PGPORT) || 5432,
    // Tối ưu hóa connection pool
    max: 50, // Tăng số kết nối tối đa
    min: 10, // Giữ 10 kết nối luôn sẵn sàng
    idleTimeoutMillis: 30000, // Đóng kết nối idle sau 30s
    connectionTimeoutMillis: 5000, // Timeout khi tạo kết nối mới
    maxUses: 7500, // Tái sử dụng kết nối tối đa 7500 lần
    allowExitOnIdle: false // Không thoát khi idle
});

// Test connection
async function connectDB() {
    try {
        const client = await pool.connect();
        console.log('✅ Đã kết nối PostgreSQL thành công!');
        client.release();
        
        // Tạo tables
        await createTables();
        
        return pool;
    } catch (error) {
        console.error('❌ Lỗi kết nối PostgreSQL:', error.message);
        console.log('\n💡 Hướng dẫn:');
        console.log('1. Cài PostgreSQL: https://www.postgresql.org/download/');
        console.log('2. Hoặc dùng cloud miễn phí:');
        console.log('   - Neon: https://neon.tech (PostgreSQL serverless)');
        console.log('   - Supabase: https://supabase.com');
        console.log('   - Render: https://render.com\n');
        throw error;
    }
}

// Tạo bảng
async function createTables() {
    const client = await pool.connect();
    try {
        // Bảng users
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Bảng game_history
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_history (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                mode VARCHAR(20) NOT NULL,
                score INTEGER NOT NULL,
                mistakes INTEGER DEFAULT 0,
                opponent VARCHAR(50),
                result VARCHAR(10),
                reason TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Index để tăng performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_username ON game_history(username);
            CREATE INDEX IF NOT EXISTS idx_date ON game_history(date DESC);
        `);
        
        console.log('✅ Đã tạo tables và indexes');
    } catch (error) {
        console.error('Lỗi tạo tables:', error.message);
    } finally {
        client.release();
    }
}

// Đóng kết nối
async function closeDB() {
    await pool.end();
    console.log('Đã đóng kết nối PostgreSQL');
}

// === USER OPERATIONS ===

async function findUser(username) {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Lỗi findUser:', error.message);
        return null;
    }
}

async function createUser(username, password) {
    try {
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
            [username, password]
        );
        return result.rows[0];
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            throw new Error('Username đã tồn tại');
        }
        throw error;
    }
}

async function getAllUsers() {
    try {
        const result = await pool.query('SELECT id, username, created_at FROM users');
        return result.rows;
    } catch (error) {
        console.error('Lỗi getAllUsers:', error.message);
        return [];
    }
}

// === GAME HISTORY OPERATIONS ===

async function addGameHistory(historyData) {
    try {
        const { username, mode, score, mistakes, opponent, result: gameResult, reason, date } = historyData;
        const queryResult = await pool.query(
            `INSERT INTO game_history 
            (username, mode, score, mistakes, opponent, result, reason, date) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING *`,
            [
                username, 
                mode, 
                score, 
                mistakes || 0, 
                opponent || null, 
                gameResult || null, 
                reason || null,
                date || new Date()
            ]
        );
        return queryResult.rows[0];
    } catch (error) {
        console.error('Lỗi addGameHistory:', error.message);
        throw error;
    }
}

async function getGameHistory(username, limit = 50) {
    try {
        const result = await pool.query(
            'SELECT * FROM game_history WHERE username = $1 ORDER BY date DESC LIMIT $2',
            [username, limit]
        );
        return result.rows;
    } catch (error) {
        console.error('Lỗi getGameHistory:', error.message);
        return [];
    }
}

async function getAllGameHistory(limit = 100) {
    try {
        const result = await pool.query(
            'SELECT * FROM game_history ORDER BY date DESC LIMIT $1',
            [limit]
        );
        return result.rows;
    } catch (error) {
        console.error('Lỗi getAllGameHistory:', error.message);
        return [];
    }
}

// === LEADERBOARD ===

async function getLeaderboard(mode = 'PvP', limit = 10) {
    try {
        const result = await pool.query(
            `SELECT 
                username,
                COUNT(*) FILTER (WHERE result = 'win') as total_wins,
                ROUND(AVG(score)) as avg_score,
                MAX(score) as best_score,
                COUNT(*) as total_games
            FROM game_history 
            WHERE mode = $1
            GROUP BY username 
            ORDER BY total_wins DESC, avg_score DESC 
            LIMIT $2`,
            [mode, limit]
        );
        return result.rows;
    } catch (error) {
        console.error('Lỗi getLeaderboard:', error.message);
        return [];
    }
}

// === MIGRATION: Import từ JSON ===

async function migrateFromJSON(jsonData) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Import users
        if (jsonData.users && jsonData.users.length > 0) {
            for (const user of jsonData.users) {
                await client.query(
                    'INSERT INTO users (username, password) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
                    [user.username, user.password]
                );
            }
            console.log(`✅ Đã import ${jsonData.users.length} users`);
        }
        
        // Import game history
        if (jsonData.gameHistory && jsonData.gameHistory.length > 0) {
            for (const game of jsonData.gameHistory) {
                await client.query(
                    `INSERT INTO game_history 
                    (username, mode, score, mistakes, opponent, result, reason, date) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        game.username,
                        game.mode,
                        game.score,
                        game.mistakes || 0,
                        game.opponent || null,
                        game.result || null,
                        game.reason || null,
                        game.date || new Date()
                    ]
                );
            }
            console.log(`✅ Đã import ${jsonData.gameHistory.length} game history records`);
        }
        
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Lỗi migration:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    connectDB,
    createTables,
    closeDB,
    findUser,
    createUser,
    getAllUsers,
    addGameHistory,
    getGameHistory,
    getAllGameHistory,
    getLeaderboard,
    migrateFromJSON,
    pool
};
