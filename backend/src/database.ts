import mysql from 'mysql2/promise';

export interface GameBoard {
  id: number;
  game_name: string;
  board_state: number[][];
  initial_board: number[][];
  created_at: Date;
}

export interface GameInfo {
  branch: string;
  game_name: string;
  created_at: Date;
}

class Database {
  private mainPool: mysql.Pool;
  private branchPools: Map<string, mysql.Pool> = new Map();

  constructor() {
    // Main connection pool for branch management
    this.mainPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'sudoku_games',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  // Create a new game by creating a Dolt branch
  async createGame(gameName: string): Promise<{ branch: string; message: string }> {
    try {
      console.log(`Creating new game: ${gameName}`);
      
      // Generate unique branch name
      const branchName = `game_${gameName}_${Date.now()}`;
      
      // Create Dolt branch using SQL
      console.log(`Creating branch ${branchName} using DOLT_BRANCH()`);
      await this.mainPool.execute('CALL DOLT_BRANCH(?)', [branchName]);
      console.log(`Branch ${branchName} created successfully`);
      
      // Create connection pool for the new branch
      const branchPool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: `sudoku_games/${branchName}`,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
      });
      
      this.branchPools.set(branchName, branchPool);
      
      // Initialize table structure in the new branch
      console.log(`Initializing table structure in branch ${branchName}`);
      await branchPool.execute(`
        CREATE TABLE game_board (
          id INT AUTO_INCREMENT PRIMARY KEY,
          game_name VARCHAR(255) NOT NULL,
          board_state JSON NOT NULL,
          initial_board JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_game (game_name)
        )
      `);
      
      // Generate a random Sudoku puzzle for the new game
      const initialBoard = this.generateSudokuPuzzle();
      
      // Insert game data into the branch
      await branchPool.execute(
        'INSERT INTO game_board (game_name, board_state, initial_board) VALUES (?, ?, ?)',
        [gameName, JSON.stringify(initialBoard), JSON.stringify(initialBoard)]
      );
      
      // Commit the changes to the branch
      console.log(`Committing initial game setup to branch ${branchName}`);
      await branchPool.execute(
        'CALL DOLT_COMMIT("-m", ?)',
        [`Initial setup for game: ${gameName}`]
      );
      
      console.log(`Game ${gameName} created successfully on branch ${branchName}`);
      
      return {
        branch: branchName,
        message: `Game "${gameName}" created successfully`
      };
    } catch (error) {
      console.error('Error creating game:', error);
      throw error;
    }
  }

  // Get or create connection pool for a specific branch
  private getBranchPool(branch: string): mysql.Pool {
    if (!this.branchPools.has(branch)) {
      const branchPool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: `sudoku_games/${branch}`,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
      });
      this.branchPools.set(branch, branchPool);
    }
    return this.branchPools.get(branch)!;
  }

  // Get game board from specific branch
  async getGameBoard(branch: string): Promise<GameBoard | null> {
    try {
      console.log(`Getting game board from branch: ${branch}`);
      
      const pool = branch === 'main' ? this.mainPool : this.getBranchPool(branch);
      
      const [rows] = await pool.execute(
        'SELECT * FROM game_board ORDER BY created_at DESC LIMIT 1'
      );
      
      const boards = rows as any[];
      console.log(`Found ${boards.length} boards in branch: ${branch}`);
      
      if (boards.length === 0) {
        console.log(`No board found in branch: ${branch}`);
        return null;
      }

      const board = boards[0];
      
      return {
        id: board.id,
        game_name: board.game_name,
        board_state: typeof board.board_state === 'object' ? board.board_state : JSON.parse(board.board_state),
        initial_board: typeof board.initial_board === 'object' ? board.initial_board : JSON.parse(board.initial_board),
        created_at: board.created_at
      };
    } catch (error) {
      console.error('Error fetching game board:', error);
      throw error;
    }
  }

  // Update game board state
  async updateGameBoard(branch: string, boardState: number[][]): Promise<void> {
    try {
      const pool = branch === 'main' ? this.mainPool : this.getBranchPool(branch);
      
      await pool.execute(
        'UPDATE game_board SET board_state = ?, updated_at = CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1',
        [JSON.stringify(boardState)]
      );
      
      console.log(`Game board updated in branch: ${branch}`);
    } catch (error) {
      console.error('Error updating game board:', error);
      throw error;
    }
  }

  // Get list of all game branches
  async getAllGames(): Promise<GameInfo[]> {
    try {
      console.log('Querying dolt_branches system table...');
      
      // Query the dolt_branches system table using the main pool
      const [rows] = await this.mainPool.execute(
        'SELECT name FROM dolt_branches WHERE name != ? AND name LIKE ?',
        ['main', 'game_%']
      );
      
      const branches = (rows as any[]).map(row => row.name);
      console.log('Found game branches:', branches);
      
      const games: GameInfo[] = [];
      
      // Get game info from each branch
      for (const branch of branches) {
        try {
          const gameBoard = await this.getGameBoard(branch);
          if (gameBoard) {
            games.push({
              branch,
              game_name: gameBoard.game_name,
              created_at: gameBoard.created_at
            });
          }
        } catch (error) {
          console.warn(`Could not get game info for branch ${branch}:`, error);
        }
      }
      
      return games;
    } catch (error) {
      console.error('Error fetching games:', error);
      throw error;
    }
  }

  // Generate a random Sudoku puzzle (simplified version)
  private generateSudokuPuzzle(): number[][] {
    // For now, return a predefined puzzle. In a real implementation,
    // you'd generate a random valid Sudoku puzzle
    const puzzles = [
      [[5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],[8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],[0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]],
      [[0,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],[8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],[0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]],
      [[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,3,0,8,5],[0,0,1,0,2,0,0,0,0],[0,0,0,5,0,7,0,0,0],[0,0,4,0,0,0,1,0,0],[0,9,0,0,0,0,0,0,0],[5,0,0,0,0,0,0,7,3],[0,0,2,0,1,0,0,0,0],[0,0,0,0,4,0,0,0,9]]
    ];
    
    return puzzles[Math.floor(Math.random() * puzzles.length)];
  }
}

export default Database;