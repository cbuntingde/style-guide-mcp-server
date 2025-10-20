/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: logging/index.ts
Description: Enterprise structured logging with correlation IDs and audit trails

Created: 2025-01-04
Last Modified: 2025-01-04

Change Log:
-----------
2025-01-04 - Chris Bunting - Initial creation
*/

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  correlationId?: string;
  userId?: string;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  component?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface SecurityContext {
  correlationId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AuditEntry {
  timestamp: string;
  correlationId?: string;
  userId?: string;
  action: string;
  resource: string;
  result: 'SUCCESS' | 'FAILURE' | 'ATTEMPT';
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logFile?: fs.WriteStream;
  private auditFile?: fs.WriteStream;
  private correlationIdStore = new Map<string, string>();

  constructor() {
    this.logLevel = this.getLogLevelFromString(config.logging.level);
    this.initializeLogFiles();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getLogLevelFromString(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private initializeLogFiles(): void {
    const logDir = path.join(__dirname, '../../logs');
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Main log file
    const logFilePath = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
    this.logFile = fs.createWriteStream(logFilePath, { flags: 'a' });

    // Audit log file
    if (config.logging.auditEnabled) {
      const auditFilePath = path.join(logDir, `audit-${new Date().toISOString().split('T')[0]}.log`);
      this.auditFile = fs.createWriteStream(auditFilePath, { flags: 'a' });
    }

    // Log rotation cleanup
    this.cleanupOldLogs(logDir);
  }

  private cleanupOldLogs(logDir: string): void {
    try {
      const files = fs.readdirSync(logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.logging.retentionDays);

      files.forEach(file => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          this.writeLog(LogLevel.INFO, 'Log rotation', { file: file, action: 'deleted' });
        }
      });
    } catch (error) {
      console.error('Error during log cleanup:', error);
    }
  }

  private writeLog(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (level < this.logLevel) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context,
      component: context?.component,
      action: context?.action,
      duration: context?.duration,
      metadata: context?.metadata,
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    const logLine = config.logging.structured 
      ? JSON.stringify(logEntry)
      : this.formatLogLine(logEntry);

    // Write to file
    if (this.logFile) {
      this.logFile.write(logLine + '\n');
    }

    // Also write to stderr for MCP compatibility
    console.error(logLine);
  }

  private formatLogLine(entry: LogEntry): string {
    const parts = [
      entry.timestamp,
      `[${entry.level}]`,
      entry.correlationId ? `[${entry.correlationId}]` : '',
      entry.component ? `[${entry.component}]` : '',
      entry.message
    ].filter(Boolean);

    let line = parts.join(' ');

    if (entry.context && Object.keys(entry.context).length > 0) {
      line += ` | Context: ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      line += ` | Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        line += `\nStack: ${entry.error.stack}`;
      }
    }

    return line;
  }

  debug(message: string, context?: Record<string, any>, correlationId?: string): void {
    const logContext = { ...context, correlationId };
    this.writeLog(LogLevel.DEBUG, message, logContext);
  }

  info(message: string, context?: Record<string, any>, correlationId?: string): void {
    const logContext = { ...context, correlationId };
    this.writeLog(LogLevel.INFO, message, logContext);
  }

  warn(message: string, context?: Record<string, any>, correlationId?: string): void {
    const logContext = { ...context, correlationId };
    this.writeLog(LogLevel.WARN, message, logContext);
  }

  error(message: string, error?: Error, context?: Record<string, any>, correlationId?: string): void {
    const logContext = { ...context, correlationId };
    this.writeLog(LogLevel.ERROR, message, logContext, error);
  }

  audit(entry: Omit<AuditEntry, 'timestamp'>): void {
    if (!config.logging.auditEnabled || !this.auditFile) {
      return;
    }

    const auditEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    const auditLine = JSON.stringify(auditEntry);
    this.auditFile.write(auditLine + '\n');

    // Also log to main log for visibility
    this.info(`AUDIT: ${entry.action} on ${entry.resource}`, {
      audit: true,
      result: entry.result,
      riskLevel: entry.riskLevel,
      userId: entry.userId,
      correlationId: entry.correlationId,
    }, entry.correlationId);
  }

  generateCorrelationId(): string {
    const correlationId = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return correlationId;
  }

  setCorrelationId(sessionId: string, correlationId: string): void {
    this.correlationIdStore.set(sessionId, correlationId);
  }

  getCorrelationId(sessionId: string): string | undefined {
    return this.correlationIdStore.get(sessionId);
  }

  clearCorrelationId(sessionId: string): void {
    this.correlationIdStore.delete(sessionId);
  }

  logPerformance(operation: string, duration: number, context?: Record<string, any>, correlationId?: string): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      performance: true,
      operation,
      duration,
      durationMs: duration,
    }, correlationId);
  }

  logSecurityEvent(event: string, details: Record<string, any>, riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM', correlationId?: string): void {
    this.warn(`Security Event: ${event}`, {
      ...details,
      security: true,
      riskLevel,
      event,
    }, correlationId);

    // Also create audit entry for high-risk events
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      this.audit({
        correlationId,
        action: `SECURITY_EVENT_${event}`,
        resource: 'SYSTEM',
        result: 'ATTEMPT',
        details: { ...details, event, riskLevel },
        riskLevel,
      });
    }
  }

  logApiRequest(method: string, endpoint: string, statusCode: number, duration: number, context?: Record<string, any>, correlationId?: string): void {
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const message = `API ${method} ${endpoint} - ${statusCode}`;

    this.writeLog(level, message, {
      ...context,
      api: true,
      method,
      endpoint,
      statusCode,
      duration,
      correlationId,
    });
  }

  logDatabaseQuery(query: string, duration: number, success: boolean, context?: Record<string, any>, correlationId?: string): void {
    const level = success ? LogLevel.DEBUG : LogLevel.ERROR;
    const message = `Database Query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`;

    this.writeLog(level, message, {
      ...context,
      database: true,
      query: query.substring(0, 100),
      duration,
      success,
      correlationId,
    });
  }

  close(): void {
    if (this.logFile) {
      this.logFile.end();
    }
    if (this.auditFile) {
      this.auditFile.end();
    }
  }
}

export const logger = Logger.getInstance();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.close();
  process.exit(0);
});

export default logger;