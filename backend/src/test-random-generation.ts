import Database from './database';

// Create a test instance to access private methods
class TestDatabase extends Database {
  public testGenerateRandomSudokuSolution(): number[][] {
    return (this as any).generateRandomSudokuSolution();
  }
}

function printBoard(board: number[][], title: string) {
  console.log(`\n=== ${title} ===`);
  board.forEach((row, i) => {
    console.log(`Row ${i}: ${row.join(' ')}`);
  });
}

function validateSudoku(board: number[][]): boolean {
  // Check rows
  for (let row = 0; row < 9; row++) {
    const rowSet = new Set(board[row]);
    if (rowSet.size !== 9 || !Array.from(rowSet).every(n => n >= 1 && n <= 9)) {
      return false;
    }
  }
  
  // Check columns
  for (let col = 0; col < 9; col++) {
    const column = board.map(row => row[col]);
    const colSet = new Set(column);
    if (colSet.size !== 9) return false;
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
      if (boxSet.size !== 9) return false;
    }
  }
  
  return true;
}

function testRandomGeneration() {
  const db = new TestDatabase();
  
  console.log('🎲 TESTING RANDOM SUDOKU GENERATION');
  console.log('Generating 3 random Sudoku solutions...\n');
  
  for (let i = 1; i <= 3; i++) {
    console.log(`--- Generation ${i} ---`);
    const startTime = performance.now();
    
    const solution = db.testGenerateRandomSudokuSolution();
    
    const endTime = performance.now();
    const timeMs = Math.round(endTime - startTime);
    
    const isValid = validateSudoku(solution);
    console.log(`Generation time: ${timeMs}ms`);
    console.log(`Valid: ${isValid ? '✅' : '❌'}`);
    console.log(`First row: [${solution[0].join(', ')}]`);
    
    if (i <= 2) { // Print full board for first 2 generations
      printBoard(solution, `Random Solution ${i}`);
    }
  }
  
  // Test performance with multiple generations
  console.log('\n🚀 PERFORMANCE TEST');
  console.log('Generating 10 solutions to test performance...');
  
  const times: number[] = [];
  let successCount = 0;
  
  for (let i = 0; i < 10; i++) {
    const startTime = performance.now();
    const solution = db.testGenerateRandomSudokuSolution();
    const endTime = performance.now();
    
    times.push(endTime - startTime);
    if (validateSudoku(solution)) successCount++;
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  
  console.log(`Success rate: ${successCount}/10 (${successCount * 10}%)`);
  console.log(`Average time: ${Math.round(avgTime)}ms`);  
  console.log(`Min time: ${Math.round(minTime)}ms`);
  console.log(`Max time: ${Math.round(maxTime)}ms`);
}

testRandomGeneration();