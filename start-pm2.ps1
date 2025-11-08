# Start server with PM2 in production mode
pm2 start ecosystem.config.js --env production

# Show status
pm2 status

# Show logs
pm2 logs sudoku-server --lines 50
