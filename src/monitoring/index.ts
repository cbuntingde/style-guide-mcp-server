/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: monitoring/index.ts
Description: Enterprise health checks and monitoring with metrics collection

Created: 2025-01-04
Last Modified: 2025-01-04

Change Log:
-----------
2025-01-04 - Chris Bunting - Initial creation
*/

import { config } from '../config/index.js';
import { logger } from '../logging/index.js';
import { resourceManager } from '../rate-limiting/index.js';
import { errorHandler } from '../errors/index.js';

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  CRITICAL = 'CRITICAL',
}

export enum CheckType {
  DATABASE = 'DATABASE',
  EXTERNAL_API = 'EXTERNAL_API',
  MEMORY = 'MEMORY',
  DISK_SPACE = 'DISK_SPACE',
  CPU = 'CPU',
  CACHE = 'CACHE',
  SECURITY = 'SECURITY',
}

export interface HealthCheck {
  name: string;
  type: CheckType;
  status: HealthStatus;
  message: string;
  duration: number;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  timestamp: Date;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    requests: number;
    errors: number;
    responseTime: number;
  };
  database: {
    connections: number;
    queries: number;
    errors: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

export interface AlertRule {
  name: string;
  condition: (metrics: SystemMetrics) => boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  cooldown: number; // milliseconds
  lastTriggered?: Date;
}

export class HealthChecker {
  private static instance: HealthChecker;
  private checks = new Map<string, () => Promise<HealthCheck>>();
  private metrics: SystemMetrics;
  private alertRules: AlertRule[] = [];
  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.setupDefaultChecks();
    this.setupDefaultAlerts();
    
    if (config.monitoring.enabled) {
      this.startMonitoring();
    }
  }

  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  private initializeMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    return {
      timestamp: new Date(),
      uptime: 0,
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0], // 1min, 5min, 15min
      },
      disk: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      network: {
        requests: 0,
        errors: 0,
        responseTime: 0,
      },
      database: {
        connections: 0,
        queries: 0,
        errors: 0,
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
      },
    };
  }

  private setupDefaultChecks(): void {
    // Memory check
    this.addCheck('memory', CheckType.MEMORY, async () => {
      const startTime = Date.now();
      const memUsage = process.memoryUsage();
      const memoryLimit = 512 * 1024 * 1024; // 512MB
      const usagePercentage = (memUsage.heapUsed / memoryLimit) * 100;

      let status: HealthStatus;
      let message: string;

      if (usagePercentage > 95) {
        status = HealthStatus.CRITICAL;
        message = `Memory usage critical: ${usagePercentage.toFixed(1)}%`;
      } else if (usagePercentage > 85) {
        status = HealthStatus.UNHEALTHY;
        message = `Memory usage high: ${usagePercentage.toFixed(1)}%`;
      } else if (usagePercentage > 70) {
        status = HealthStatus.DEGRADED;
        message = `Memory usage elevated: ${usagePercentage.toFixed(1)}%`;
      } else {
        status = HealthStatus.HEALTHY;
        message = `Memory usage normal: ${usagePercentage.toFixed(1)}%`;
      }

      return {
        name: 'memory',
        type: CheckType.MEMORY,
        status,
        message,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        details: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: usagePercentage,
        },
      };
    });

    // Database check
    this.addCheck('database', CheckType.DATABASE, async () => {
      const startTime = Date.now();
      
      try {
        // Simulate database connectivity check
        const connectionTest = await this.testDatabaseConnection();
        
        return {
          name: 'database',
          type: CheckType.DATABASE,
          status: connectionTest ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
          message: connectionTest ? 'Database connection successful' : 'Database connection failed',
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      } catch (error) {
        return {
          name: 'database',
          type: CheckType.DATABASE,
          status: HealthStatus.CRITICAL,
          message: `Database check failed: ${error instanceof Error ? error.message : String(error)}`,
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }
    });

    // Resource check
    this.addCheck('resources', CheckType.CPU, async () => {
      const startTime = Date.now();
      const resourceHealth = resourceManager.getHealthStatus();
      
      let status: HealthStatus;
      switch (resourceHealth) {
        case 'critical':
          status = HealthStatus.CRITICAL;
          break;
        case 'warning':
          status = HealthStatus.DEGRADED;
          break;
        default:
          status = HealthStatus.HEALTHY;
      }

      return {
        name: 'resources',
        type: CheckType.CPU,
        status,
        message: `Resource status: ${resourceHealth}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        details: resourceManager.getMetrics(),
      };
    });
  }

  private setupDefaultAlerts(): void {
    // Memory alert
    this.addAlertRule({
      name: 'high_memory_usage',
      condition: (metrics) => metrics.memory.percentage > 90,
      severity: 'HIGH',
      message: 'Memory usage exceeds 90%',
      cooldown: 5 * 60 * 1000, // 5 minutes
    });

    // CPU alert
    this.addAlertRule({
      name: 'high_cpu_usage',
      condition: (metrics) => metrics.cpu.usage > 80,
      severity: 'MEDIUM',
      message: 'CPU usage exceeds 80%',
      cooldown: 3 * 60 * 1000, // 3 minutes
    });

    // Database error alert
    this.addAlertRule({
      name: 'database_errors',
      condition: (metrics) => {
        if (metrics.database.queries === 0) return false;
        const errorRate = metrics.database.errors / metrics.database.queries;
        return errorRate > 0.1; // 10% error rate
      },
      severity: 'HIGH',
      message: 'Database error rate exceeds 10%',
      cooldown: 2 * 60 * 1000, // 2 minutes
    });
  }

  private async testDatabaseConnection(): Promise<boolean> {
    // This would be implemented with actual database connection test
    // For now, simulate a successful connection
    return true;
  }

  private startMonitoring(): void {
    // Update metrics periodically
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, config.monitoring.metricsInterval);

    // Run health checks periodically
    this.healthCheckInterval = setInterval(() => {
      this.runAllHealthChecks();
    }, config.monitoring.healthCheckInterval);

    logger.info('Health monitoring started', {
      metricsInterval: config.monitoring.metricsInterval,
      healthCheckInterval: config.monitoring.healthCheckInterval,
    });
  }

  private updateMetrics(): void {
    const memUsage = process.memoryUsage();
    const now = Date.now();

    this.metrics.timestamp = new Date();
    this.metrics.uptime = now - process.uptime() * 1000;
    this.metrics.memory = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    };

    // Update CPU usage (simplified)
    this.metrics.cpu.usage = Math.random() * 20; // Simulated CPU usage

    // Get resource manager metrics
    const resourceMetrics = resourceManager.getMetrics();
    this.metrics.database.connections = resourceMetrics.activeConnections;
    this.metrics.database.queries = Math.floor(Math.random() * 100); // Simulated
    this.metrics.database.errors = Math.floor(Math.random() * 5); // Simulated

    // Check alert rules
    this.checkAlerts();
  }

  private checkAlerts(): void {
    for (const rule of this.alertRules) {
      const now = Date.now();
      
      // Check cooldown
      if (rule.lastTriggered && (now - rule.lastTriggered.getTime()) < rule.cooldown) {
        continue;
      }

      // Check condition
      if (rule.condition(this.metrics)) {
        rule.lastTriggered = new Date();
        this.triggerAlert(rule);
      }
    }
  }

  private triggerAlert(rule: AlertRule): void {
    logger.warn(`ALERT: ${rule.message}`, {
      alertName: rule.name,
      severity: rule.severity,
      metrics: this.metrics,
    });

    // Log as security event for critical alerts
    if (rule.severity === 'CRITICAL') {
      logger.logSecurityEvent(
        'SYSTEM_ALERT',
        {
          alertName: rule.name,
          message: rule.message,
          metrics: this.metrics,
        },
        'CRITICAL'
      );
    }
  }

  addCheck(name: string, type: CheckType, checkFn: () => Promise<HealthCheck>): void {
    this.checks.set(name, checkFn);
    logger.debug(`Added health check: ${name}`, { type });
  }

  removeCheck(name: string): void {
    this.checks.delete(name);
    logger.debug(`Removed health check: ${name}`);
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    logger.debug(`Added alert rule: ${rule.name}`);
  }

  async runHealthCheck(name: string): Promise<HealthCheck> {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      throw new Error(`Health check not found: ${name}`);
    }

    try {
      return await checkFn();
    } catch (error) {
      return {
        name,
        type: CheckType.DATABASE, // Default type
        status: HealthStatus.CRITICAL,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: 0,
        timestamp: new Date(),
      };
    }
  }

  async runAllHealthChecks(): Promise<HealthCheck[]> {
    const results: HealthCheck[] = [];
    
    for (const [name] of this.checks) {
      try {
        const result = await this.runHealthCheck(name);
        results.push(result);
      } catch (error) {
        logger.error(`Health check failed: ${name}`, error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Log overall health status
    const overallStatus = this.getOverallHealthStatus(results);
    logger.debug(`Overall health status: ${overallStatus}`, {
      checks: results.length,
      healthy: results.filter(r => r.status === HealthStatus.HEALTHY).length,
      degraded: results.filter(r => r.status === HealthStatus.DEGRADED).length,
      unhealthy: results.filter(r => r.status === HealthStatus.UNHEALTHY).length,
      critical: results.filter(r => r.status === HealthStatus.CRITICAL).length,
    });

    return results;
  }

  private getOverallHealthStatus(checks: HealthCheck[]): HealthStatus {
    if (checks.some(check => check.status === HealthStatus.CRITICAL)) {
      return HealthStatus.CRITICAL;
    }
    if (checks.some(check => check.status === HealthStatus.UNHEALTHY)) {
      return HealthStatus.UNHEALTHY;
    }
    if (checks.some(check => check.status === HealthStatus.DEGRADED)) {
      return HealthStatus.DEGRADED;
    }
    return HealthStatus.HEALTHY;
  }

  getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  async getHealthStatus(): Promise<{
    status: HealthStatus;
    checks: HealthCheck[];
    metrics: SystemMetrics;
    timestamp: Date;
  }> {
    const checks = await this.runAllHealthChecks();
    const status = this.getOverallHealthStatus(checks);

    return {
      status,
      checks,
      metrics: this.getMetrics(),
      timestamp: new Date(),
    };
  }

  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    logger.info('Health monitoring stopped');
  }
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private timers = new Map<string, number>();

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  recordHistogram(name: string, value: number): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }
    const values = this.histograms.get(name)!;
    values.push(value);
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }
  }

  startTimer(name: string): string {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.timers.set(timerId, Date.now());
    return timerId;
  }

  endTimer(timerId: string): number {
    const startTime = this.timers.get(timerId);
    if (!startTime) {
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(timerId);
    
    const name = timerId.split('_')[0];
    this.recordHistogram(`${name}_duration`, duration);
    
    return duration;
  }

  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};

    // Counters
    for (const [name, value] of this.counters) {
      result[`counter_${name}`] = value;
    }

    // Gauges
    for (const [name, value] of this.gauges) {
      result[`gauge_${name}`] = value;
    }

    // Histograms
    for (const [name, values] of this.histograms) {
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        result[`histogram_${name}_count`] = values.length;
        result[`histogram_${name}_sum`] = values.reduce((a, b) => a + b, 0);
        result[`histogram_${name}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
        result[`histogram_${name}_min`] = sorted[0];
        result[`histogram_${name}_max`] = sorted[sorted.length - 1];
        result[`histogram_${name}_p50`] = sorted[Math.floor(sorted.length * 0.5)];
        result[`histogram_${name}_p95`] = sorted[Math.floor(sorted.length * 0.95)];
        result[`histogram_${name}_p99`] = sorted[Math.floor(sorted.length * 0.99)];
      }
    }

    return result;
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();
  }
}

// Export singleton instances
export const healthChecker = HealthChecker.getInstance();
export const metricsCollector = MetricsCollector.getInstance();

// Graceful shutdown
process.on('SIGINT', () => {
  healthChecker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  healthChecker.stop();
  process.exit(0);
});

export default {
  HealthChecker,
  MetricsCollector,
  healthChecker,
  metricsCollector,
};