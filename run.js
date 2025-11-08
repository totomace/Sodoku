#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');

console.log('🚀 SUDOKU SERVER LAUNCHER\n');

// Hàm check service
function checkService(command, serviceName) {
    return new Promise((resolve) => {
        exec(command, (error, stdout) => {
            const isRunning = stdout && stdout.includes('RUNNING');
            console.log(`[${isRunning ? '✅' : '❌'}] ${serviceName}: ${isRunning ? 'Running' : 'Stopped'}`);
            resolve(isRunning);
        });
    });
}

// Hàm start service
function startService(command, serviceName) {
    return new Promise((resolve) => {
        console.log(`⏳ Starting ${serviceName}...`);
        exec(command, (error) => {
            if (error) {
                console.log(`❌ Failed to start ${serviceName}: ${error.message}`);
                resolve(false);
            } else {
                console.log(`✅ ${serviceName} started`);
                resolve(true);
            }
        });
    });
}

// Hàm check port
function checkPort(port) {
    return new Promise((resolve) => {
        const cmd = `powershell -Command "Test-NetConnection -ComputerName localhost -Port ${port} -InformationLevel Quiet"`;
        exec(cmd, (error, stdout) => {
            resolve(stdout.trim() === 'True');
        });
    });
}

// Main function
async function main() {
    console.log('📋 Checking dependencies...\n');
    
    // 1. Check PostgreSQL
    const pgRunning = await checkService('sc query postgresql-x64-16', 'PostgreSQL');
    if (!pgRunning) {
        await startService('net start postgresql-x64-16', 'PostgreSQL');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 2. Check Redis
    console.log('\n🔍 Checking Redis...');
    let redisRunning = await checkPort(6379);
    
    if (!redisRunning) {
        console.log('❌ Redis: Stopped');
        console.log('⏳ Starting Redis server...');
        
        // Tìm redis-server.exe
        const fs = require('fs');
        const possiblePaths = [
            'C:\\Data\\Download\\dự phòng\\Sodoku\\redis\\redis-server.exe',
            'C:\\Program Files\\Redis\\redis-server.exe',
            'C:\\Redis\\redis-server.exe',
            process.cwd() + '\\redis\\redis-server.exe'
        ];
        
        let redisPath = 'redis-server'; // Default nếu có trong PATH
        for (const testPath of possiblePaths) {
            if (fs.existsSync(testPath)) {
                redisPath = testPath;
                break;
            }
        }
        
        // Start Redis
        try {
            const redisProcess = spawn(redisPath, [], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true
            });
            
            redisProcess.unref();
            
            // Đợi Redis khởi động
            console.log('⏳ Waiting for Redis to initialize');
            for (let i = 0; i < 15; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                redisRunning = await checkPort(6379);
                if (redisRunning) {
                    console.log('✅ Redis: Started successfully');
                    break;
                }
                process.stdout.write('.');
                
                if (i === 14) {
                    console.log('\n\n❌ Failed to start Redis!');
                    console.log('Please start manually: redis-server\n');
                    process.exit(1);
                }
            }
        } catch (error) {
            console.log('\n❌ Error starting Redis:', error.message);
            console.log('Please start manually: redis-server\n');
            process.exit(1);
        }
    } else {
        console.log('✅ Redis: Running');
    }
    
    // 3. Start PM2
    console.log('\n📦 Starting PM2...');
    const pm2Process = spawn('pm2', ['start', 'ecosystem.config.js'], {
        stdio: 'inherit',
        shell: true
    });
    
    pm2Process.on('close', (code) => {
        if (code === 0) {
            console.log('\n✅ Server started successfully!\n');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎮 SUDOKU MULTIPLAYER GAME SERVER');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📡 Local:   http://localhost:3000');
            console.log('🌐 Network: http://10.216.72.91:3000');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            console.log('Commands:');
            console.log('  pm2 logs       - View logs');
            console.log('  pm2 status     - Check status');
            console.log('  pm2 restart    - Restart server');
            console.log('  pm2 stop all   - Stop server\n');
            
            // Show logs
            const logsProcess = spawn('pm2', ['logs'], {
                stdio: 'inherit',
                shell: true
            });
        } else {
            console.log(`\n❌ Failed to start server (exit code: ${code})`);
            process.exit(1);
        }
    });
}

// Run
main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});
