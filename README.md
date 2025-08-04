# SuDOLTku - Interactive Sudoku Game

A three-tier Sudoku application demonstrating Dolt SQL Server connection pooling and branch-based version control:
- **Frontend**: React TypeScript application with interactive gameplay
- **Backend**: Express.js API server with MySQL2 dynamic connection pooling
- **Database**: Dolt SQL server with branch-based game architecture

## Architecture

```
React Frontend (Port 3000)
       ↓ HTTP API
Express.js API (Port 3001)
       ↓ MySQL2 Connection Pools
Dolt SQL Server (Port 3306)
       ↓ Branch per Game
Git-like Version Control
```

## Key Features

### Interactive Gameplay
- **Keyboard Navigation**: Arrow keys to move between cells
- **Real-time Input**: Number keys (1-9) to fill cells, Backspace/Delete to clear
- **Click-to-Select**: Mouse support for cell selection
- **Error Detection**: Toggle to highlight incorrect cells in red
- **Game Completion**: Automatic detection with celebration message

### Advanced Database Architecture
- **Branch-per-Game**: Each game creates its own Dolt branch for isolated state
- **Dynamic Connection Pooling**: Separate MySQL2 connection pools for each branch
- **Real-time Commits**: Every move is automatically committed with descriptive messages
- **Version Control**: Full git-like history for each game's progress

### Difficulty Levels
- **Easy**: 30-35 cells removed (46-51 cells visible)
- **Medium**: 40-45 cells removed (36-41 cells visible)  
- **Hard**: 50-55 cells removed (26-31 cells visible)
- **Impossible**: 17-25 cells visible (minimal puzzles with unique solutions)

### Puzzle Generation
- **Random Generation**: Dynamic Sudoku solution generation using randomized backtracking
- **Incremental Validation**: Cells removed one-by-one with uniqueness checking
- **Reverse Generation**: Impossible difficulty uses cell-addition approach for minimal puzzles

## Quick Start

### Prerequisites
- **Dolt** (required): Install from https://github.com/dolthub/dolt
  ```bash
  # macOS
  brew install dolt
  
  # Linux/macOS alternative
  curl -L https://github.com/dolthub/dolt/releases/latest/download/install.sh | sudo bash
  ```
- **Node.js** (v16 or higher)

### Installation & Running

1. **Install dependencies:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Start all services:**
   ```bash
   ./start-dev.sh
   ```

   This will start:
   - Dolt SQL server on port 3306
   - Backend API server on port 3001  
   - Frontend development server on port 3000

3. **Access the application:**
   - Game: http://localhost:3000
   - API Health: http://localhost:3001/health

### Manual Setup (Alternative)

1. **Start Dolt SQL Server:**
   ```bash
   cd database && ./start-dolt-server.sh
   ```

2. **Start Backend:**
   ```bash
   cd backend && npm run dev
   ```

3. **Start Frontend:**
   ```bash
   cd frontend && npm start
   ```

## Database Schema

Each game branch contains two tables:

### sudoku_cells (Current Game State)
```sql
CREATE TABLE sudoku_cells (
    row_num INT NOT NULL,
    col_num INT NOT NULL, 
    value INT NOT NULL,
    PRIMARY KEY (row_num, col_num),
    CHECK (row_num >= 1 AND row_num <= 9),
    CHECK (col_num >= 1 AND col_num <= 9),
    CHECK (value >= 1 AND value <= 9)
);
```

### sudoku_solution (Complete Solution)
```sql
CREATE TABLE sudoku_solution (
    row_num INT NOT NULL,
    col_num INT NOT NULL,
    value INT NOT NULL,
    PRIMARY KEY (row_num, col_num),
    CHECK (row_num >= 1 AND row_num <= 9),
    CHECK (col_num >= 1 AND col_num <= 9), 
    CHECK (value >= 1 AND value <= 9)
);
```

### Branch Naming Convention
- `game_{sanitized_name}_{timestamp}` (e.g., `game_my_puzzle_1754099201465`)
- Main branch contains no game tables (used only for branch management)

## API Endpoints

### Game Management
- `POST /api/games` - Create new game with difficulty selection
  ```json
  {"gameName": "My Game", "difficulty": "medium"}
  ```
- `GET /api/games` - List all available games
- `GET /api/games/:branch/board` - Get current board state with errors

### Gameplay  
- `PUT /api/games/:branch/cell` - Update cell value
  ```json
  {"row": 1, "col": 1, "value": 5}
  ```

### Health Check
- `GET /health` - Server status

## Connection Pooling Architecture

The application uses dynamic connection pooling in `backend/src/database.ts`:

### Main Pool (Branch Management)
```typescript
this.mainPool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root', 
  password: '',
  database: 'sudoku_games',
  connectionLimit: 10
});
```

### Branch-Specific Pools (Game Data)
```typescript
const branchPool = mysql.createPool({
  database: `sudoku_games/${branchName}`,
  connectionLimit: 5
});
```

This demonstrates:
- **Pool Isolation**: Separate connection pools per game branch
- **Dynamic Pool Creation**: Pools created on-demand for new games
- **Efficient Connection Reuse**: MySQL2 handles connection lifecycle
- **Concurrent Game Support**: Multiple games can be played simultaneously

## Dolt Integration Features

### Branch Operations
- **Branch Creation**: `CALL DOLT_BRANCH(?)` for new games
- **Branch Listing**: Query `dolt_branches` system table
- **Automatic Commits**: `CALL DOLT_COMMIT("-Am", ?)` for each move

### Version Control Benefits
- **Move History**: Every cell change creates a commit
- **Game Isolation**: Branches prevent cross-game interference  
- **Rollback Capability**: Full git-like history available
- **Merge Potential**: Games could theoretically be merged

## Development Notes

- **TypeScript**: Full type safety across frontend and backend
- **Error Handling**: Graceful fallbacks and user feedback
- **Performance**: Optimized algorithms for puzzle generation and validation
- **Responsive Design**: Clean, mobile-friendly interface
- **Accessibility**: Keyboard navigation and clear visual feedback

## Troubleshooting

### ECONNREFUSED Error
- Ensure Dolt is installed and `dolt` command is available
- Check that Dolt SQL server is running on port 3306
- Verify database initialization completed successfully

### Slow Puzzle Generation
- Impossible difficulty may take 10-60 seconds to generate
- Other difficulties should generate in under 5 seconds
- Check server logs for generation progress

### Frontend Connection Issues  
- Verify backend server is running on port 3001
- Check CORS configuration for cross-origin requests
- Ensure API endpoints return proper JSON responses

## License

This project demonstrates Dolt SQL Server capabilities and is intended for educational purposes.