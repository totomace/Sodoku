const bcrypt = require('bcrypt');
const DatabaseService = require('../services/database.service');

class AuthController {
    static async register(req, res) {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Vui lòng nhập đủ thông tin' 
            });
        }
        
        const db = DatabaseService.readDB();
        
        if (db.users.find(user => user.username === username)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tên đăng nhập đã tồn tại' 
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { 
            id: Date.now().toString(), 
            username, 
            password: hashedPassword 
        };
        
        db.users.push(newUser);
        DatabaseService.writeDB(db);
        
        res.status(201).json({ 
            success: true, 
            message: 'Đăng ký thành công' 
        });
    }

    static async login(req, res) {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Vui lòng nhập đủ thông tin' 
            });
        }
        
        const db = DatabaseService.readDB();
        const user = db.users.find(u => u.username === username);
        
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tên đăng nhập hoặc mật khẩu sai' 
            });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (isMatch) {
            res.status(200).json({ 
                success: true, 
                message: 'Đăng nhập thành công' 
            });
        } else {
            res.status(400).json({ 
                success: false, 
                message: 'Tên đăng nhập hoặc mật khẩu sai' 
            });
        }
    }
}

module.exports = AuthController;
