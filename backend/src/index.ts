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
      board: gameBoard.board,
      errors: gameBoard.errors
    });
  } catch (error) {
    console.error('Error fetching game board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a specific cell in the game board
app.put('/api/games/:branch/cell', async (req, res) => {
  try {
    const branch = req.params.branch;
    const { row, col, value } = req.body;
    
    if (typeof row !== 'number' || typeof col !== 'number' || typeof value !== 'number') {
      return res.status(400).json({ 
        error: 'Invalid data. Expected row, col, and value as numbers.' 
      });
    }
    
    if (row < 1 || row > 9 || col < 1 || col > 9) {
      return res.status(400).json({ 
        error: 'Row and column must be between 1 and 9.' 
      });
    }
    
    if (value < 0 || value > 9) {
      return res.status(400).json({ 
        error: 'Value must be between 0 (empty) and 9.' 
      });
    }
    
    await db.updateGameCell(branch, row, col, value);
    res.json({ 
      branch,
      row,
      col,
      value,
      message: 'Cell updated successfully' 
    });
  } catch (error) {
    console.error('Error updating game cell:', error);
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


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/health`);
});