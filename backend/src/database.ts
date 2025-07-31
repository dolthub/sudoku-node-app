import mysql from 'mysql2/promise';

export interface GameBoard {
  branch: string;
  board: number[][];
}

export interface GameInfo {
  branch: string;
  game_name: string;
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
        CREATE TABLE sudoku_cells (
          row_num INT NOT NULL,
          col_num INT NOT NULL,
          value INT NOT NULL,
          PRIMARY KEY (row_num, col_num),
          CHECK (row_num >= 1 AND row_num <= 9),
          CHECK (col_num >= 1 AND col_num <= 9),
          CHECK (value >= 1 AND value <= 9)
        )
      `);
      
      // Create solution table
      await branchPool.execute(`
        CREATE TABLE sudoku_solution (
          row_num INT NOT NULL,
          col_num INT NOT NULL,
          value INT NOT NULL,
          PRIMARY KEY (row_num, col_num),
          CHECK (row_num >= 1 AND row_num <= 9),
          CHECK (col_num >= 1 AND col_num <= 9),
          CHECK (value >= 1 AND value <= 9)
        )
      `);
      
      // Generate a legitimate Sudoku puzzle and solution
      const { solution, puzzle } = this.generateSudokuPuzzle();
      
      // Insert solution data (all 81 cells)
      console.log(`Inserting solution data for ${gameName}`);
      const solutionCells: [number, number, number][] = [];
      
      for (let row = 1; row <= 9; row++) {
        for (let col = 1; col <= 9; col++) {
          const value = solution[row - 1][col - 1];
          solutionCells.push([row, col, value]);
        }
      }
      
      const solutionPlaceholders = solutionCells.map(() => '(?, ?, ?)').join(', ');
      const solutionValues = solutionCells.flat();
      
      await branchPool.execute(
        `INSERT INTO sudoku_solution (row_num, col_num, value) VALUES ${solutionPlaceholders}`,
        solutionValues
      );
      console.log(`Inserted solution (${solutionCells.length} cells)`);
      
      // Insert puzzle data (only filled cells)
      console.log(`Inserting initial puzzle data for ${gameName}`);
      const puzzleCells: [number, number, number][] = [];
      
      for (let row = 1; row <= 9; row++) {
        for (let col = 1; col <= 9; col++) {
          const value = puzzle[row - 1][col - 1];
          if (value !== 0) {
            puzzleCells.push([row, col, value]);
          }
        }
      }
      
      if (puzzleCells.length > 0) {
        const puzzlePlaceholders = puzzleCells.map(() => '(?, ?, ?)').join(', ');
        const puzzleValues = puzzleCells.flat();
        
        await branchPool.execute(
          `INSERT INTO sudoku_cells (row_num, col_num, value) VALUES ${puzzlePlaceholders}`,
          puzzleValues
        );
        console.log(`Inserted ${puzzleCells.length} filled cells in puzzle`);
      }
      
      // Commit the changes to the branch
      console.log(`Committing initial game setup to branch ${branchName}`);
      await branchPool.execute(
        'CALL DOLT_COMMIT("-Am", ?)',
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
        'SELECT row_num, col_num, value FROM sudoku_cells ORDER BY row_num, col_num'
      );
      
      const cells = rows as any[];
      console.log(`Found ${cells.length} cells in branch: ${branch}`);
      
      if (cells.length === 0) {
        console.log(`No cells found in branch: ${branch}`);
        return null;
      }

      // Convert relational data back to 2D array
      const board: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
      
      for (const cell of cells) {
        const row = cell.row_num - 1; // Convert to 0-based index
        const col = cell.col_num - 1; // Convert to 0-based index
        board[row][col] = cell.value; // Non-null value (1-9)
      }
      
      return {
        branch,
        board
      };
    } catch (error) {
      console.error('Error fetching game board:', error);
      throw error;
    }
  }

  // Update a specific cell in the game board
  async updateGameCell(branch: string, row: number, col: number, value: number): Promise<void> {
    try {
      const pool = branch === 'main' ? this.mainPool : this.getBranchPool(branch);
      
      if (value === 0) {
        // Remove the cell if value is 0 (empty)
        await pool.execute(
          'DELETE FROM sudoku_cells WHERE row_num = ? AND col_num = ?',
          [row, col]
        );
        console.log(`Cleared cell (${row}, ${col}) in branch: ${branch}`);
      } else {
        // Insert or update the cell value
        await pool.execute(
          'INSERT INTO sudoku_cells (row_num, col_num, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
          [row, col, value]
        );
        console.log(`Set cell (${row}, ${col}) = ${value} in branch: ${branch}`);
      }
      
      // Commit the move to the branch
      const moveDescription = value === 0 ? `Clear cell (${row}, ${col})` : `Set cell (${row}, ${col}) = ${value}`;
      await pool.execute(
        'CALL DOLT_COMMIT("-Am", ?)',
        [moveDescription]
      );
      console.log(`Committed move: ${moveDescription}`);
    } catch (error) {
      console.error('Error updating game cell:', error);
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
            // Extract game name from branch (e.g., "game_MyGame_123456" -> "MyGame")
            const gameNameMatch = branch.match(/^game_(.+)_\d+$/);
            const gameName = gameNameMatch ? gameNameMatch[1] : branch;
            
            games.push({
              branch,
              game_name: gameName
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

  // Generate a legitimate Sudoku puzzle and solution
  private generateSudokuPuzzle(): { solution: number[][], puzzle: number[][] } {
    // Create a legitimate Sudoku solution using a systematic pattern
    const solution: number[][] = [];
    
    for (let row = 0; row < 9; row++) {
      solution[row] = [];
      for (let col = 0; col < 9; col++) {
        // Generate values 1-9 in each row with a systematic shift
        // This creates a valid Sudoku solution
        const baseValue = (row % 3) * 3 + Math.floor(row / 3) + 1;
        const shiftedValue = ((baseValue - 1 + col) % 9) + 1;
        solution[row][col] = shiftedValue;
      }
    }
    
    // Create puzzle by removing some cells from the solution
    const puzzle: number[][] = solution.map(row => [...row]); // Deep copy
    
    // Remove exactly 3 cells to create the puzzle
    const cellsToRemove = 3;
    const removedPositions = new Set<string>();
    
    while (removedPositions.size < cellsToRemove) {
      const row = Math.floor(Math.random() * 9);
      const col = Math.floor(Math.random() * 9);
      const key = `${row},${col}`;
      
      if (!removedPositions.has(key)) {
        puzzle[row][col] = 0; // Remove the cell
        removedPositions.add(key);
      }
    }
    
    console.log(`Generated puzzle with ${cellsToRemove} empty cells`);
    return { solution, puzzle };
  }
}

export default Database;