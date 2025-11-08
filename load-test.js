const io = require('socket.io-client');
const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';
const NUM_USERS = 10000; // Test với 10,000 bots 🔥
const MIN_LOGIN_DELAY = 100; // Delay tối thiểu giữa các đăng nhập (ms)
const MAX_LOGIN_DELAY = 5000; // Delay tối đa giữa các đăng nhập (ms) - 5 giây
const RECONNECT_INTERVAL = 5000; // 5 giây
const REQUEST_DELAY = 50; // Delay giữa các request (giảm xuống 50ms)

// Thống kê
const stats = {
    registered: 0,
    connected: 0,
    inWaiting: 0,
    inGame: 0,
    disconnected: 0,
    errors: 0,
    gamesStarted: 0,
    gamesCompleted: 0
};

// Danh sách bots
const bots = [];

// Tạo 1 bot user
class Bot {
    constructor(id) {
        this.id = id;
        this.username = `bot${id}`;
        this.password = '123456';
        this.socket = null;
        this.status = 'created';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    async register() {
        try {
            const response = await axios.post(`${SERVER_URL}/api/register`, {
                username: this.username,
                password: this.password
            });
            
            if (response.data.success) {
                this.status = 'registered';
                stats.registered++;
                return true;
            }
        } catch (error) {
            if (error.response && error.response.data.message.includes('đã tồn tại')) {
                // User đã tồn tại, bỏ qua
                this.status = 'registered';
                return true;
            }
            console.error(`Bot ${this.id}: Lỗi đăng ký - ${error.message}`);
            stats.errors++;
            return false;
        }
    }

    async login() {
        try {
            const response = await axios.post(`${SERVER_URL}/api/login`, {
                username: this.username,
                password: this.password
            });
            
            if (response.data.success) {
                return true;
            }
        } catch (error) {
            console.error(`Bot ${this.id}: Lỗi đăng nhập - ${error.message}`);
            stats.errors++;
            return false;
        }
    }

    connect() {
        this.socket = io(SERVER_URL, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: this.maxReconnectAttempts
        });

        this.socket.on('connect', () => {
            this.status = 'connected';
            stats.connected++;
            this.reconnectAttempts = 0;
            
            // Đăng ký username
            this.socket.emit('registerUser', this.username);
            
            // Tự động tìm trận sau 1-3 giây
            setTimeout(() => {
                if (this.status === 'connected') {
                    this.findMatch();
                }
            }, Math.random() * 2000 + 1000);
        });

        this.socket.on('disconnect', () => {
            const prevStatus = this.status;
            this.status = 'disconnected';
            
            if (prevStatus === 'connected') stats.connected--;
            else if (prevStatus === 'waiting') stats.inWaiting--;
            else if (prevStatus === 'playing') stats.inGame--;
            
            stats.disconnected++;
            
            // Tự động reconnect
            this.reconnectAttempts++;
            if (this.reconnectAttempts <= this.maxReconnectAttempts) {
                setTimeout(() => {
                    this.connect();
                }, RECONNECT_INTERVAL);
            }
        });

        this.socket.on('matchFound', (data) => {
            this.status = 'playing';
            if (stats.inWaiting > 0) stats.inWaiting--;
            stats.inGame++;
            stats.gamesStarted++;
        });

        this.socket.on('gameStart', (data) => {
            // Game bắt đầu
            // Tự động đi nước ngẫu nhiên
            this.autoPlay();
        });

        this.socket.on('gameResult', (data) => {
            this.status = 'connected';
            stats.inGame--;
            stats.gamesCompleted++;
            
            // Sau khi game kết thúc, tìm trận mới
            setTimeout(() => {
                if (this.status === 'connected') {
                    this.findMatch();
                }
            }, Math.random() * 3000 + 2000);
        });

        this.socket.on('error', (error) => {
            stats.errors++;
            console.error(`Bot ${this.id}: Socket error - ${error}`);
        });

        this.socket.on('forceReload', () => {
            // Reload lại
            this.socket.disconnect();
            setTimeout(() => this.connect(), 2000);
        });
    }

    findMatch() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('findMatch', {
                turnTimeLimit: 30,
                timeoutPenalty: 50,
                mistakePenalty: 100
            });
            this.status = 'waiting';
            stats.connected--;
            stats.inWaiting++;
        }
    }

    autoPlay() {
        // Tự động đi nước ngẫu nhiên mỗi 2-5 giây
        if (this.status === 'playing') {
            const interval = setInterval(() => {
                if (this.status !== 'playing') {
                    clearInterval(interval);
                    return;
                }

                const row = Math.floor(Math.random() * 9);
                const col = Math.floor(Math.random() * 9);
                const num = Math.floor(Math.random() * 9) + 1;

                this.socket.emit('makeMove', { row, col, num });

                // Random check game (10% chance)
                if (Math.random() < 0.1) {
                    this.socket.emit('checkGame');
                }

                // Random surrender (1% chance)
                if (Math.random() < 0.01) {
                    this.socket.emit('surrender');
                    clearInterval(interval);
                }
            }, Math.random() * 3000 + 2000);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// Random delay giữa min và max
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Tạo tất cả bots trước
async function createAllBots() {
    console.log(`\n📦 Tạo ${NUM_USERS} bots...`);
    
    for (let i = 0; i < NUM_USERS; i++) {
        const bot = new Bot(i);
        bots.push(bot);
        
        // Đăng ký nhanh (không chờ)
        bot.register().catch(() => {});
        
        // Progress bar mỗi 100 bots
        if ((i + 1) % 100 === 0) {
            console.log(`  ✅ Đã tạo ${i + 1}/${NUM_USERS} bots`);
        }
    }
    
    console.log(`\n✅ Đã tạo xong ${NUM_USERS} bots!`);
    
    // Đợi 2 giây cho đăng ký hoàn tất
    await new Promise(resolve => setTimeout(resolve, 2000));
}

// Đăng nhập ngẫu nhiên (ít khi nhiều)
async function loginBotsRandomly() {
    console.log(`\n🔐 Bắt đầu đăng nhập ngẫu nhiên...`);
    console.log(`   - Delay tối thiểu: ${MIN_LOGIN_DELAY}ms`);
    console.log(`   - Delay tối đa: ${MAX_LOGIN_DELAY}ms (${MAX_LOGIN_DELAY/1000}s)`);
    console.log(`   - Trung bình: ${(MIN_LOGIN_DELAY + MAX_LOGIN_DELAY)/2}ms`);
    
    // Shuffle bots để đăng nhập random
    const shuffledBots = [...bots].sort(() => Math.random() - 0.5);
    
    let loginCount = 0;
    const startTime = Date.now();
    
    for (const bot of shuffledBots) {
        // Đăng nhập
        const loginSuccess = await bot.login();
        
        if (loginSuccess) {
            // Kết nối socket
            bot.connect();
            loginCount++;
            
            // Hiển thị progress mỗi 50 bots
            if (loginCount % 50 === 0) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                const rate = (loginCount / elapsed).toFixed(1);
                console.log(`  ⏳ ${loginCount}/${NUM_USERS} bots đã đăng nhập (${rate} bots/s)`);
            }
        }
        
        // Random delay giữa các lần đăng nhập (ít khi nhiều)
        const delay = randomDelay(MIN_LOGIN_DELAY, MAX_LOGIN_DELAY);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgRate = (loginCount / totalTime).toFixed(1);
    
    console.log(`\n✅ Hoàn thành đăng nhập!`);
    console.log(`   - Tổng thời gian: ${totalTime}s`);
    console.log(`   - Tốc độ trung bình: ${avgRate} bots/s`);
    console.log(`   - Thành công: ${loginCount}/${NUM_USERS} bots`);
}

// Hiển thị thống kê
function displayStats() {
    console.clear();
    console.log('═══════════════════════════════════════════════════════');
    console.log('           🤖 SUDOKU BOT LOAD TEST 🤖');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 Tổng số bots: ${NUM_USERS}`);
    console.log('───────────────────────────────────────────────────────');
    console.log(`✅ Đã đăng ký:     ${stats.registered.toString().padStart(6)} bots`);
    console.log(`🟢 Đang online:    ${stats.connected.toString().padStart(6)} bots`);
    console.log(`⏳ Đang chờ ghép:  ${stats.inWaiting.toString().padStart(6)} bots`);
    console.log(`🎮 Đang chơi:      ${stats.inGame.toString().padStart(6)} bots`);
    console.log(`🔴 Ngắt kết nối:   ${stats.disconnected.toString().padStart(6)} bots`);
    console.log('───────────────────────────────────────────────────────');
    console.log(`🎯 Trận đã bắt đầu:   ${stats.gamesStarted.toString().padStart(6)}`);
    console.log(`✔️  Trận đã kết thúc: ${stats.gamesCompleted.toString().padStart(6)}`);
    console.log(`❌ Lỗi:              ${stats.errors.toString().padStart(6)}`);
    console.log('═══════════════════════════════════════════════════════');
    
    // Hiển thị tỷ lệ
    const totalActive = stats.connected + stats.inWaiting + stats.inGame;
    const percentage = ((totalActive / NUM_USERS) * 100).toFixed(1);
    console.log(`\n📈 Tỷ lệ hoạt động: ${percentage}% (${totalActive}/${NUM_USERS})`);
    
    if (stats.gamesStarted > 0) {
        const completionRate = ((stats.gamesCompleted / stats.gamesStarted) * 100).toFixed(1);
        console.log(`📊 Tỷ lệ hoàn thành game: ${completionRate}%`);
    }
}

// Main
async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('      🚀 SUDOKU LOAD TEST - RANDOM LOGIN 🚀');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📝 Cấu hình:`);
    console.log(`   - Số lượng bots: ${NUM_USERS}`);
    console.log(`   - Server: ${SERVER_URL}`);
    console.log(`   - Login delay: ${MIN_LOGIN_DELAY}-${MAX_LOGIN_DELAY}ms (ngẫu nhiên)`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Bước 1: Tạo tất cả bots và đăng ký
    await createAllBots();
    
    // Bước 2: Đăng nhập ngẫu nhiên (ít khi nhiều)
    await loginBotsRandomly();
    
    console.log('\n📊 Bắt đầu hiển thị thống kê real-time...\n');

    // Cập nhật stats mỗi 2 giây
    const statsInterval = setInterval(displayStats, 2000);
    displayStats();

    // Xử lý Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Đang dừng test...');
        clearInterval(statsInterval);
        bots.forEach(bot => bot.disconnect());
        setTimeout(() => {
            console.log('\n✅ Đã dừng tất cả bots!');
            console.log('\n📊 Thống kê cuối cùng:');
            displayStats();
            process.exit(0);
        }, 2000);
    });
}

main().catch(error => {
    console.error('❌ Lỗi:', error);
    process.exit(1);
});
