# Sudoku Game - Three-Tier Application

A demonstration of connection pooling to Dolt SQL Server using a three-tier architecture:
- **Frontend**: React TypeScript application with Sudoku board display
- **Backend**: Express.js API server with MySQL2 connection pooling
- **Database**: Dolt SQL server for versioned data storage

## Architecture

```
React Frontend (Port 3000)
       ↓
Express.js API (Port 3001)
       ↓
Dolt SQL Server (Port 3306)
```

## Features

- **Branch-based game selection**: Each game corresponds to a different branch in the Dolt database
- **Connection pooling**: MySQL2 connection pool for efficient database connections
- **Versioned data storage**: Leverages Dolt's branch-based version control for game data
- **Real-time board display**: Interactive Sudoku board with visual styling

## Quick Start

### Prerequisites
- Dolt (required - install from https://github.com/dolthub/dolt)
- Node.js (v16 or higher)

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
   - Dolt SQL server on port 3306 (if available)
   - Backend API server on port 3001
   - Frontend development server on port 3000

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend Health Check: http://localhost:3001/health

### Manual Setup (Alternative)

If you prefer to start services individually:

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

The application uses a simple schema with sample Sudoku boards:

```sql
CREATE TABLE sudoku_boards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch VARCHAR(255) NOT NULL DEFAULT 'main',
    board_data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

Sample branches include:
- `main` - Default puzzle
- `easy` - Easier puzzle with more filled cells
- `medium` - Medium difficulty
- `hard` - Challenging puzzle with minimal clues

## API Endpoints

- `GET /api/boards/:branch` - Get Sudoku board for specific branch
- `POST /api/boards/:branch` - Create new board for branch
- `GET /api/branches` - List all available branches
- `GET /health` - Health check endpoint

## Development Notes

- The backend uses MySQL2 connection pooling for efficient database connections
- Frontend includes error handling and fallback to sample data
- Branch selection allows switching between different game states
- All TypeScript for type safety

## Connection Pooling Configuration

The MySQL2 connection pool is configured in `backend/src/database.ts`:

```typescript
this.pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'sudoku_game',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
```

This demonstrates efficient connection reuse for handling multiple concurrent requests.