-- Create sudoku_games database
CREATE DATABASE IF NOT EXISTS sudoku_games;
USE sudoku_games;

-- Create game_board table (one board per branch)
CREATE TABLE IF NOT EXISTS game_board (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_name VARCHAR(255) NOT NULL,
    board_state JSON NOT NULL,
    initial_board JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_game (game_name)
);

-- Insert a default game on main branch
INSERT INTO game_board (game_name, board_state, initial_board) VALUES 
('default_game', 
 '[[5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],[8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],[0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]]',
 '[[5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],[8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],[0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]]')
ON DUPLICATE KEY UPDATE 
    board_state = VALUES(board_state), 
    initial_board = VALUES(initial_board);