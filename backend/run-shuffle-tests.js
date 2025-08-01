const { execSync } = require('child_process');

console.log('📦 Compiling and running TypeScript directly...');
try {
  console.log('\n🧪 Running shuffle tests...');
  execSync('npx ts-node src/test-shuffling.ts', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Error:', error.message);
}