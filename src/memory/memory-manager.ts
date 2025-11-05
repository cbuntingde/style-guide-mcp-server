/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: memory/memory-manager.ts
Description: Memory management and optimization utilities

Created: 2025-01-05
Last Modified: 2025-01-05

Change Log:
-----------
2025-01-05 - Chris Bunting - Initial creation with memory optimization features
*/

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

export class MemoryManager {
  private static instance: MemoryManager;
  private caches: Map<string, Map<string, CacheEntry<any>>> = new Map();
  private memoryThreshold: number = 100 * 1024 * 1024; // 100MB
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxCacheAge: number = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.startMemoryMonitoring();
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  private startMemoryMonitoring(): void {
    // Check memory usage every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.checkMemoryUsage();
      this.cleanupExpiredEntries();
    }, 30000);

    // Handle memory pressure events
    if (process.on) {
      process.on('warning', (warning) => {
        if (warning.name === 'MaxListenersExceededWarning') {
          console.warn('Memory warning: Potential memory leak detected');
          this.aggressiveCleanup();
        }
      });
    }
  }

  private checkMemoryUsage(): void {
    const stats = this.getMemoryStats();
    const usagePercentage = (stats.heapUsed / stats.heapTotal) * 100;

    if (usagePercentage > 80) {
      console.warn(`High memory usage detected: ${usagePercentage.toFixed(2)}%`);
      this.performCleanup();
    }

    if (stats.heapUsed > this.memoryThreshold) {
      console.warn(`Memory threshold exceeded: ${Math.round(stats.heapUsed / 1024 / 1024)}MB`);
      this.aggressiveCleanup();
    }
  }

  getMemoryStats(): MemoryStats {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      arrayBuffers: usage.arrayBuffers || 0
    };
  }

  // Cache management with LRU eviction
  setCache<T>(cacheName: string, key: string, data: T, ttl: number = this.maxCacheAge): void {
    if (!this.caches.has(cacheName)) {
      this.caches.set(cacheName, new Map());
    }

    const cache = this.caches.get(cacheName)!;
    const size = this.estimateSize(data);

    // Check if we need to evict entries
    if (cache.size >= 1000) { // Max 1000 entries per cache
      this.evictLRU(cache);
    }

    cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
      size
    });
  }

  getCache<T>(cacheName: string, key: string): T | null {
    const cache = this.caches.get(cacheName);
    if (!cache) return null;

    const entry = cache.get(key) as CacheEntry<T>;
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.maxCacheAge) {
      cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.data;
  }

  private evictLRU(cache: Map<string, CacheEntry<any>>): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let totalCleaned = 0;

    for (const [cacheName, cache] of this.caches.entries()) {
      let cleaned = 0;
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > this.maxCacheAge) {
          cache.delete(key);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`Cleaned ${cleaned} expired entries from cache '${cacheName}'`);
        totalCleaned += cleaned;
      }
    }

    if (totalCleaned > 0) {
      console.log(`Total cleaned entries: ${totalCleaned}`);
    }
  }

  private performCleanup(): void {
    console.log('Performing memory cleanup...');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clean expired cache entries
    this.cleanupExpiredEntries();

    // Clear least recently used entries from large caches
    for (const [cacheName, cache] of this.caches.entries()) {
      if (cache.size > 500) {
        const entries = Array.from(cache.entries())
          .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        // Remove oldest 25% of entries
        const toRemove = Math.floor(entries.length * 0.25);
        for (let i = 0; i < toRemove; i++) {
          cache.delete(entries[i][0]);
        }
        
        console.log(`Removed ${toRemove} entries from cache '${cacheName}'`);
      }
    }

    const stats = this.getMemoryStats();
    console.log(`Memory after cleanup: ${Math.round(stats.heapUsed / 1024 / 1024)}MB`);
  }

  private aggressiveCleanup(): void {
    console.log('Performing aggressive memory cleanup...');
    
    // Clear all caches
    for (const [cacheName, cache] of this.caches.entries()) {
      const size = cache.size;
      cache.clear();
      console.log(`Cleared cache '${cacheName}' (${size} entries)`);
    }

    // Force garbage collection multiple times
    if (global.gc) {
      for (let i = 0; i < 3; i++) {
        global.gc();
      }
    }

    const stats = this.getMemoryStats();
    console.log(`Memory after aggressive cleanup: ${Math.round(stats.heapUsed / 1024 / 1024)}MB`);
  }

  private estimateSize(obj: any): number {
    try {
      return JSON.stringify(obj).length * 2; // Rough estimate
    } catch {
      return 1024; // Default 1KB for non-serializable objects
    }
  }

  // Cache statistics
  getCacheStats(): Array<{name: string, size: number, totalSize: number}> {
    const stats: Array<{name: string, size: number, totalSize: number}> = [];
    
    for (const [cacheName, cache] of this.caches.entries()) {
      let totalSize = 0;
      for (const entry of cache.values()) {
        totalSize += entry.size;
      }
      
      stats.push({
        name: cacheName,
        size: cache.size,
        totalSize
      });
    }
    
    return stats;
  }

  // Clear specific cache
  clearCache(cacheName: string): void {
    const cache = this.caches.get(cacheName);
    if (cache) {
      const size = cache.size;
      cache.clear();
      console.log(`Cleared cache '${cacheName}' (${size} entries)`);
    }
  }

  // Clear all caches
  clearAllCaches(): void {
    for (const [cacheName, cache] of this.caches.entries()) {
      const size = cache.size;
      cache.clear();
      console.log(`Cleared cache '${cacheName}' (${size} entries)`);
    }
  }

  // Set memory threshold
  setMemoryThreshold(bytes: number): void {
    this.memoryThreshold = bytes;
    console.log(`Memory threshold set to ${Math.round(bytes / 1024 / 1024)}MB`);
  }

  // Get memory usage report
  getMemoryReport(): string {
    const stats = this.getMemoryStats();
    const cacheStats = this.getCacheStats();
    
    let report = `=== Memory Usage Report ===\n`;
    report += `Heap Used: ${Math.round(stats.heapUsed / 1024 / 1024)}MB\n`;
    report += `Heap Total: ${Math.round(stats.heapTotal / 1024 / 1024)}MB\n`;
    report += `RSS: ${Math.round(stats.rss / 1024 / 1024)}MB\n`;
    report += `External: ${Math.round(stats.external / 1024 / 1024)}MB\n`;
    
    if (stats.arrayBuffers > 0) {
      report += `Array Buffers: ${Math.round(stats.arrayBuffers / 1024 / 1024)}MB\n`;
    }
    
    report += `\n=== Cache Statistics ===\n`;
    for (const cache of cacheStats) {
      report += `${cache.name}: ${cache.size} entries, ${Math.round(cache.totalSize / 1024)}KB\n`;
    }
    
    return report;
  }

  // Cleanup on shutdown
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.clearAllCaches();
    console.log('Memory manager shutdown complete');
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance();