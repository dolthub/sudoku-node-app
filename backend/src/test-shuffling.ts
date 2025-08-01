import Database from './database';

// Create a test instance to access private methods
class TestDatabase extends Database {
  // Expose private methods for testing
  public testShuffleBoard(board: number[][]): number[][] {
    return (this as any).shuffleBoard(board);
  }

  public testShuffleRowsInBroadRows(board: number[][]): number[][] {
    return (this as any).shuffleRowsInBroadRows(board);
  }

  public testShuffleColumnsInBroadColumns(board: number[][]): number[][] {
    return (this as any).shuffleColumnsInBroadColumns(board);
  }

  public testShuffleBroadRows(board: number[][]): number[][] {
    return (this as any).shuffleBroadRows(board);
  }

  public testShuffleBroadColumns(board: number[][]): number[][] {
    return (this as any).shuffleBroadColumns(board);
  }
}

// Base test board (new randomized pattern)
const baseBoard: number[][] = [
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

function printBoard(board: number[][], title: string) {
  console.log(`\n=== ${title} ===`);
  board.forEach((row, i) => {
    console.log(`Row ${i}: ${row.join(' ')}`);
  });
}

function boardsEqual(board1: number[][], board2: number[][]): boolean {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (board1[i][j] !== board2[i][j]) return false;
    }
  }
  return true;
}

function testShuffling() {
  const db = new TestDatabase();

  console.log('🧪 TESTING SUDOKU SHUFFLING FUNCTIONS');
  
  // Test 1: Shuffle rows within broad rows
  console.log('\n1️⃣ Testing shuffleRowsInBroadRows');
  printBoard(baseBoard, 'Original Board');
  
  const shuffledRows = db.testShuffleRowsInBroadRows(baseBoard);
  printBoard(shuffledRows, 'After Row Shuffling');
  console.log('Changed:', !boardsEqual(baseBoard, shuffledRows));

  // Test 2: Shuffle columns within broad columns
  console.log('\n2️⃣ Testing shuffleColumnsInBroadColumns');
  const shuffledCols = db.testShuffleColumnsInBroadColumns(baseBoard);
  printBoard(shuffledCols, 'After Column Shuffling');
  console.log('Changed:', !boardsEqual(baseBoard, shuffledCols));

  // Test 3: Shuffle broad rows
  console.log('\n3️⃣ Testing shuffleBroadRows');
  const shuffledBroadRows = db.testShuffleBroadRows(baseBoard);
  printBoard(shuffledBroadRows, 'After Broad Row Shuffling');
  console.log('Changed:', !boardsEqual(baseBoard, shuffledBroadRows));

  // Test 4: Shuffle broad columns
  console.log('\n4️⃣ Testing shuffleBroadColumns');
  const shuffledBroadCols = db.testShuffleBroadColumns(baseBoard);
  printBoard(shuffledBroadCols, 'After Broad Column Shuffling');
  console.log('Changed:', !boardsEqual(baseBoard, shuffledBroadCols));

  // Test 5: Full shuffle board (multiple runs to see variation)
  console.log('\n5️⃣ Testing full shuffleBoard (3 runs)');
  for (let run = 1; run <= 3; run++) {
    const fullShuffle = db.testShuffleBoard(baseBoard);
    printBoard(fullShuffle, `Full Shuffle Run ${run}`);
    console.log(`Run ${run} changed:`, !boardsEqual(baseBoard, fullShuffle));
  }

  // Test 6: Multiple column shuffles to check consistency
  console.log('\n6️⃣ Testing column shuffle consistency (5 runs)');
  for (let run = 1; run <= 5; run++) {
    const colShuffle = db.testShuffleColumnsInBroadColumns(baseBoard);
    console.log(`Column shuffle run ${run} changed:`, !boardsEqual(baseBoard, colShuffle));
    if (!boardsEqual(baseBoard, colShuffle)) {
      console.log(`  First different row: ${colShuffle[0].join(' ')}`);
    }
  }
}

// Run the tests
testShuffling();