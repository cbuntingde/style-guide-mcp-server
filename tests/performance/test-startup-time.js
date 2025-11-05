#!/usr/bin/env node

/**
 * @copyright 2025 Chris Bunting <cbuntingde@gmail.com>
 * @brief Performance test for startup time
 * @license MIT
 */

const { performance } = require('perf_hooks');
const { spawn } = require('child_process');
const path = require('path');

async function testStartupTime() {
  console.log('🚀 Testing startup time...\n');
  
  const iterations = 5;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    console.log(`Iteration ${i + 1}/${iterations}`);
    
    const startTime = performance.now();
    
    await new Promise((resolve, reject) => {
      const process = spawn('node', [path.join(__dirname, '../../build/index.js')], {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      // Kill the process after it starts (we just want startup time)
      setTimeout(() => {
        process.kill();
        const endTime = performance.now();
        const startupTime = endTime - startTime;
        times.push(startupTime);
        console.log(`  Startup time: ${startupTime.toFixed(2)}ms`);
        resolve();
      }, 1000);
      
      process.on('error', reject);
    });
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    // Small delay between iterations
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  console.log('\n📊 Results:');
  console.log(`  Average: ${avgTime.toFixed(2)}ms`);
  console.log(`  Min: ${minTime.toFixed(2)}ms`);
  console.log(`  Max: ${maxTime.toFixed(2)}ms`);
  
  if (avgTime < 50) {
    console.log('✅ Startup time is excellent (< 50ms)');
  } else if (avgTime < 100) {
    console.log('⚠️  Startup time is acceptable (< 100ms)');
  } else {
    console.log('❌ Startup time needs improvement (> 100ms)');
  }
}

testStartupTime().catch(console.error);