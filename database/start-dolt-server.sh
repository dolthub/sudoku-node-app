#!/bin/bash

# Script to start Dolt SQL server for the Sudoku game
# This assumes Dolt is installed and available in PATH

set -e

# Add user bin to PATH for Dolt
export PATH="$HOME/bin:$PATH"

echo "Starting Dolt SQL server for Sudoku game..."

# Create and change to database directory
mkdir -p "$(dirname "$0")/dolt-data"
cd "$(dirname "$0")/dolt-data"

# Initialize Dolt repo if it doesn't exist
if [ ! -d ".dolt" ]; then
    echo "Initializing Dolt repository..."
    dolt init
    dolt config --local --add user.email "sudoku@example.com"
    dolt config --local --add user.name "Sudoku Game"
fi

# Create database and tables if they don't exist
echo "Setting up database schema..."
dolt sql < ../init-schema.sql

# Add and commit initial data if there are changes
echo "Checking for changes to commit..."
dolt add .
if [ "$(dolt sql -q "SELECT COUNT(*) FROM dolt_status" -r csv | tail -n 1)" != "0" ]; then
    echo "Committing initial data..."
    dolt commit -m "Initial sudoku boards setup"
else
    echo "No changes to commit - data already exists"
fi

# Start the SQL server
echo "Starting Dolt SQL server on port 3306..."
echo "Server will be available at localhost:3306"
echo "Use Ctrl+C to stop the server"

exec dolt sql-server --host 0.0.0.0 --port 3306 --loglevel=debug