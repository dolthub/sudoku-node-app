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
  errors: boolean[][];
  initial_board: number[][];
  created_at: string;
}

function App() {
  const [board, setBoard] = useState<number[][]>([]);
  const [errors, setErrors] = useState<boolean[][]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [creating, setCreating] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchGames();
  }, []);

  useEffect(() => {
    if (selectedGame) {
      fetchBoard(selectedGame);
      setGameCompleted(false); // Reset completion state when switching games
    }
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
      
      const response = await fetch(`${API_BASE_URL}/api/games/${branch}/board`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch board: ${response.statusText}`);
      }
      
      const data: GameBoardData = await response.json();
      setBoard(data.board);
      setErrors(data.errors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board');
      setBoard([]);
      setErrors([]);
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

  const handleCellUpdate = async (row: number, col: number, value: number) => {
    if (!selectedGame) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/games/${selectedGame}/cell`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ row, col, value }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update cell: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Cell updated:', result);

      // Check if game is completed
      if (result.isComplete) {
        setGameCompleted(true);
      }

      // Refresh the board to show the updated state
      await fetchBoard(selectedGame);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update cell');
      throw err; // Re-throw so the component can handle the error state
    }
  };

  if (loading && selectedGame) {
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
        
        {gameCompleted && (
          <div className="completion-message">
            <h2>🎉 Congratulations!</h2>
            <p>You've successfully completed the Sudoku puzzle!</p>
            <p>All cells are filled correctly. Well done! 🎊</p>
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
              <option value="">Select a game to play</option>
              {games.map(game => (
                <option key={game.branch} value={game.branch}>
                  {game.game_name} ({game.branch})
                </option>
              ))}
            </select>
          </div>
          
          {selectedGame && (
            <div className="error-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={showErrors}
                  onChange={(e) => setShowErrors(e.target.checked)}
                />
                Show Errors
              </label>
            </div>
          )}
          
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
        
        {selectedGame ? (
          <SudokuBoard 
            board={board} 
            errors={errors}
            showErrors={showErrors}
            branch={selectedGame}
            onCellUpdate={handleCellUpdate}
          />
        ) : (
          <div className="no-game-selected">
            <p>Please select a game or create a new one to start playing!</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
