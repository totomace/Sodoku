require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const bcrypt = require('bcrypt');

const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'sudoku_game',
    password: process.env.PGPASSWORD || 'postgres',
    port: parseInt(process.env.PGPORT) || 5432,
});

async function migrate() {
    try {
        console.log('🔄 Bắt đầu migrate dữ liệu...');
        
        // Đọc file db.json
        const data = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
        
        console.log(`📊 Tìm thấy:`);
        console.log(`  - ${data.users.length} users`);
        console.log(`  - ${data.gameHistory.length} game history records`);
        
        // Import users
        let userCount = 0;
        for (const user of data.users) {
            try {
                // Check if user exists
                const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [user.username]);
                
                if (existingUser.rows.length === 0) {
                    await pool.query(
                        'INSERT INTO users (username, password) VALUES ($1, $2)',
                        [user.username, user.password]
                    );
                    userCount++;
                    console.log(`  ✓ Imported user: ${user.username}`);
                } else {
                    console.log(`  ⊙ User already exists: ${user.username}`);
                }
            } catch (error) {
                console.error(`  ✗ Error importing user ${user.username}:`, error.message);
            }
        }
        
        // Import game history
        let historyCount = 0;
        for (const game of data.gameHistory) {
            try {
                await pool.query(
                    'INSERT INTO game_history (username, mode, score, mistakes, opponent, result, reason, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                    [game.username, game.mode, game.score, game.mistakes || 0, game.opponent, game.result, game.reason, game.date]
                );
                historyCount++;
            } catch (error) {
                console.error(`  ✗ Error importing game history:`, error.message);
            }
        }
        
        console.log(`\n✅ Migrate hoàn tất!`);
        console.log(`  - Imported ${userCount} new users`);
        console.log(`  - Imported ${historyCount} game history records`);
        
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi migrate:', error);
        process.exit(1);
    }
}

migrate();
