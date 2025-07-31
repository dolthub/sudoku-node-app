-- Create sudoku_games database
CREATE DATABASE IF NOT EXISTS sudoku_games;
USE sudoku_games;

-- The main branch contains no game tables
-- Each game branch will have its own sudoku_cells table created dynamically
-- This keeps the main branch clean and only used for branch management