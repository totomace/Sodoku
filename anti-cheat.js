// Anti-cheat system
class AntiCheat {
    constructor() {
        this.suspiciousActivities = new Map();
        this.bannedUsers = new Set();
    }

    // Kiểm tra tốc độ đi nước bất thường
    checkMoveSpeed(socketId, timestamp) {
        const key = `moves:${socketId}`;
        
        if (!this.suspiciousActivities.has(key)) {
            this.suspiciousActivities.set(key, { timestamps: [timestamp], violations: 0 });
            return true;
        }
        
        const data = this.suspiciousActivities.get(key);
        data.timestamps.push(timestamp);
        
        // Giữ lại 10 nước đi gần nhất
        if (data.timestamps.length > 10) {
            data.timestamps.shift();
        }
        
        // Kiểm tra nếu có nhiều hơn 5 nước đi trong 2 giây
        const recentMoves = data.timestamps.filter(t => timestamp - t < 2000);
        if (recentMoves.length > 5) {
            data.violations++;
            console.log(`⚠️ Suspicious activity detected: ${socketId} - Too fast moves`);
            
            if (data.violations >= 3) {
                this.bannedUsers.add(socketId);
                return false;
            }
        }
        
        return true;
    }

    // Kiểm tra pattern đi nước (bot detection)
    checkMovePattern(socketId, moves) {
        // Kiểm tra nếu tất cả nước đi đều đúng (100% accuracy)
        if (moves.length > 20) {
            const correctMoves = moves.filter(m => m.correct).length;
            const accuracy = correctMoves / moves.length;
            
            if (accuracy === 1.0) {
                console.log(`⚠️ Suspicious activity: ${socketId} - 100% accuracy (possible bot)`);
                return false;
            }
        }
        
        return true;
    }

    // Kiểm tra xem user có bị ban không
    isBanned(socketId) {
        return this.bannedUsers.has(socketId);
    }

    // Xóa dữ liệu sau khi game kết thúc
    cleanup(socketId) {
        this.suspiciousActivities.delete(`moves:${socketId}`);
    }

    // Unban user sau 1 giờ
    scheduleBanRemoval(socketId) {
        setTimeout(() => {
            this.bannedUsers.delete(socketId);
            console.log(`✅ Unbanned user: ${socketId}`);
        }, 60 * 60 * 1000); // 1 giờ
    }
}

module.exports = new AntiCheat();
