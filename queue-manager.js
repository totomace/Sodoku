const Queue = require('bull');
const { createUser } = require('./postgres');

// Tạo queue cho registration
const registrationQueue = new Queue('user-registration', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
    },
    settings: {
        // Xử lý tối đa 10 jobs cùng lúc
        maxStalledCount: 3,
        retryProcessDelay: 5000
    }
});

// Xử lý registration jobs
registrationQueue.process(10, async (job) => {
    const { username, password } = job.data;
    
    try {
        console.log(`📝 Processing registration: ${username}`);
        await createUser(username, password);
        console.log(`✅ Registered: ${username}`);
        return { success: true, username };
    } catch (error) {
        console.error(`❌ Failed to register ${username}:`, error.message);
        throw error;
    }
});

// Event listeners
registrationQueue.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed: ${result.username}`);
});

registrationQueue.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
});

registrationQueue.on('stalled', (job) => {
    console.warn(`⚠️ Job ${job.id} stalled`);
});

// Function to add registration to queue
async function addRegistration(username, password) {
    const job = await registrationQueue.add(
        { username, password },
        {
            attempts: 3, // Retry 3 lần nếu fail
            backoff: {
                type: 'exponential',
                delay: 2000 // Delay 2s, 4s, 8s
            },
            removeOnComplete: true, // Xóa job sau khi xong
            removeOnFail: false // Giữ lại failed jobs để debug
        }
    );
    
    return job;
}

// Function to get queue stats
async function getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        registrationQueue.getWaitingCount(),
        registrationQueue.getActiveCount(),
        registrationQueue.getCompletedCount(),
        registrationQueue.getFailedCount(),
        registrationQueue.getDelayedCount()
    ]);
    
    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
    };
}

// Function to clear all jobs
async function clearQueue() {
    await registrationQueue.empty();
    await registrationQueue.clean(0, 'completed');
    await registrationQueue.clean(0, 'failed');
    console.log('🧹 Queue cleared!');
}

// Graceful shutdown
async function closeQueue() {
    await registrationQueue.close();
    console.log('👋 Queue closed');
}

module.exports = {
    registrationQueue,
    addRegistration,
    getQueueStats,
    clearQueue,
    closeQueue
};
