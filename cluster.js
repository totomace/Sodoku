const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster) {
    const numCPUs = os.cpus().length;
    const numWorkers = Math.min(numCPUs, 4); // Tối đa 4 workers
    
    console.log(`🚀 Master process ${process.pid} starting...`);
    console.log(`💻 CPU cores: ${numCPUs}`);
    console.log(`👷 Starting ${numWorkers} workers...`);
    
    // Fork workers
    for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`❌ Worker ${worker.process.pid} died (${signal || code})`);
        console.log('🔄 Starting new worker...');
        cluster.fork();
    });
    
    cluster.on('online', (worker) => {
        console.log(`✅ Worker ${worker.process.pid} is online`);
    });
    
} else {
    // Worker process - chạy server
    require('./server.js');
}
