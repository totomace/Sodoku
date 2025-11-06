// Các hàm tiện ích
class Helpers {
    static stringToBoard(str) {
        let board = [];
        for (let r = 0; r < 9; r++) {
            board.push(str.substring(r * 9, r * 9 + 9).split('').map(Number));
        }
        return board;
    }

    static calculateScore(startingScore, mistakes, mistakePenalty = 100) {
        return Math.max(0, startingScore - (mistakes * mistakePenalty));
    }

    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    static getSocketRoom(socket) {
        const rooms = Array.from(socket.rooms);
        return rooms[1];
    }
}

module.exports = Helpers;
