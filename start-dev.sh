#!/bin/bash

# Development startup script for Sudoku Game
# This script will start all three tiers of the application

set -e

echo "🎯 Starting Sudoku Game Development Environment"
echo "=============================================="

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $port is already in use"
        return 1
    fi
    return 0
}

# Function to start processes in background
start_service() {
    local name=$1
    local command=$2
    local directory=$3
    
    echo "🚀 Starting $name..."
    if [ -n "$directory" ]; then
        # Use subshell to avoid changing current directory
        (cd "$directory" && eval "$command") &
    else
        eval "$command" &
    fi
    
    local pid=$!
    echo "   Started $name with PID $pid"
    echo $pid >> /tmp/sudoku_pids.txt
    
    sleep 2
}

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    if [ -f /tmp/sudoku_pids.txt ]; then
        while read pid; do
            if kill -0 $pid 2>/dev/null; then
                echo "   Stopping process $pid"
                kill $pid
            fi
        done < /tmp/sudoku_pids.txt
        rm -f /tmp/sudoku_pids.txt
    fi
    echo "   All services stopped"
}

# Set up signal handling
trap cleanup EXIT INT TERM

# Clear any existing PID file
rm -f /tmp/sudoku_pids.txt

# Check if required ports are available
check_port 3306 || echo "   (Dolt SQL server port - will attempt to start anyway)"
check_port 3001 || { echo "   Backend port occupied. Please free port 3001"; exit 1; }
check_port 3000 || { echo "   Frontend port occupied. Please free port 3000"; exit 1; }

echo ""
echo "📊 1. Starting Dolt SQL Server..."

# Check if Dolt is installed (required for this demo)
if ! command -v dolt >/dev/null 2>&1; then
    echo "   ❌ ERROR: Dolt is required for this demo but not found in PATH"
    echo "   Please install Dolt from: https://github.com/dolthub/dolt"
    echo "   Installation instructions: https://docs.dolthub.com/introduction/installation"
    exit 1
fi

echo "   ✅ Dolt found - starting SQL server..."
start_service "Dolt SQL Server" "./database/start-dolt-server.sh" "$(pwd)"

echo ""
echo "🔧 2. Starting Backend Server..."
start_service "Backend Server" "npm run dev" "$(pwd)/backend"

echo ""
echo "⚛️  3. Starting Frontend Server..."
start_service "Frontend Server" "BROWSER=none npm start" "$(pwd)/frontend"

echo ""
echo "✅ All services started!"
echo ""
echo "🌐 Application URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   Health:   http://localhost:3001/health"
echo "   Database: localhost:3306 (Dolt SQL)"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait