// Test the new base pattern
const newBase: number[][] = [
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

function validateSudoku(board: number[][]): boolean {
  // Check rows
  for (let row = 0; row < 9; row++) {
    const rowSet = new Set(board[row]);
    if (rowSet.size !== 9 || !Array.from(rowSet).every(n => n >= 1 && n <= 9)) {
      console.log(`❌ Row ${row} invalid:`, board[row]);
      return false;
    }
  }
  
  // Check columns
  for (let col = 0; col < 9; col++) {
    const column = board.map(row => row[col]);
    const colSet = new Set(column);
    if (colSet.size !== 9) {
      console.log(`❌ Column ${col} invalid:`, column);
      return false;
    }
  }
  
  // Check 3x3 boxes
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const box: number[] = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          box.push(board[boxRow * 3 + r][boxCol * 3 + c]);
        }
      }
      const boxSet = new Set(box);
      if (boxSet.size !== 9) {
        console.log(`❌ Box (${boxRow},${boxCol}) invalid:`, box);
        return false;
      }
    }
  }
  
  return true;
}

function analyzePattern(board: number[][], title: string) {
  console.log(`\n=== ${title} ===`);
  
  // Show first row
  console.log(`First row: [${board[0].join(', ')}]`);
  
  // Show first 3x3 block columns
  console.log('First 3x3 block columns:');
  console.log(`Col 0: [${board.slice(0, 3).map(row => row[0]).join(', ')}]`);
  console.log(`Col 1: [${board.slice(0, 3).map(row => row[1]).join(', ')}]`);
  console.log(`Col 2: [${board.slice(0, 3).map(row => row[2]).join(', ')}]`);
  
  // Check if valid
  const isValid = validateSudoku(board);
  console.log(`Valid Sudoku: ${isValid ? '✅' : '❌'}`);
}

analyzePattern(newBase, 'New Base Pattern Analysis');