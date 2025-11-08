#!/bin/bash

echo "🚀 Starting Sudoku Game Server (Production Mode)"
echo "================================================"

# Kill existing processes
echo "🔄 Stopping existing processes..."
pkill -f "node server.js"
pkill -f "node cluster.js"

# Start Redis if not running
if ! pgrep -x "redis-server" > /dev/null
then
    echo "🔴 Starting Redis..."
    redis/redis-server.exe --daemonize yes
fi

# Check PostgreSQL
echo "🔍 Checking PostgreSQL..."
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1
then
    echo "❌ PostgreSQL is not running!"
    echo "Please start PostgreSQL service first"
    exit 1
fi

# Start server in cluster mode
echo "🌐 Starting server in cluster mode..."
NODE_ENV=production node cluster.js

echo "✅ Server started successfully!"
echo "📊 Access: http://localhost:3000"
echo "🏥 Health check: http://localhost:3000/health"
