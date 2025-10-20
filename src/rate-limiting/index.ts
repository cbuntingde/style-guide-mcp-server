/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: rate-limiting/index.ts
Description: Enterprise rate limiting and resource management with memory optimization

Created: 2025-01-04
Last Modified: 2025-01-04

Change Log:
-----------
2025-01-04 - Chris Bunting - Initial creation
*/

import { config } from '../config/index.js';
import { logger } from '../logging/index.js';
import { EnterpriseError, ErrorType, ErrorSeverity } from '../errors/index.js';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
}

export interface ResourceLimit {
  maxMemoryUsage: number; // in MB
  maxCpuUsage: number; // percentage
  maxConcurrentOperations: number;
  maxFileSize: number; // in bytes
  maxDatabaseConnections: number;
}

export interface ResourceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  concurrentOperations: number;
  diskUsage: number;
  uptime: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private requests = new Map<string, number[]>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old entries periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  isAllowed(identifier: string, rateLimitConfig: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowStart = now - rateLimitConfig.windowMs;
    
    // Generate key for this identifier
    const key = rateLimitConfig.keyGenerator 
      ? rateLimitConfig.keyGenerator(identifier)
      : identifier;

    // Get existing requests for this key
    let timestamps = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);
    
    // Check if under limit
    const allowed = timestamps.length < rateLimitConfig.maxRequests;
    
    if (allowed) {
      // Add current request
      timestamps.push(now);
      this.requests.set(key, timestamps);
    }

    const resetTime = new Date(now + rateLimitConfig.windowMs);
    const remaining = Math.max(0, rateLimitConfig.maxRequests - timestamps.length);
    const retryAfter = allowed ? undefined : Math.ceil(rateLimitConfig.windowMs / 1000);

    // Log rate limit events
    if (!allowed) {
      logger.warn(`Rate limit exceeded for ${key}`, {
        identifier,
        key,
        currentCount: timestamps.length,
        maxRequests: rateLimitConfig.maxRequests,
        windowMs: rateLimitConfig.windowMs,
        retryAfter,
      });
    }

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    const maxWindow = Math.max(
      config.security.rateLimiting.windowMs,
      300000 // 5 minutes minimum
    );
    const cutoff = now - maxWindow;

    let cleanedCount = 0;
    for (const [key, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter(timestamp => timestamp > cutoff);
      if (filtered.length === 0) {
        this.requests.delete(key);
        cleanedCount++;
      } else if (filtered.length < timestamps.length) {
        this.requests.set(key, filtered);
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Rate limiter cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  getStats(): { totalKeys: number; totalRequests: number } {
    let totalRequests = 0;
    for (const timestamps of this.requests.values()) {
      totalRequests += timestamps.length;
    }

    return {
      totalKeys: this.requests.size,
      totalRequests,
    };
  }

  reset(identifier?: string): void {
    if (identifier) {
      this.requests.delete(identifier);
      logger.info(`Rate limit reset for identifier: ${identifier}`);
    } else {
      const count = this.requests.size;
      this.requests.clear();
      logger.info(`Rate limit reset for all ${count} identifiers`);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
}

export class ResourceManager {
  private static instance: ResourceManager;
  private metrics: ResourceMetrics;
  private activeOperations = new Set<string>();
  private connectionCount = 0;
  private startTimestamp: number;

  constructor() {
    this.startTimestamp = Date.now();
    this.metrics = {
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: 0,
      concurrentOperations: 0,
      diskUsage: 0,
      uptime: 0,
    };

    // Start monitoring
    this.startMonitoring();
  }

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  private startMonitoring(): void {
    setInterval(() => {
      this.updateMetrics();
    }, 5000); // Every 5 seconds
  }

  private updateMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    this.metrics.activeConnections = this.connectionCount;
    this.metrics.concurrentOperations = this.activeOperations.size;
    this.metrics.uptime = Date.now() - this.startTimestamp;

    // Log if approaching limits
    this.checkResourceLimits();
  }

  private checkResourceLimits(): void {
    const limits = this.getResourceLimits();

    if (this.metrics.memoryUsage > limits.maxMemoryUsage * 0.9) {
      logger.warn(`Memory usage approaching limit: ${this.metrics.memoryUsage.toFixed(2)}MB / ${limits.maxMemoryUsage}MB`, {
        currentUsage: this.metrics.memoryUsage,
        limit: limits.maxMemoryUsage,
        percentage: (this.metrics.memoryUsage / limits.maxMemoryUsage) * 100,
      });
    }

    if (this.metrics.concurrentOperations > limits.maxConcurrentOperations * 0.9) {
      logger.warn(`Concurrent operations approaching limit: ${this.metrics.concurrentOperations} / ${limits.maxConcurrentOperations}`, {
        currentOps: this.metrics.concurrentOperations,
        limit: limits.maxConcurrentOperations,
        percentage: (this.metrics.concurrentOperations / limits.maxConcurrentOperations) * 100,
      });
    }
  }

  getResourceLimits(): ResourceLimit {
    return {
      maxMemoryUsage: 512, // 512MB
      maxCpuUsage: 80, // 80%
      maxConcurrentOperations: 100,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxDatabaseConnections: 20,
    };
  }

  checkResourceAvailability(operation: string): boolean {
    const limits = this.getResourceLimits();

    // Check memory
    if (this.metrics.memoryUsage > limits.maxMemoryUsage) {
      logger.warn(`Operation rejected due to memory limit: ${operation}`, {
        operation,
        memoryUsage: this.metrics.memoryUsage,
        limit: limits.maxMemoryUsage,
      });
      return false;
    }

    // Check concurrent operations
    if (this.metrics.concurrentOperations >= limits.maxConcurrentOperations) {
      logger.warn(`Operation rejected due to concurrent operation limit: ${operation}`, {
        operation,
        concurrentOps: this.metrics.concurrentOperations,
        limit: limits.maxConcurrentOperations,
      });
      return false;
    }

    return true;
  }

  async executeWithResourceLimit<T>(
    operation: string,
    fn: () => Promise<T>,
    timeout: number = 30000
  ): Promise<T> {
    if (!this.checkResourceAvailability(operation)) {
      throw new EnterpriseError(
        `Resource limits exceeded for operation: ${operation}`,
        ErrorType.RATE_LIMIT,
        ErrorSeverity.HIGH,
        { operation, metrics: this.metrics } as any,
        false,
        'System is currently under heavy load. Please try again later.'
      );
    }

    const operationId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeOperations.add(operationId);

    const startTime = Date.now();

    try {
      // Add timeout to prevent hanging operations
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new EnterpriseError(
              `Operation timeout: ${operation}`,
              ErrorType.TIMEOUT,
              ErrorSeverity.HIGH,
              { operation, operationId, timeout } as any,
              false,
              'Operation timed out. Please try again.'
            ));
          }, timeout);
        })
      ]);

      const duration = Date.now() - startTime;
      logger.logPerformance(operation, duration, { operationId });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Operation failed: ${operation}`, error instanceof Error ? error : new Error(String(error)), {
        operationId,
        duration,
      });
      throw error;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  incrementConnections(): void {
    this.connectionCount++;
    logger.debug(`Database connection incremented: ${this.connectionCount}`);
  }

  decrementConnections(): void {
    this.connectionCount = Math.max(0, this.connectionCount - 1);
    logger.debug(`Database connection decremented: ${this.connectionCount}`);
  }

  validateFileSize(size: number): boolean {
    const limits = this.getResourceLimits();
    if (size > limits.maxFileSize) {
      logger.warn(`File size validation failed: ${size} bytes > ${limits.maxFileSize} bytes`);
      return false;
    }
    return true;
  }

  getMetrics(): ResourceMetrics {
    return { ...this.metrics };
  }

  getHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const limits = this.getResourceLimits();
    
    const memoryRatio = this.metrics.memoryUsage / limits.maxMemoryUsage;
    const opsRatio = this.metrics.concurrentOperations / limits.maxConcurrentOperations;

    if (memoryRatio > 0.95 || opsRatio > 0.95) {
      return 'critical';
    } else if (memoryRatio > 0.8 || opsRatio > 0.8) {
      return 'warning';
    }

    return 'healthy';
  }
}

export class RateLimitMiddleware {
  private rateLimiter: RateLimiter;
  private resourceManager: ResourceManager;

  constructor() {
    this.rateLimiter = RateLimiter.getInstance();
    this.resourceManager = ResourceManager.getInstance();
  }

  createMiddleware(rateLimitConfig?: Partial<RateLimitConfig>) {
    const rateConfig: RateLimitConfig = {
      windowMs: config.security.rateLimiting.windowMs,
      maxRequests: config.security.rateLimiting.maxRequests,
      ...rateLimitConfig,
    };

    return (identifier: string) => {
      const result = this.rateLimiter.isAllowed(identifier, rateConfig);
      
      if (!result.allowed) {
        throw new EnterpriseError(
          'Rate limit exceeded',
          ErrorType.RATE_LIMIT,
          ErrorSeverity.MEDIUM,
          { identifier, retryAfter: result.retryAfter } as any,
          false,
          `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`
        );
      }

      return result;
    };
  }

  async withRateLimit<T>(
    identifier: string,
    operation: () => Promise<T>,
    rateLimitConfig?: Partial<RateLimitConfig>
  ): Promise<T> {
    const middleware = this.createMiddleware(rateLimitConfig);
    const rateLimitResult = middleware(identifier);

    return this.resourceManager.executeWithResourceLimit(
      `rate_limited_${identifier}`,
      operation
    );
  }
}

// Export singleton instances
export const rateLimiter = RateLimiter.getInstance();
export const resourceManager = ResourceManager.getInstance();
export const rateLimitMiddleware = new RateLimitMiddleware();

// Graceful cleanup
process.on('SIGINT', () => {
  rateLimiter.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  rateLimiter.destroy();
  process.exit(0);
});

export default {
  RateLimiter,
  ResourceManager,
  RateLimitMiddleware,
  rateLimiter,
  resourceManager,
  rateLimitMiddleware,
};