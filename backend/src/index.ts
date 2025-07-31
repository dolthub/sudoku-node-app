import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Database from './database';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const db = new Database();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Create a new game (creates Dolt branch)
app.post('/api/games', async (req, res) => {
  try {
    const { gameName } = req.body;
    
    if (!gameName || typeof gameName !== 'string' || gameName.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Game name is required and must be a non-empty string' 
      });
    }
    
    const result = await db.createGame(gameName.trim());
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get game board for a specific branch
app.get('/api/games/:branch/board', async (req, res) => {
  try {
    const branch = req.params.branch;
    const gameBoard = await db.getGameBoard(branch);
    
    if (!gameBoard) {
      return res.status(404).json({ 
        error: 'No game found for this branch',
        branch: branch
      });
    }
    
    res.json({
      branch,
      game_name: gameBoard.game_name,
      board: gameBoard.board_state,
      initial_board: gameBoard.initial_board,
      created_at: gameBoard.created_at
    });
  } catch (error) {
    console.error('Error fetching game board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update game board state
app.put('/api/games/:branch/board', async (req, res) => {
  try {
    const branch = req.params.branch;
    const { board } = req.body;
    
    if (!board || !Array.isArray(board) || board.length !== 9) {
      return res.status(400).json({ 
        error: 'Invalid board data. Expected 9x9 array.' 
      });
    }
    
    await db.updateGameBoard(branch, board);
    res.json({ 
      branch,
      message: 'Game board updated successfully' 
    });
  } catch (error) {
    console.error('Error updating game board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all available games
app.get('/api/games', async (req, res) => {
  try {
    const games = await db.getAllGames();
    res.json({ games });
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy endpoint for backward compatibility
app.get('/api/board/:branch', async (req, res) => {
  try {
    const branch = req.params.branch;
    const gameBoard = await db.getGameBoard(branch);
    
    if (!gameBoard) {
      return res.status(404).json({ 
        error: 'No game found for this branch',
        branch: branch
      });
    }
    
    // Return in old format for compatibility
    res.json({
      id: gameBoard.id,
      branch: branch,
      board: gameBoard.board_state,
      created_at: gameBoard.created_at
    });
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/health`);
});