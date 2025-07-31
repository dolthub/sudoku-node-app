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

// Get sudoku board for a specific branch
app.get('/api/board/:branch', async (req, res) => {
  try {
    const branch = req.params.branch;
    const board = await db.getSudokuBoard(branch);
    
    if (!board) {
      return res.status(404).json({ 
        error: 'No board found for this branch',
        branch: branch
      });
    }
    
    res.json(board);
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sudoku board for default branch (main)
app.get('/api/board', async (req, res) => {
  try {
    const board = await db.getSudokuBoard('main');
    
    if (!board) {
      return res.status(404).json({ 
        error: 'No board found for this branch',
        branch: 'main'
      });
    }
    
    res.json(board);
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new sudoku board for a branch
app.post('/api/board/:branch', async (req, res) => {
  try {
    const branch = req.params.branch;
    const { board } = req.body;
    
    if (!board || !Array.isArray(board) || board.length !== 9) {
      return res.status(400).json({ 
        error: 'Invalid board data. Expected 9x9 array.' 
      });
    }
    
    const boardId = await db.createSudokuBoard(branch, board);
    res.status(201).json({ 
      id: boardId, 
      branch: branch,
      message: 'Board created successfully' 
    });
  } catch (error) {
    console.error('Error creating board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all available branches
app.get('/api/branches', async (req, res) => {
  try {
    const branches = await db.getAllBranches();
    res.json({ branches });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/health`);
});