import React, { useState, useEffect } from 'react';
import SudokuBoard from './components/SudokuBoard';
import './App.css';

interface SudokuBoardData {
  id: number;
  branch: string;
  board: number[][];
  created_at: string;
}

function App() {
  const [board, setBoard] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('main');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchBranches();
    fetchBoard(selectedBranch);
  }, [selectedBranch]);

  const fetchBranches = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/branches`);
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches);
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    }
  };

  const fetchBoard = async (branch: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/api/board/${branch}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch board: ${response.statusText}`);
      }
      
      const data: SudokuBoardData = await response.json();
      setBoard(data.board);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board');
      // Fallback to sample board
      const sampleBoard = [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9]
      ];
      setBoard(sampleBoard);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="App">Loading...</div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Sudoku Game</h1>
        <p>Choose a game branch to play</p>
      </header>
      <main>
        {error && (
          <div className="error-message">
            <p>⚠️ {error}</p>
            <p>Showing sample board instead</p>
          </div>
        )}
        
        <div className="branch-selector">
          <label htmlFor="branch-select">Game Branch: </label>
          <select 
            id="branch-select"
            value={selectedBranch} 
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            {branches.length > 0 ? (
              branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))
            ) : (
              <option value="main">main</option>
            )}
          </select>
        </div>
        
        <SudokuBoard board={board} />
      </main>
    </div>
  );
}

export default App;
