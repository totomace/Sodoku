module.exports = {
  apps: [{
    name: 'sudoku-server',
    script: './server.js',
    instances: 4, // Số workers (hoặc dùng 'max' để tự động)
    exec_mode: 'cluster', // Cluster mode
    watch: false, // Không tự động restart khi file thay đổi (production)
    max_memory_restart: '500M', // Restart nếu vượt quá 500MB RAM
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_test: {
      NODE_ENV: 'test',
      PORT: 3000
    },
    // Các tùy chọn restart
    autorestart: true, // Tự động restart khi crash
    max_restarts: 10, // Tối đa 10 lần restart
    min_uptime: '10s', // Phải chạy ít nhất 10s mới tính là stable
    restart_delay: 4000, // Delay 4s trước khi restart
    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Load balancing
    listen_timeout: 10000, // Timeout 10s cho listen
    kill_timeout: 5000, // Timeout 5s khi kill process
  }]
};
