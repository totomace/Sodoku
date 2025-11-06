const DatabaseService = require('../services/database.service');
const config = require('../config/constants');

class GameController {
    static saveGame(req, res) {
        const { username, mode, score } = req.body;
        
        if (!username || !mode || score === undefined) {
            return res.status(400).json({ 
                success: false, 
                message: 'Thiếu thông tin game' 
            });
        }
        
        const db = DatabaseService.readDB();
        const newGame = {
            username: username,
            mode: mode,
            score: score,
            date: new Date().toISOString()
        };
        
        db.gameHistory.push(newGame);
        
        // Giới hạn lịch sử
        const MAX_TOTAL = config.MAX_HISTORY_PER_USER * 2;
        db.gameHistory = db.gameHistory.slice(-MAX_TOTAL);
        
        DatabaseService.writeDB(db);
        
        res.status(201).json({ 
            success: true, 
            message: 'Đã lưu kết quả' 
        });
    }

    static getHistory(req, res) {
        const { username } = req.params;
        const db = DatabaseService.readDB();
        
        // Tối ưu: lọc và giới hạn
        const userHistory = db.gameHistory
            .filter(game => game.username.toLowerCase() === username.toLowerCase())
            .slice(-config.MAX_HISTORY_RESPONSE);
        
        res.status(200).json({ 
            success: true, 
            data: userHistory 
        });
    }
}

module.exports = GameController;
