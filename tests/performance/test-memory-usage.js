#!/usr/bin/env node

/**
 * @copyright 2025 Chris Bunting <cbuntingde@gmail.com>
 * @brief Performance test for memory usage
 * @license MIT
 */

const { performance } = require('perf_hooks');
const { spawn } = require('child_process');
const path = require('path');

async function testMemoryUsage() {
  console.log('🧠 Testing memory usage...\n');
  
  return new Promise((resolve, reject) => {
    const process = spawn('node', [
      '--expose-gc',
      path.join(__dirname, '../../build/index.js')
    ], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    let memorySamples = [];
    let sampleCount = 0;
    const maxSamples = 30;
    
    const sampleMemory = () => {
      if (sampleCount >= maxSamples) {
        process.kill();
        analyzeMemory(memorySamples);
        resolve();
        return;
      }
      
      // Force garbage collection
      process.send({ cmd: 'gc' });
      
      setTimeout(() => {
        const memUsage = process.memoryUsage();
        memorySamples.push({
          rss: memUsage.rss / 1024 / 1024, // MB
          heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
          heapTotal: memUsage.heapTotal / 1024 / 1024, // MB
          external: memUsage.external / 1024 / 1024, // MB
          timestamp: Date.now()
        });
        
        console.log(`Sample ${sampleCount + 1}: RSS=${memorySamples[sampleCount].rss.toFixed(2)}MB, Heap=${memorySamples[sampleCount].heapUsed.toFixed(2)}MB`);
        sampleCount++;
        
        setTimeout(sampleMemory, 1000);
      }, 100);
    };
    
    // Start sampling after process initializes
    setTimeout(sampleMemory, 2000);
    
    process.on('error', reject);
  });
}

function analyzeMemory(samples) {
  console.log('\n📊 Memory Analysis:');
  
  const rssValues = samples.map(s => s.rss);
  const heapValues = samples.map(s => s.heapUsed);
  
  const avgRSS = rssValues.reduce((a, b) => a + b, 0) / rssValues.length;
  const maxRSS = Math.max(...rssValues);
  const minRSS = Math.min(...rssValues);
  
  const avgHeap = heapValues.reduce((a, b) => a + b, 0) / heapValues.length;
  const maxHeap = Math.max(...heapValues);
  const minHeap = Math.min(...heapValues);
  
  console.log(`RSS Memory:`);
  console.log(`  Average: ${avgRSS.toFixed(2)}MB`);
  console.log(`  Min: ${minRSS.toFixed(2)}MB`);
  console.log(`  Max: ${maxRSS.toFixed(2)}MB`);
  
  console.log(`Heap Memory:`);
  console.log(`  Average: ${avgHeap.toFixed(2)}MB`);
  console.log(`  Min: ${minHeap.toFixed(2)}MB`);
  console.log(`  Max: ${maxHeap.toFixed(2)}MB`);
  
  // Check for memory leaks
  const firstHalf = heapValues.slice(0, Math.floor(heapValues.length / 2));
  const secondHalf = heapValues.slice(Math.floor(heapValues.length / 2));
  
  const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const growth = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
  
  console.log(`\nMemory Growth: ${growth.toFixed(2)}%`);
  
  if (growth < 10) {
    console.log('✅ Memory usage is stable (growth < 10%)');
  } else if (growth < 25) {
    console.log('⚠️  Memory usage is acceptable (growth < 25%)');
  } else {
    console.log('❌ Possible memory leak detected (growth > 25%)');
  }
  
  if (avgRSS < 100) {
    console.log('✅ RSS memory usage is excellent (< 100MB)');
  } else if (avgRSS < 200) {
    console.log('⚠️  RSS memory usage is acceptable (< 200MB)');
  } else {
    console.log('❌ RSS memory usage is high (> 200MB)');
  }
}

testMemoryUsage().catch(console.error);