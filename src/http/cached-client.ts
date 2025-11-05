/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: http/cached-client.ts
Description: HTTP client with caching, retry logic, and performance optimizations

Created: 2025-01-05
Last Modified: 2025-01-05

Change Log:
-----------
2025-01-05 - Chris Bunting - Initial creation with caching and retry logic
*/

import fetch from 'node-fetch';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config/index.js';

interface CacheEntry {
  data: string;
  timestamp: number;
  etag?: string;
  lastModified?: string;
  url: string;
}

interface RequestStats {
  url: string;
  requestCount: number;
  cacheHits: number;
  totalResponseTime: number;
  avgResponseTime: number;
  errors: number;
}

interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
  maxRetryDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export class CachedHttpClient {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheDir: string;
  private requestStats: Map<string, RequestStats> = new Map();
  private activeRequests: Map<string, Promise<string>> = new Map();
  
  private readonly retryOptions: RetryOptions = {
    maxRetries: 3,
    retryDelay: 1000,
    maxRetryDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'EPIPE',
      'ENOTFOUND'
    ]
  };

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(process.cwd(), 'data', 'http-cache');
    this.ensureCacheDir();
    this.loadCacheFromDisk();
    
    // Set up periodic cache cleanup
    setInterval(() => this.cleanupCache(), 60 * 60 * 1000); // Every hour
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getCacheKey(url: string): string {
    return crypto.createHash('sha256').update(url).digest('hex');
  }

  private getCacheFilePath(key: string): string {
    return path.join(this.cacheDir, `${key}.cache`);
  }

  private loadCacheFromDisk(): void {
    try {
      const files = fs.readdirSync(this.cacheDir);
      let loadedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.cache')) {
          try {
            const filePath = path.join(this.cacheDir, file);
            const data = fs.readFileSync(filePath, 'utf-8');
            const entry: CacheEntry = JSON.parse(data);
            
            // Check if entry is still valid
            if (Date.now() - entry.timestamp < config.caching.ttl) {
              const key = file.replace('.cache', '');
              this.cache.set(key, entry);
              loadedCount++;
            } else {
              // Remove expired cache file
              fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error(`Failed to load cache file ${file}:`, error);
          }
        }
      }
      
      console.log(`Loaded ${loadedCount} cache entries from disk`);
    } catch (error) {
      console.error('Failed to load cache from disk:', error);
    }
  }

  private saveCacheToDisk(key: string, entry: CacheEntry): void {
    try {
      const filePath = this.getCacheFilePath(key);
      fs.writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
    } catch (error) {
      console.error(`Failed to save cache entry ${key}:`, error);
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > config.caching.ttl) {
        this.cache.delete(key);
        
        // Remove from disk
        try {
          const filePath = this.getCacheFilePath(key);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          cleanedCount++;
        } catch (error) {
          console.error(`Failed to remove cache file ${key}:`, error);
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  private updateRequestStats(url: string, responseTime: number, fromCache: boolean, error: boolean = false): void {
    const existing = this.requestStats.get(url);
    if (existing) {
      existing.requestCount++;
      if (fromCache) existing.cacheHits++;
      if (error) existing.errors++;
      existing.totalResponseTime += responseTime;
      existing.avgResponseTime = existing.totalResponseTime / existing.requestCount;
    } else {
      this.requestStats.set(url, {
        url,
        requestCount: 1,
        cacheHits: fromCache ? 1 : 0,
        totalResponseTime: responseTime,
        avgResponseTime: responseTime,
        errors: error ? 1 : 0
      });
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchWithRetry(url: string, options: any, attempt: number = 1): Promise<string> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(options.timeout || 30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response received');
      }

      return text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if error is retryable
      const isRetryable = this.retryOptions.retryableErrors.some(retryableError =>
        errorMessage.includes(retryableError)
      ) || errorMessage.includes('timeout');

      if (isRetryable && attempt < this.retryOptions.maxRetries) {
        const delay = Math.min(
          this.retryOptions.retryDelay * Math.pow(this.retryOptions.backoffMultiplier, attempt - 1),
          this.retryOptions.maxRetryDelay
        );
        
        console.warn(`Request failed (attempt ${attempt}/${this.retryOptions.maxRetries}), retrying in ${delay}ms: ${errorMessage}`);
        await this.sleep(delay);
        
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      throw error;
    }
  }

  async fetch(url: string, options: any = {}): Promise<string> {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL provided');
    }

    const startTime = Date.now();
    const cacheKey = this.getCacheKey(url);

    // Check if request is already in progress (deduplication)
    if (this.activeRequests.has(cacheKey)) {
      console.log(`Request deduplicated: ${url}`);
      const result = await this.activeRequests.get(cacheKey)!;
      this.updateRequestStats(url, Date.now() - startTime, true);
      return result;
    }

    // Check cache first
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry && config.caching.enabled) {
      const cacheAge = Date.now() - cachedEntry.timestamp;
      
      if (cacheAge < config.caching.ttl) {
        console.log(`Cache hit: ${url} (age: ${Math.round(cacheAge / 1000)}s)`);
        this.updateRequestStats(url, Date.now() - startTime, true);
        return cachedEntry.data;
      } else {
        // Remove expired entry
        this.cache.delete(cacheKey);
        try {
          const filePath = this.getCacheFilePath(cacheKey);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (error) {
          console.error(`Failed to remove expired cache file: ${error}`);
        }
      }
    }

    // Create request promise
    const requestPromise = this.performRequest(url, options, cacheKey, startTime);
    
    // Store active request for deduplication
    this.activeRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up active request
      this.activeRequests.delete(cacheKey);
    }
  }

  private async performRequest(url: string, options: any, cacheKey: string, startTime: number): Promise<string> {
    try {
      console.log(`Fetching: ${url}`);
      
      const requestOptions = {
        headers: {
          'User-Agent': 'StyleGuideMCPServer/2.0.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'max-age=3600',
          ...options.headers
        },
        timeout: options.timeout || 30000,
        ...options
      };

      const data = await this.fetchWithRetry(url, requestOptions);
      const responseTime = Date.now() - startTime;

      // Cache the result
      if (config.caching.enabled && data) {
        const entry: CacheEntry = {
          data,
          timestamp: Date.now(),
          url
        };

        this.cache.set(cacheKey, entry);
        this.saveCacheToDisk(cacheKey, entry);
      }

      this.updateRequestStats(url, responseTime, false);
      console.log(`Fetched successfully: ${url} (${responseTime}ms)`);
      
      return data;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateRequestStats(url, responseTime, false, true);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to fetch ${url}: ${errorMessage}`);
      
      throw new Error(`Network error fetching ${url}: ${errorMessage}`);
    }
  }

  // Batch fetching for multiple URLs
  async fetchBatch(urls: string[], options: any = {}, concurrency: number = 5): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const semaphore = new Array(concurrency).fill(null);
    
    const fetchWithSemaphore = async (url: string): Promise<void> => {
      // Wait for available slot
      await Promise.race(semaphore.filter(p => p !== null));
      
      const slotIndex = semaphore.findIndex(p => p === null);
      const promise = this.fetch(url, options).finally(() => {
        semaphore[slotIndex] = null;
      });
      
      semaphore[slotIndex] = promise;
      
      try {
        const result = await promise;
        results.set(url, result);
      } catch (error) {
        console.error(`Failed to fetch ${url} in batch:`, error);
        results.set(url, '');
      }
    };

    // Execute all requests with concurrency control
    await Promise.all(urls.map(url => fetchWithSemaphore(url)));
    
    return results;
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
    
    // Clear cache files
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.cache')) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache files:', error);
    }
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  // Performance monitoring
  getRequestStats(): RequestStats[] {
    return Array.from(this.requestStats.values())
      .sort((a, b) => b.totalResponseTime - a.totalResponseTime);
  }

  getCacheStats(): { size: number; hitRate: number; totalRequests: number } {
    const totalRequests = Array.from(this.requestStats.values())
      .reduce((sum, stat) => sum + stat.requestCount, 0);
    
    const totalCacheHits = Array.from(this.requestStats.values())
      .reduce((sum, stat) => sum + stat.cacheHits, 0);
    
    return {
      size: this.cache.size,
      hitRate: totalRequests > 0 ? totalCacheHits / totalRequests : 0,
      totalRequests
    };
  }

  // Preload cache for critical URLs
  async preloadCache(urls: string[]): Promise<void> {
    console.log(`Preloading cache for ${urls.length} URLs...`);
    
    try {
      await this.fetchBatch(urls, {}, 3); // Lower concurrency for preloading
      console.log('Cache preloading completed');
    } catch (error) {
      console.error('Cache preloading failed:', error);
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; cacheSize: number; avgResponseTime: number }> {
    const stats = this.getRequestStats();
    const avgResponseTime = stats.length > 0 
      ? stats.reduce((sum, stat) => sum + stat.avgResponseTime, 0) / stats.length 
      : 0;

    return {
      status: 'healthy',
      cacheSize: this.cache.size,
      avgResponseTime
    };
  }
}