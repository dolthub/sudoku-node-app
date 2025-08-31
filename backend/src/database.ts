import mysql from 'mysql2/promise';

export interface GameBoard {
  branch: string;
  board: number[][];
  errors: boolean[][];
  size: number;
}

export interface GameInfo {
  branch: string;
  game_name: string;
  size: number;
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
  async createGame(gameName: string, difficulty: string = 'medium', size: number = 9): Promise<{ branch: string; message: string }> {
    try {
      console.log(`Creating new game: ${gameName}`);
      
      // Generate unique branch name (sanitize for git/dolt compatibility)
      const sanitizedGameName = gameName.replace(/[^a-zA-Z0-9]/g, '_');
      const branchName = `game_${size}x${size}_${sanitizedGameName}_${Date.now()}`;
      
      // Create Dolt branch using SQL
      console.log(`Creating branch ${branchName} using DOLT_BRANCH()`);
      await this.mainPool.execute('CALL DOLT_BRANCH(?)', [branchName]);
      console.log(`Branch ${branchName} created successfully`);
      
      // Get connection pool for the new branch
      const branchPool = this.getBranchPool(branchName);
      
      // Initialize table structure in the new branch
      console.log(`Initializing table structure in branch ${branchName}`);
      await branchPool.execute(`
        CREATE TABLE sudoku_cells (
          row_num INT NOT NULL,
          col_num INT NOT NULL,
          value INT NOT NULL,
          PRIMARY KEY (row_num, col_num),
          CHECK (row_num >= 1 AND row_num <= ${size}),
          CHECK (col_num >= 1 AND col_num <= ${size}),
          CHECK (value >= 1 AND value <= ${size})
        )
      `);
      
      // Create solution table
      await branchPool.execute(`
        CREATE TABLE sudoku_solution (
          row_num INT NOT NULL,
          col_num INT NOT NULL,
          value INT NOT NULL,
          PRIMARY KEY (row_num, col_num),
          CHECK (row_num >= 1 AND row_num <= ${size}),
          CHECK (col_num >= 1 AND col_num <= ${size}),
          CHECK (value >= 1 AND value <= ${size})
        )
      `);
      
      // Create game metadata table
      await branchPool.execute(`
        CREATE TABLE game_metadata (
          key_name VARCHAR(50) PRIMARY KEY,
          value VARCHAR(100) NOT NULL
        )
      `);
      
      // Insert game size metadata
      await branchPool.execute(
        'INSERT INTO game_metadata (key_name, value) VALUES (?, ?)',
        ['size', size.toString()]
      );
      
      // Generate a legitimate Sudoku puzzle and solution
      const { solution, puzzle } = this.generateSudokuPuzzle(difficulty, size);
      
      // Insert solution data (all cells)
      console.log(`Inserting solution data for ${gameName}`);
      const solutionCells: [number, number, number][] = [];
      
      for (let row = 1; row <= size; row++) {
        for (let col = 1; col <= size; col++) {
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
      
      for (let row = 1; row <= size; row++) {
        for (let col = 1; col <= size; col++) {
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
      
      const pool = this.getBranchPool(branch);
      
      // Get game size from metadata
      const [sizeRows] = await pool.execute(
        'SELECT value FROM game_metadata WHERE key_name = ?',
        ['size']
      );
      
      const sizeData = sizeRows as any[];
      const size = sizeData.length > 0 ? parseInt(sizeData[0].value) : 9; // Default to 9x9 for old games
      
      // Get current board state
      const [rows] = await pool.execute(
        'SELECT row_num, col_num, value FROM sudoku_cells ORDER BY row_num, col_num'
      );
      
      const cells = rows as any[];
      console.log(`Found ${cells.length} cells in ${size}x${size} game on branch: ${branch}`);
      
      if (cells.length === 0) {
        console.log(`No cells found in branch: ${branch}`);
        // Return empty board with empty errors array instead of null
        return {
          branch,
          board: Array.from({ length: size }, () => Array(size).fill(0)),
          errors: Array.from({ length: size }, () => Array(size).fill(false)),
          size
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
      const board: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
      const errors: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
      
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
        errors,
        size
      };
    } catch (error) {
      console.error('Error fetching game board:', error);
      throw error;
    }
  }

  // Update a specific cell in the game board
  async updateGameCell(branch: string, row: number, col: number, value: number): Promise<{ isComplete: boolean }> {
    try {
      const pool = this.getBranchPool(branch);
      
      // Get game size from metadata
      const [sizeRows] = await pool.execute(
        'SELECT value FROM game_metadata WHERE key_name = ?',
        ['size']
      );
      
      const sizeData = sizeRows as any[];
      const size = sizeData.length > 0 ? parseInt(sizeData[0].value) : 9; // Default to 9x9 for old games
      
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
      
      // Check if the game is complete (all cells filled and no errors)
      const [cellCountResult] = await pool.execute('SELECT COUNT(*) as count FROM sudoku_cells');
      const cellCount = (cellCountResult as any[])[0].count;
      const totalCells = size * size;
      
      let isComplete = false;
      if (cellCount === totalCells) {
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
            // Extract game name from branch (e.g., "game_9x9_MyGame_123456" -> "MyGame")
            const gameNameMatch = branch.match(/^game_\d+x\d+_(.+)_\d+$/) || branch.match(/^game_(.+)_\d+$/); // Support old format
            const gameName = gameNameMatch ? gameNameMatch[1] : branch;
            
            games.push({
              branch,
              game_name: gameName,
              size: gameBoard.size
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
  private generateSudokuPuzzle(difficulty: string = 'medium', size: number = 9): { solution: number[][], puzzle: number[][] } {
    if (difficulty === 'impossible') {
      // Use reverse generation for impossible difficulty
      console.log('Generating impossible puzzle using reverse generation...');
      return this.generateImpossiblePuzzle(size);
    }
    
    // Generate a completely random valid Sudoku solution
    console.log(`Generating random ${size}x${size} Sudoku solution...`);
    const solution = this.generateRandomSudokuSolution(size);
    
    // Determine target number of cells to remove based on difficulty and size
    const totalCells = size * size;
    let targetCellsToRemove: number;
    
    if (size === 9) {
      // Original 9x9 difficulty settings
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
    } else {
      // 16x16 difficulty settings (proportionally scaled)
      const baseCells = Math.floor(totalCells * 0.4); // Start with 40% removal base
      switch (difficulty) {
        case 'easy':
          targetCellsToRemove = baseCells - 30 + Math.floor(Math.random() * 20); // ~35-40% of cells
          break;
        case 'medium':
          targetCellsToRemove = baseCells + Math.floor(Math.random() * 30); // ~40-50% of cells
          break;
        case 'hard':
          targetCellsToRemove = baseCells + 30 + Math.floor(Math.random() * 40); // ~50-65% of cells
          break;
        default:
          targetCellsToRemove = baseCells + Math.floor(Math.random() * 30); // default to medium
      }
    }
    
    // Create puzzle by incrementally removing cells with validation at each step
    const puzzle = this.removeeCellsIncrementally(solution, targetCellsToRemove, size);
    
    console.log(`Generated ${difficulty} ${size}x${size} puzzle with ${totalCells - this.countFilledCells(puzzle)} empty cells`);
    return { solution, puzzle };
  }

  // Remove cells one by one, validating unique solution at each step
  private removeeCellsIncrementally(solution: number[][], targetToRemove: number, size: number = 9): number[][] {
    const puzzle = solution.map(row => [...row]); // Deep copy
    
    // Create list of all positions
    const allPositions: { row: number, col: number }[] = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
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
  private generateRandomSudokuSolution(size: number = 9): number[][] {
    // Start with empty board  
    const board: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
    
    // Fill the board using backtracking with randomization
    if (this.fillBoardRandomly(board, size)) {
      console.log(`Successfully generated random ${size}x${size} Sudoku solution`);
      return board;
    } else {
      console.warn(`Failed to generate random ${size}x${size} solution, falling back to base pattern`);
      // Fallback to base patterns
      if (size === 9) {
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
      } else {
        // For 16x16, create a simple valid pattern
        const fallbackBoard: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
        // Fill with a basic Latin square pattern
        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size; col++) {
            fallbackBoard[row][col] = ((row * size + col) % size) + 1;
          }
        }
        return fallbackBoard;
      }
    }
  }

  // Fill board using randomized backtracking
  private fillBoardRandomly(board: number[][], size: number = 9): boolean {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (board[row][col] === 0) {
          // Create randomized list of numbers 1-size
          const numbers = Array.from({ length: size }, (_, i) => i + 1);
          
          // Fisher-Yates shuffle for random order
          for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
          }
          
          // Try each number in random order
          for (const num of numbers) {
            if (this.isValidMove(board, row, col, num, size)) {
              board[row][col] = num;
              
              // Recursively fill the rest
              if (this.fillBoardRandomly(board, size)) {
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

  // Generate impossible puzzle using reverse approach: add cells until unique solution
  private generateImpossiblePuzzle(size: number = 9): { solution: number[][], puzzle: number[][] } {
    const maxAttempts = size === 16 ? 3 : 5; // Fewer attempts for 16x16 due to complexity
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Impossible ${size}x${size} puzzle generation attempt ${attempts}...`);
      
      // Start with empty board
      const puzzle: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
      
      // Create list of all positions
      const allPositions: { row: number, col: number }[] = [];
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          allPositions.push({ row, col });
        }
      }
      
      // Shuffle positions for random order
      for (let i = allPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
      }
      
      // Add cells one by one until we have exactly one solution
      let cellsAdded = 0;
      for (const { row, col } of allPositions) {
        // Try numbers 1-size in random order
        const numbers = Array.from({ length: size }, (_, i) => i + 1);
        for (let i = numbers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        
        for (const num of numbers) {
          if (this.isValidMove(puzzle, row, col, num, size)) {
            puzzle[row][col] = num;
            cellsAdded++;
            
            // Check if puzzle has exactly one solution
            if (this.hasUniqueSolution(puzzle, size)) {
              console.log(`Found impossible puzzle with ${cellsAdded} cells in ${attempts} attempts`);
              
              // Generate the complete solution by solving the puzzle
              const solution = this.solvePuzzle(puzzle, size);
              if (solution) {
                return { solution, puzzle };
              }
            }
            
            // If we have too many cells and still no unique solution, start over
            const maxCells = size === 16 ? 50 : 25; // More cells allowed for 16x16
            if (cellsAdded > maxCells) {
              break;
            }
          }
        }
        
        const maxCells = size === 16 ? 50 : 25;
        if (cellsAdded > maxCells) break; // Too many cells, try again
      }
    }
    
    // Fallback: if we can't generate an impossible puzzle, create a very hard one
    console.warn(`Could not generate impossible ${size}x${size} puzzle, falling back to very hard puzzle`);
    const solution = this.generateRandomSudokuSolution(size);
    const cellsToRemove = size === 16 ? 180 : 60; // Remove more cells for 16x16
    const puzzle = this.removeeCellsIncrementally(solution, cellsToRemove, size);
    return { solution, puzzle };
  }

  // Solve a puzzle to get the complete solution
  private solvePuzzle(puzzle: number[][], size: number = 9): number[][] | null {
    const solution = puzzle.map(row => [...row]); // Deep copy
    
    const solve = (board: number[][]): boolean => {
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          if (board[row][col] === 0) {
            for (let num = 1; num <= size; num++) {
              if (this.isValidMove(board, row, col, num, size)) {
                board[row][col] = num;
                
                if (solve(board)) {
                  return true;
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
    
    if (solve(solution)) {
      return solution;
    }
    return null;
  }

  // Check if a Sudoku puzzle has exactly one unique solution
  private hasUniqueSolution(puzzle: number[][], size: number = 9): boolean {
    const puzzleCopy = puzzle.map(row => [...row]);
    let solutionCount = 0;
    
    const solve = (board: number[][]): boolean => {
      if (solutionCount > 1) return false; // Early exit if multiple solutions found
      
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          if (board[row][col] === 0) {
            for (let num = 1; num <= size; num++) {
              if (this.isValidMove(board, row, col, num, size)) {
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
  private isValidMove(board: number[][], row: number, col: number, num: number, size: number = 9): boolean {
    // Check row
    for (let x = 0; x < size; x++) {
      if (board[row][x] === num) return false;
    }
    
    // Check column
    for (let x = 0; x < size; x++) {
      if (board[x][col] === num) return false;
    }
    
    // Check subgrid (3x3 for 9x9, 4x4 for 16x16)
    const subgridSize = size === 16 ? 4 : 3;
    const boxRow = Math.floor(row / subgridSize) * subgridSize;
    const boxCol = Math.floor(col / subgridSize) * subgridSize;
    
    for (let i = 0; i < subgridSize; i++) {
      for (let j = 0; j < subgridSize; j++) {
        if (board[boxRow + i][boxCol + j] === num) return false;
      }
    }
    
    return true;
  }

}

export default Database;