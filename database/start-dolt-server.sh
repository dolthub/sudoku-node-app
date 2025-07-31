#!/bin/bash

# Script to start Dolt SQL server for the Sudoku game
# This assumes Dolt is installed and available in PATH

set -e

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

# Add and commit initial data
echo "Committing initial data..."
dolt add .
dolt commit -m "Initial sudoku boards setup"

# Start the SQL server
echo "Starting Dolt SQL server on port 3306..."
echo "Server will be available at localhost:3306"
echo "Use Ctrl+C to stop the server"

exec dolt sql-server --host 0.0.0.0 --port 3306 --user root --password "" --loglevel=debug