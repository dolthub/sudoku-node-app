import React, { useState, useEffect } from 'react';
import SudokuBoard from './components/SudokuBoard';
import './App.css';

interface GameInfo {
  branch: string;
  game_name: string;
  created_at: string;
}

interface GameBoardData {
  branch: string;
  game_name: string;
  board: number[][];
  initial_board: number[][];
  created_at: string;
}

function App() {
  const [board, setBoard] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>('main');
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [creating, setCreating] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchGames();
    fetchBoard(selectedGame);
  }, [selectedGame]);

  const fetchGames = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/games`);
      if (response.ok) {
        const data = await response.json();
        setGames(data.games);
      }
    } catch (err) {
      console.error('Failed to fetch games:', err);
    }
  };

  const fetchBoard = async (branch: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use legacy endpoint for main branch, new endpoint for game branches
      const endpoint = branch === 'main' 
        ? `${API_BASE_URL}/api/board/${branch}`
        : `${API_BASE_URL}/api/games/${branch}/board`;
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch board: ${response.statusText}`);
      }
      
      const data: GameBoardData = await response.json();
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

  const createGame = async () => {
    if (!newGameName.trim()) return;
    
    try {
      setCreating(true);
      const response = await fetch(`${API_BASE_URL}/api/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gameName: newGameName.trim() }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create game: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Game created:', result);
      
      // Refresh games list and select the new game
      await fetchGames();
      setSelectedGame(result.branch);
      setNewGameName('');
      setShowCreateGame(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="App">Loading...</div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Sudoku Game</h1>
        <p>Create and play games using Dolt branches</p>
      </header>
      <main>
        {error && (
          <div className="error-message">
            <p>⚠️ {error}</p>
            <p>Showing sample board instead</p>
          </div>
        )}
        
        <div className="game-controls">
          <div className="game-selector">
            <label htmlFor="game-select">Select Game: </label>
            <select 
              id="game-select"
              value={selectedGame} 
              onChange={(e) => setSelectedGame(e.target.value)}
            >
              <option value="main">Default Game (main)</option>
              {games.map(game => (
                <option key={game.branch} value={game.branch}>
                  {game.game_name} ({game.branch})
                </option>
              ))}
            </select>
          </div>
          
          <div className="create-game-section">
            {!showCreateGame ? (
              <button 
                className="create-game-btn"
                onClick={() => setShowCreateGame(true)}
              >
                + Create New Game
              </button>
            ) : (
              <div className="create-game-form">
                <input
                  type="text"
                  placeholder="Enter game name"
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createGame()}
                />
                <button 
                  onClick={createGame}
                  disabled={creating || !newGameName.trim()}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button 
                  onClick={() => {
                    setShowCreateGame(false);
                    setNewGameName('');
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
        
        <SudokuBoard board={board} />
      </main>
    </div>
  );
}

export default App;
