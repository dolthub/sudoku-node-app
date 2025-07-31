import mysql from 'mysql2/promise';

export interface SudokuBoard {
  id: number;
  branch: string;
  board: number[][];
  created_at: Date;
}

class Database {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sudoku_game',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  async getSudokuBoard(branch: string = 'main'): Promise<SudokuBoard | null> {
    try {
      console.log(`Querying for branch: ${branch}`);
      
      // First, let's check if the table exists and has any data
      const [countRows] = await this.pool.execute(
        'SELECT COUNT(*) as count FROM sudoku_boards'
      );
      console.log('Total boards in database:', (countRows as any[])[0].count);
      
      const [rows] = await this.pool.execute(
        'SELECT * FROM sudoku_boards WHERE branch = ? ORDER BY created_at DESC LIMIT 1',
        [branch]
      );
      
      const boards = rows as any[];
      console.log(`Found ${boards.length} boards for branch: ${branch}`);
      
      if (boards.length === 0) {
        console.log(`No board found for branch: ${branch}`);
        return null;
      }

      const board = boards[0];
      console.log('Raw board data:', board.board_data);
      console.log('Board data type:', typeof board.board_data);
      console.log('Board data length:', board.board_data?.length);
      
      let parsedBoard;
      try {
        // If it's already an object, don't parse it
        if (typeof board.board_data === 'object') {
          parsedBoard = board.board_data;
        } else {
          parsedBoard = JSON.parse(board.board_data);
        }
      } catch (parseError) {
        console.error('JSON parse error for board_data:', board.board_data);
        throw new Error(`Invalid JSON in board_data: ${parseError.message}`);
      }
      
      return {
        id: board.id,
        branch: board.branch,
        board: parsedBoard,
        created_at: board.created_at
      };
    } catch (error) {
      console.error('Error fetching sudoku board:', error);
      throw error;
    }
  }

  async createSudokuBoard(branch: string, board: number[][]): Promise<number> {
    try {
      const [result] = await this.pool.execute(
        'INSERT INTO sudoku_boards (branch, board_data) VALUES (?, ?)',
        [branch, JSON.stringify(board)]
      );
      
      return (result as any).insertId;
    } catch (error) {
      console.error('Error creating sudoku board:', error);
      throw error;
    }
  }

  async getAllBranches(): Promise<string[]> {
    try {
      const [rows] = await this.pool.execute(
        'SELECT DISTINCT branch FROM sudoku_boards ORDER BY branch'
      );
      
      return (rows as any[]).map(row => row.branch);
    } catch (error) {
      console.error('Error fetching branches:', error);
      throw error;
    }
  }
}

export default Database;