/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: errors/index.ts
Description: Enterprise error handling with circuit breakers and retry logic

Created: 2025-01-04
Last Modified: 2025-01-04

Change Log:
-----------
2025-01-04 - Chris Bunting - Initial creation
*/

import { logger } from '../logging/index.js';

export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  INTERNAL = 'INTERNAL',
  BUSINESS = 'BUSINESS',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ErrorContext {
  correlationId?: string;
  userId?: string;
  component?: string;
  action?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  circuitBreaker?: string;
  state?: string;
  errorType?: string;
  errorMessage?: string;
  attempt?: number;
  maxAttempts?: number;
  delay?: number;
}

export class EnterpriseError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;
  public readonly retryable: boolean;
  public readonly userMessage?: string;

  constructor(
    message: string,
    type: ErrorType = ErrorType.INTERNAL,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: ErrorContext = {},
    retryable: boolean = false,
    userMessage?: string
  ) {
    super(message);
    this.name = 'EnterpriseError';
    this.type = type;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date();
    this.retryable = retryable;
    this.userMessage = userMessage;

    // Ensure the error stack is properly captured
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EnterpriseError);
    }
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable,
      userMessage: this.userMessage,
      stack: this.stack,
    };
  }
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  expectedRecoveryTime?: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;
  private successCount = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly name: string;

  constructor(name: string, config: CircuitBreakerConfig) {
    this.name = name;
    this.config = {
      expectedRecoveryTime: 60000, // 1 minute default
      ...config,
    };
  }

  async execute<T>(
    operation: () => Promise<T>,
    context?: ErrorContext
  ): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`, context);
      } else {
        throw new EnterpriseError(
          `Circuit breaker ${this.name} is OPEN`,
          ErrorType.EXTERNAL_SERVICE,
          ErrorSeverity.HIGH,
          { ...context, circuitBreaker: this.name, state: this.state } as ErrorContext,
          false,
          'Service temporarily unavailable. Please try again later.'
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess(context);
      return result;
    } catch (error) {
      this.onFailure(error, context);
      throw error;
    }
  }

  private onSuccess(context?: ErrorContext): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info(`Circuit breaker ${this.name} transitioning to CLOSED`, context);
      }
    }

    logger.debug(`Circuit breaker ${this.name} success`, {
      ...context,
      circuitBreaker: this.name,
      state: this.state,
      failureCount: this.failureCount,
    });
  }

  private onFailure(error: any, context?: ErrorContext): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.successCount = 0;
      logger.warn(`Circuit breaker ${this.name} transitioning back to OPEN`, {
        ...context,
        circuitBreaker: this.name,
        state: this.state,
        error: error.message,
      });
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.warn(`Circuit breaker ${this.name} transitioning to OPEN`, {
        ...context,
        circuitBreaker: this.name,
        state: this.state,
        failureCount: this.failureCount,
        error: error.message,
      });
    }

    logger.debug(`Circuit breaker ${this.name} failure`, {
      ...context,
      circuitBreaker: this.name,
      state: this.state,
      failureCount: this.failureCount,
      error: error.message,
    });
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return false;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.resetTimeout;
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    logger.info(`Circuit breaker ${this.name} manually reset`);
  }
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: ErrorType[];
  jitter?: boolean;
}

export class RetryHandler {
  private readonly config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        ErrorType.NETWORK,
        ErrorType.TIMEOUT,
        ErrorType.EXTERNAL_SERVICE,
        ErrorType.DATABASE,
      ],
      jitter: true,
      ...config,
    };
  }

  async execute<T>(
    operation: () => Promise<T>,
    context?: ErrorContext
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          logger.info(`Operation succeeded on attempt ${attempt}`, {
            ...context,
            attempt,
            maxAttempts: this.config.maxAttempts,
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;

        if (attempt === this.config.maxAttempts) {
          logger.error(`Operation failed after ${attempt} attempts`, error instanceof Error ? error : new Error(String(error)), {
            ...context,
            attempt,
            maxAttempts: this.config.maxAttempts,
          });
          break;
        }

        if (!this.shouldRetry(error)) {
          logger.debug(`Operation not retryable`, {
            ...context,
            attempt,
            errorType: (error as any).type || 'UNKNOWN',
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          break;
        }

        const delay = this.calculateDelay(attempt);
        logger.warn(`Operation failed on attempt ${attempt}, retrying in ${delay}ms`, {
          ...context,
          attempt,
          maxAttempts: this.config.maxAttempts,
          delay,
          errorType: (error as any).type || 'UNKNOWN',
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private shouldRetry(error: any): boolean {
    if (error instanceof EnterpriseError) {
      return this.config.retryableErrors!.includes(error.type) && error.retryable;
    }

    // For non-EnterpriseError instances, retry on network-like errors
    return error.code === 'ECONNRESET' || 
           error.code === 'ECONNREFUSED' || 
           error.code === 'ETIMEDOUT' ||
           error.name === 'TimeoutError';
  }

  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, this.config.maxDelay);

    if (this.config.jitter) {
      // Add ±25% jitter
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      delay += jitter;
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private circuitBreakers = new Map<string, CircuitBreaker>();

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  createCircuitBreaker(name: string, config: CircuitBreakerConfig): CircuitBreaker {
    const circuitBreaker = new CircuitBreaker(name, config);
    this.circuitBreakers.set(name, circuitBreaker);
    return circuitBreaker;
  }

  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  createRetryHandler(config?: Partial<RetryConfig>): RetryHandler {
    return new RetryHandler(config);
  }

  handleError(error: any, context: ErrorContext = {}): EnterpriseError {
    let enterpriseError: EnterpriseError;

    if (error instanceof EnterpriseError) {
      enterpriseError = error;
    } else if (error instanceof Error) {
      enterpriseError = this.convertToEnterpriseError(error, context);
    } else {
      enterpriseError = new EnterpriseError(
        String(error),
        ErrorType.INTERNAL,
        ErrorSeverity.MEDIUM,
        context
      );
    }

    this.logError(enterpriseError);
    return enterpriseError;
  }

  private convertToEnterpriseError(error: Error, context: ErrorContext): EnterpriseError {
    // Convert common error types to enterprise errors
    if (error.name === 'ValidationError') {
      return new EnterpriseError(
        error.message,
        ErrorType.VALIDATION,
        ErrorSeverity.MEDIUM,
        context,
        false,
        'Invalid input provided'
      );
    }

    if (error.name === 'TimeoutError') {
      return new EnterpriseError(
        'Operation timed out',
        ErrorType.TIMEOUT,
        ErrorSeverity.HIGH,
        context,
        true,
        'Operation timed out. Please try again'
      );
    }

    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      return new EnterpriseError(
        'Network connection failed',
        ErrorType.NETWORK,
        ErrorSeverity.HIGH,
        context,
        true,
        'Network connection failed. Please try again'
      );
    }

    // Default conversion
    return new EnterpriseError(
      error.message,
      ErrorType.INTERNAL,
      ErrorSeverity.MEDIUM,
      context,
      false
    );
  }

  private logError(error: EnterpriseError): void {
    const logContext = {
      ...error.context,
      errorType: error.type,
      severity: error.severity,
      retryable: error.retryable,
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error(`CRITICAL: ${error.message}`, error, logContext, error.context?.correlationId);
        break;
      case ErrorSeverity.HIGH:
        logger.error(`HIGH: ${error.message}`, error, logContext, error.context?.correlationId);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(`MEDIUM: ${error.message}`, logContext, error.context?.correlationId);
        break;
      case ErrorSeverity.LOW:
        logger.info(`LOW: ${error.message}`, logContext, error.context?.correlationId);
        break;
    }

    // Log security events
    if (error.type === ErrorType.AUTHENTICATION || error.type === ErrorType.AUTHORIZATION) {
      logger.logSecurityEvent(
        `SECURITY_${error.type}`,
        { errorMessage: error.message, context: error.context },
        ErrorSeverity.HIGH,
        error.context?.correlationId
      );
    }
  }

  async withCircuitBreaker<T>(
    circuitBreakerName: string,
    operation: () => Promise<T>,
    context?: ErrorContext
  ): Promise<T> {
    let circuitBreaker = this.getCircuitBreaker(circuitBreakerName);
    
    if (!circuitBreaker) {
      // Create default circuit breaker if it doesn't exist
      circuitBreaker = this.createCircuitBreaker(circuitBreakerName, {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 30000,
      });
    }

    return circuitBreaker.execute(operation, context);
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    context?: ErrorContext,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const retryHandler = this.createRetryHandler(retryConfig);
    return retryHandler.execute(operation, context);
  }

  async withCircuitBreakerAndRetry<T>(
    circuitBreakerName: string,
    operation: () => Promise<T>,
    context?: ErrorContext,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const retryHandler = this.createRetryHandler(retryConfig);
    
    return retryHandler.execute(async () => {
      return this.withCircuitBreaker(circuitBreakerName, operation, context);
    }, context);
  }
}

export const errorHandler = ErrorHandler.getInstance();

// Convenience functions
export const withCircuitBreaker = <T>(
  circuitBreakerName: string,
  operation: () => Promise<T>,
  context?: ErrorContext
): Promise<T> => errorHandler.withCircuitBreaker(circuitBreakerName, operation, context);

export const withRetry = <T>(
  operation: () => Promise<T>,
  context?: ErrorContext,
  retryConfig?: Partial<RetryConfig>
): Promise<T> => errorHandler.withRetry(operation, context, retryConfig);

export const withCircuitBreakerAndRetry = <T>(
  circuitBreakerName: string,
  operation: () => Promise<T>,
  context?: ErrorContext,
  retryConfig?: Partial<RetryConfig>
): Promise<T> => errorHandler.withCircuitBreakerAndRetry(circuitBreakerName, operation, context, retryConfig);

export default errorHandler;