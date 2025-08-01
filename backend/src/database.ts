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
  async createGame(gameName: string, difficulty: string = 'medium'): Promise<{ branch: string; message: string }> {
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
      const { solution, puzzle } = this.generateSudokuPuzzle(difficulty);
      
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
  private generateSudokuPuzzle(difficulty: string = 'medium'): { solution: number[][], puzzle: number[][] } {
    // Generate a completely random valid Sudoku solution
    console.log('Generating random Sudoku solution...');
    const solution = this.generateRandomSudokuSolution();
    
    // Determine target number of cells to remove based on difficulty
    let targetCellsToRemove: number;
    switch (difficulty) {
      case 'easy':
        targetCellsToRemove = 30 + Math.floor(Math.random() * 6); // 30-35 cells
        break;
      case 'medium':
        targetCellsToRemove = 40 + Math.floor(Math.random() * 6); // 40-45 cells
        break;
      case 'hard':
        targetCellsToRemove = 50 + Math.floor(Math.random() * 6); // 50-55 cells
        break;
      default:
        targetCellsToRemove = 40 + Math.floor(Math.random() * 6); // default to medium
    }
    
    // Create puzzle by incrementally removing cells with validation at each step
    const puzzle = this.removeeCellsIncrementally(solution, targetCellsToRemove);
    
    console.log(`Generated ${difficulty} puzzle with ${81 - this.countFilledCells(puzzle)} empty cells`);
    return { solution, puzzle };
  }

  // Remove cells one by one, validating unique solution at each step
  private removeeCellsIncrementally(solution: number[][], targetToRemove: number): number[][] {
    const puzzle = solution.map(row => [...row]); // Deep copy
    
    // Create list of all positions
    const allPositions: { row: number, col: number }[] = [];
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        allPositions.push({ row, col });
      }
    }
    
    // Shuffle the positions for random removal order
    for (let i = allPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
    }
    
    let removedCount = 0;
    let positionIndex = 0;
    
    while (removedCount < targetToRemove && positionIndex < allPositions.length) {
      const { row, col } = allPositions[positionIndex];
      
      // Skip if already removed
      if (puzzle[row][col] === 0) {
        positionIndex++;
        continue;
      }
      
      // Temporarily remove the cell
      const originalValue = puzzle[row][col];
      puzzle[row][col] = 0;
      
      // Check if puzzle still has unique solution
      if (this.hasUniqueSolution(puzzle)) {
        // Good! Keep the cell removed
        removedCount++;
        console.log(`Removed cell (${row + 1}, ${col + 1}), ${removedCount}/${targetToRemove} removed`);
      } else {
        // Bad! Restore the cell
        puzzle[row][col] = originalValue;
      }
      
      positionIndex++;
    }
    
    console.log(`Successfully removed ${removedCount} cells while maintaining unique solution`);
    return puzzle;
  }

  // Count filled cells in a puzzle
  private countFilledCells(puzzle: number[][]): number {
    let count = 0;
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (puzzle[row][col] !== 0) count++;
      }
    }
    return count;
  }

  // Generate a completely random valid Sudoku solution from scratch
  private generateRandomSudokuSolution(): number[][] {
    // Start with empty board  
    const board: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
    
    // Fill the board using backtracking with randomization
    if (this.fillBoardRandomly(board)) {
      console.log('Successfully generated random Sudoku solution');
      return board;
    } else {
      console.warn('Failed to generate random solution, falling back to base pattern');
      // Fallback to the fixed pattern if random generation fails
      return [
        [5, 3, 4, 6, 7, 8, 9, 1, 2],
        [6, 7, 2, 1, 9, 5, 3, 4, 8],
        [1, 9, 8, 3, 4, 2, 5, 6, 7],
        [8, 5, 9, 7, 6, 1, 4, 2, 3],
        [4, 2, 6, 8, 5, 3, 7, 9, 1],
        [7, 1, 3, 9, 2, 4, 8, 5, 6],
        [9, 6, 1, 5, 3, 7, 2, 8, 4],
        [2, 8, 7, 4, 1, 9, 6, 3, 5],
        [3, 4, 5, 2, 8, 6, 1, 7, 9]
      ];
    }
  }

  // Fill board using randomized backtracking
  private fillBoardRandomly(board: number[][]): boolean {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] === 0) {
          // Create randomized list of numbers 1-9
          const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
          
          // Fisher-Yates shuffle for random order
          for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
          }
          
          // Try each number in random order
          for (const num of numbers) {
            if (this.isValidMove(board, row, col, num)) {
              board[row][col] = num;
              
              // Recursively fill the rest
              if (this.fillBoardRandomly(board)) {
                return true;
              }
              
              // Backtrack
              board[row][col] = 0;
            }
          }
          
          return false; // No valid number found for this cell
        }
      }
    }
    
    return true; // Board is complete
  }

  // Check if a Sudoku puzzle has exactly one unique solution
  private hasUniqueSolution(puzzle: number[][]): boolean {
    const puzzleCopy = puzzle.map(row => [...row]);
    let solutionCount = 0;
    
    const solve = (board: number[][]): boolean => {
      if (solutionCount > 1) return false; // Early exit if multiple solutions found
      
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          if (board[row][col] === 0) {
            for (let num = 1; num <= 9; num++) {
              if (this.isValidMove(board, row, col, num)) {
                board[row][col] = num;
                
                if (solve(board)) {
                  solutionCount++;
                  if (solutionCount > 1) {
                    board[row][col] = 0; // backtrack
                    return false; // Multiple solutions found
                  }
                }
                
                board[row][col] = 0; // backtrack
              }
            }
            return false; // No valid number found for this cell
          }
        }
      }
      
      return true; // Found a complete solution
    };
    
    solve(puzzleCopy);
    return solutionCount === 1;
  }

  // Check if placing a number at a position is valid
  private isValidMove(board: number[][], row: number, col: number, num: number): boolean {
    // Check row
    for (let x = 0; x < 9; x++) {
      if (board[row][x] === num) return false;
    }
    
    // Check column
    for (let x = 0; x < 9; x++) {
      if (board[x][col] === num) return false;
    }
    
    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (board[boxRow + i][boxCol + j] === num) return false;
      }
    }
    
    return true;
  }

}

export default Database;