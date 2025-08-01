import mysql from 'mysql2/promise';

export interface GameBoard {
  branch: string;
  board: number[][];
  errors: boolean[][];
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
      
      // Get current board state
      const [rows] = await pool.execute(
        'SELECT row_num, col_num, value FROM sudoku_cells ORDER BY row_num, col_num'
      );
      
      const cells = rows as any[];
      console.log(`Found ${cells.length} cells in branch: ${branch}`);
      
      if (cells.length === 0) {
        console.log(`No cells found in branch: ${branch}`);
        // Return empty board with empty errors array instead of null
        return {
          branch,
          board: Array.from({ length: 9 }, () => Array(9).fill(0)),
          errors: Array.from({ length: 9 }, () => Array(9).fill(false))
        };
      }

      // Find cells that don't match the solution using JOIN
      const [errorRows] = await pool.execute(`
        SELECT c.row_num, c.col_num 
        FROM sudoku_cells c
        JOIN sudoku_solution s ON c.row_num = s.row_num AND c.col_num = s.col_num
        WHERE c.value != s.value
      `);
      
      const errorCells = errorRows as any[];
      console.log(`Found ${errorCells.length} error cells in branch: ${branch}`);

      // Convert relational data back to 2D arrays
      const board: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
      const errors: boolean[][] = Array.from({ length: 9 }, () => Array(9).fill(false));
      
      // Build current board
      for (const cell of cells) {
        const row = cell.row_num - 1; // Convert to 0-based index
        const col = cell.col_num - 1; // Convert to 0-based index
        board[row][col] = cell.value; // Non-null value (1-9)
      }
      
      // Mark error cells
      for (const errorCell of errorCells) {
        const row = errorCell.row_num - 1; // Convert to 0-based index
        const col = errorCell.col_num - 1; // Convert to 0-based index
        errors[row][col] = true;
      }
      
      return {
        branch,
        board,
        errors
      };
    } catch (error) {
      console.error('Error fetching game board:', error);
      throw error;
    }
  }

  // Update a specific cell in the game board
  async updateGameCell(branch: string, row: number, col: number, value: number): Promise<{ isComplete: boolean }> {
    try {
      const pool = branch === 'main' ? this.mainPool : this.getBranchPool(branch);
      
      // First, check the current value to see if we need to make changes
      const [currentRows] = await pool.execute(
        'SELECT value FROM sudoku_cells WHERE row_num = ? AND col_num = ?',
        [row, col]
      );
      
      const currentCells = currentRows as any[];
      const currentValue = currentCells.length > 0 ? currentCells[0].value : 0; // 0 means empty
      
      let changesWereMade = false;
      
      if (value === currentValue) {
        // No change needed - the cell already has this value
        console.log(`No change - cell (${row}, ${col}) already has value ${value === 0 ? 'empty' : value} in branch: ${branch}`);
        changesWereMade = false;
      } else {
        // Value is different, make the change
        if (value === 0) {
          // Remove the cell if value is 0 (empty)
          await pool.execute(
            'DELETE FROM sudoku_cells WHERE row_num = ? AND col_num = ?',
            [row, col]
          );
          console.log(`Cleared cell (${row}, ${col}) in branch: ${branch}`);
          changesWereMade = true;
        } else {
          // Insert or update the cell value
          await pool.execute(
            'INSERT INTO sudoku_cells (row_num, col_num, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
            [row, col, value]
          );
          console.log(`Set cell (${row}, ${col}) = ${value} in branch: ${branch}`);
          changesWereMade = true;
        }
      }
      
      // Check if the game is complete (81 cells filled and no errors)
      const [cellCountResult] = await pool.execute('SELECT COUNT(*) as count FROM sudoku_cells');
      const cellCount = (cellCountResult as any[])[0].count;
      
      let isComplete = false;
      if (cellCount === 81) {
        // Check if there are any errors
        const [errorRows] = await pool.execute(`
          SELECT COUNT(*) as error_count
          FROM sudoku_cells c
          JOIN sudoku_solution s ON c.row_num = s.row_num AND c.col_num = s.col_num
          WHERE c.value != s.value
        `);
        
        const errorCount = (errorRows as any[])[0].error_count;
        isComplete = errorCount === 0;
        
        if (isComplete) {
          console.log(`🎉 Game completed on branch: ${branch}!`);
        }
      }
      
      // Only commit if changes were actually made
      if (changesWereMade) {
        const moveDescription = value === 0 ? `Clear cell (${row}, ${col})` : `Set cell (${row}, ${col}) = ${value}`;
        const commitMessage = isComplete ? `${moveDescription} - GAME COMPLETED! 🎉` : moveDescription;
        await pool.execute(
          'CALL DOLT_COMMIT("-Am", ?)',
          [commitMessage]
        );
        console.log(`Committed move: ${commitMessage}`);
      } else {
        console.log(`Skipped commit - no changes were made to branch: ${branch}`);
      }
      
      return { isComplete };
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
    // Start with a base valid Sudoku pattern
    const baseSolution: number[][] = [
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [4, 5, 6, 7, 8, 9, 1, 2, 3],
      [7, 8, 9, 1, 2, 3, 4, 5, 6],
      [2, 3, 1, 5, 6, 4, 8, 9, 7],
      [5, 6, 4, 8, 9, 7, 2, 3, 1],
      [8, 9, 7, 2, 3, 1, 5, 6, 4],
      [3, 1, 2, 6, 4, 5, 9, 7, 8],
      [6, 4, 5, 9, 7, 8, 3, 1, 2],
      [9, 7, 8, 3, 1, 2, 6, 4, 5]
    ];
    
    // Apply shuffling transformations to create a unique board
    const solution = this.shuffleBoard(baseSolution);
    
    // Create puzzle by removing cells from the solution
    const puzzle: number[][] = solution.map(row => [...row]); // Deep copy
    
    // Remove 40-50 cells to create a proper puzzle difficulty
    const cellsToRemove = 40 + Math.floor(Math.random() * 11); // 40-50 cells
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

  // Shuffle a Sudoku board using valid mathematical transformations
  private shuffleBoard(board: number[][]): number[][] {
    let shuffled = board.map(row => [...row]); // Deep copy
    
    // Perform 10 rounds of shuffling as specified
    for (let round = 0; round < 10; round++) {
      // Shuffle rows within each broad row (3x3 blocks)
      shuffled = this.shuffleRowsInBroadRows(shuffled);
      
      // Shuffle columns within each broad column (3x3 blocks)
      shuffled = this.shuffleColumnsInBroadColumns(shuffled);
      
      // Shuffle broad rows (swap entire 3-row blocks)
      shuffled = this.shuffleBroadRows(shuffled);
      
      // Shuffle broad columns (swap entire 3-column blocks)
      shuffled = this.shuffleBroadColumns(shuffled);
    }
    
    return shuffled;
  }

  // Shuffle rows within each broad row (rows 0-2, 3-5, 6-8)
  private shuffleRowsInBroadRows(board: number[][]): number[][] {
    const result = board.map(row => [...row]);
    
    for (let broadRow = 0; broadRow < 3; broadRow++) {
      const startRow = broadRow * 3;
      const rows = [
        result[startRow],
        result[startRow + 1],
        result[startRow + 2]
      ];
      
      // Fisher-Yates shuffle
      for (let i = rows.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rows[i], rows[j]] = [rows[j], rows[i]];
      }
      
      result[startRow] = rows[0];
      result[startRow + 1] = rows[1];
      result[startRow + 2] = rows[2];
    }
    
    return result;
  }

  // Shuffle columns within each broad column (columns 0-2, 3-5, 6-8)
  private shuffleColumnsInBroadColumns(board: number[][]): number[][] {
    const result = board.map(row => [...row]);
    
    for (let broadCol = 0; broadCol < 3; broadCol++) {
      const startCol = broadCol * 3;
      
      // Extract the three columns
      const cols = [
        result.map(row => row[startCol]),
        result.map(row => row[startCol + 1]),
        result.map(row => row[startCol + 2])
      ];
      
      // Fisher-Yates shuffle
      for (let i = cols.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cols[i], cols[j]] = [cols[j], cols[i]];
      }
      
      // Put columns back
      for (let row = 0; row < 9; row++) {
        result[row][startCol] = cols[0][row];
        result[row][startCol + 1] = cols[1][row];
        result[row][startCol + 2] = cols[2][row];
      }
    }
    
    return result;
  }

  // Shuffle broad rows (swap entire 3-row blocks)
  private shuffleBroadRows(board: number[][]): number[][] {
    const result = [...board];
    const broadRows = [
      [result[0], result[1], result[2]],
      [result[3], result[4], result[5]],
      [result[6], result[7], result[8]]
    ];
    
    // Fisher-Yates shuffle
    for (let i = broadRows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [broadRows[i], broadRows[j]] = [broadRows[j], broadRows[i]];
    }
    
    return [
      ...broadRows[0],
      ...broadRows[1],
      ...broadRows[2]
    ];
  }

  // Shuffle broad columns (swap entire 3-column blocks)
  private shuffleBroadColumns(board: number[][]): number[][] {
    const result = board.map(row => [...row]);
    
    const broadCols = [
      result.map(row => [row[0], row[1], row[2]]),
      result.map(row => [row[3], row[4], row[5]]),
      result.map(row => [row[6], row[7], row[8]])
    ];
    
    // Fisher-Yates shuffle
    for (let i = broadCols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [broadCols[i], broadCols[j]] = [broadCols[j], broadCols[i]];
    }
    
    // Reconstruct the board
    for (let row = 0; row < 9; row++) {
      result[row] = [
        ...broadCols[0][row],
        ...broadCols[1][row],
        ...broadCols[2][row]
      ];
    }
    
    return result;
  }
}

export default Database;