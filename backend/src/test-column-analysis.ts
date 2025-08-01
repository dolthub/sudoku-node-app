// Test to analyze column shuffling patterns
const baseBoard: number[][] = [
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

function analyzeBoard(board: number[][], title: string) {
  console.log(`\n=== ${title} ===`);
  
  // Show first 3x3 block columns
  console.log('First 3x3 block columns:');
  console.log(`Col 0: [${board.slice(0, 3).map(row => row[0]).join(', ')}]`);
  console.log(`Col 1: [${board.slice(0, 3).map(row => row[1]).join(', ')}]`);
  console.log(`Col 2: [${board.slice(0, 3).map(row => row[2]).join(', ')}]`);
  
  // Show the first row to see horizontal patterns
  console.log(`First row: [${board[0].join(', ')}]`);
}

// Simple Fisher-Yates test
function testFisherYates() {
  console.log('\n🎲 Testing Fisher-Yates on [0,1,2] - 100 times:');
  const results: {[key: string]: number} = {};
  
  for (let test = 0; test < 100; test++) {
    const arr = [0, 1, 2];
    
    // Fisher-Yates shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    
    const key = arr.join(',');
    results[key] = (results[key] || 0) + 1;
  }
  
  console.log('Results distribution:');
  Object.entries(results).forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count} times`);
  });
}

analyzeBoard(baseBoard, 'Base Board Analysis');
testFisherYates();