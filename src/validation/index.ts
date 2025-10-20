/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: validation/index.ts
Description: Enterprise input validation and sanitization with security controls

Created: 2025-01-04
Last Modified: 2025-01-04

Change Log:
-----------
2025-01-04 - Chris Bunting - Initial creation
*/

import { config } from '../config/index.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: any;
}

export interface SecurityContext {
  correlationId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class InputValidator {
  private static readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /<meta\b[^>]*>/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
  ];

  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(--|\#|\/\*|\*\/)/gi,
    /(\bOR\b.*=.*\bOR\b)/gi,
    /(\bAND\b.*=.*\bAND\b)/gi,
    /(\bxp_cmdshell\b)/gi,
    /(\bsp_executesql\b)/gi,
  ];

  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.\//g,
    /\.\.\\/g,
    /\//g,
    /\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e\\/gi,
    /\.\.%2f/gi,
    /\.\.%5c/gi,
  ];

  private static readonly ALLOWED_LANGUAGES = new Set(config.security.inputValidation.allowedLanguages);

  static validateString(input: any, fieldName: string, options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    sanitize?: boolean;
    allowHtml?: boolean;
  } = {}): ValidationResult {
    const errors: string[] = [];
    let sanitized = input;

    // Check if required
    if (options.required && (input === null || input === undefined || input === '')) {
      errors.push(`${fieldName} is required`);
      return { isValid: false, errors };
    }

    // If not required and empty, return valid
    if (!options.required && (input === null || input === undefined || input === '')) {
      return { isValid: true, errors: [] };
    }

    // Convert to string
    if (typeof input !== 'string') {
      errors.push(`${fieldName} must be a string`);
      return { isValid: false, errors };
    }

    // Length validation
    if (options.minLength && input.length < options.minLength) {
      errors.push(`${fieldName} must be at least ${options.minLength} characters long`);
    }

    if (options.maxLength && input.length > options.maxLength) {
      errors.push(`${fieldName} must not exceed ${options.maxLength} characters`);
    }

    // Pattern validation
    if (options.pattern && !options.pattern.test(input)) {
      errors.push(`${fieldName} format is invalid`);
    }

    // Sanitization
    if (options.sanitize !== false) {
      sanitized = this.sanitizeString(input, options.allowHtml || false);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }

  static validateLanguage(language: any): ValidationResult {
    const errors: string[] = [];
    let sanitized = language;

    if (typeof language !== 'string') {
      errors.push('Language must be a string');
      return { isValid: false, errors };
    }

    const normalizedLang = language.toLowerCase().trim();
    
    if (!this.ALLOWED_LANGUAGES.has(normalizedLang)) {
      errors.push(`Language '${language}' is not supported. Allowed languages: ${Array.from(this.ALLOWED_LANGUAGES).join(', ')}`);
    }

    sanitized = normalizedLang;

    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }

  static validateCode(code: any, language: string): ValidationResult {
    const errors: string[] = [];
    let sanitized = code;

    // Basic string validation
    const stringValidation = this.validateString(code, 'code', {
      required: true,
      maxLength: config.security.inputValidation.maxCodeLength,
      sanitize: false // We'll handle code-specific sanitization
    });

    if (!stringValidation.isValid) {
      return stringValidation;
    }

    // Language-specific validation
    if (typeof code === 'string') {
      // Check for potentially dangerous patterns
      const dangerousPatterns = [
        /eval\s*\(/gi,
        /Function\s*\(/gi,
        /setTimeout\s*\(/gi,
        /setInterval\s*\(/gi,
        /require\s*\(/gi,
        /import\s+.*\s+from/gi,
        /exec\s*\(/gi,
        /system\s*\(/gi,
        /subprocess\./gi,
        /os\./gi,
        /child_process\./gi,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          errors.push(`Code contains potentially dangerous pattern: ${pattern.source}`);
        }
      }

      // Basic syntax validation for common languages
      try {
        switch (language) {
          case 'javascript':
          case 'typescript':
            // Basic JS/TS syntax check
            new Function(code);
            break;
          case 'python':
            // Basic Python syntax check (simplified)
            if (code.includes('import os') || code.includes('import subprocess')) {
              errors.push('Code imports potentially dangerous modules');
            }
            break;
        }
      } catch (syntaxError) {
        errors.push(`Code syntax error: ${syntaxError instanceof Error ? syntaxError.message : String(syntaxError)}`);
      }
    }

    // Sanitize code (remove potentially dangerous content)
    if (typeof code === 'string') {
      sanitized = this.sanitizeCode(code);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }

  static validateQuery(query: any): ValidationResult {
    const errors: string[] = [];
    let sanitized = query;

    const stringValidation = this.validateString(query, 'query', {
      required: true,
      minLength: 1,
      maxLength: config.security.inputValidation.maxQueryLength,
      sanitize: true
    });

    if (!stringValidation.isValid) {
      return stringValidation;
    }

    // Additional query-specific validation
    if (typeof query === 'string') {
      // Check for SQL injection attempts
      for (const pattern of this.SQL_INJECTION_PATTERNS) {
        if (pattern.test(query)) {
          errors.push('Query contains potentially malicious SQL patterns');
        }
      }

      // Check for XSS attempts
      for (const pattern of this.XSS_PATTERNS) {
        if (pattern.test(query)) {
          errors.push('Query contains potentially malicious XSS patterns');
        }
      }
    }

    sanitized = stringValidation.sanitized;

    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }

  static validateUrl(url: any): ValidationResult {
    const errors: string[] = [];
    let sanitized = url;

    if (typeof url !== 'string') {
      errors.push('URL must be a string');
      return { isValid: false, errors };
    }

    try {
      const parsedUrl = new URL(url);
      
      // Only allow HTTPS and HTTP
      if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
        errors.push('Only HTTP and HTTPS URLs are allowed');
      }

      // Prevent localhost and private IP addresses
      const hostname = parsedUrl.hostname;
      if (hostname && (
        hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('172.') ||
        hostname.includes('.local') ||
        hostname.includes('.internal')
      )) {
        errors.push('URLs pointing to internal or private addresses are not allowed');
      }

      sanitized = parsedUrl.toString();
    } catch (error) {
      errors.push('Invalid URL format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }

  static validateFilePath(filePath: any): ValidationResult {
    const errors: string[] = [];
    let sanitized = filePath;

    if (typeof filePath !== 'string') {
      errors.push('File path must be a string');
      return { isValid: false, errors };
    }

    // Check for path traversal attempts
    for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(filePath)) {
        errors.push('File path contains potentially dangerous traversal patterns');
      }
    }

    // Normalize path
    sanitized = filePath.replace(/[\/\\]/g, '_').replace(/\.\./g, '_');

    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }

  private static sanitizeString(input: string, allowHtml: boolean = false): string {
    let sanitized = input.trim();

    if (!allowHtml) {
      // Remove HTML tags
      sanitized = sanitized.replace(/<[^>]*>/g, '');
      
      // Remove XSS patterns
      for (const pattern of this.XSS_PATTERNS) {
        sanitized = sanitized.replace(pattern, '');
      }
    }

    // Remove SQL injection patterns
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Escape special characters
    sanitized = sanitized
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    return sanitized;
  }

  private static sanitizeCode(code: string): string {
    // Remove potentially dangerous function calls while preserving code structure
    let sanitized = code;

    // Comment out dangerous imports
    sanitized = sanitized.replace(/(import\s+(?:.*\s+from\s+)?['"`](?:os|subprocess|child_process|fs|path|net|http|https)['"`])/g, '// $1');
    
    // Comment out dangerous function calls
    const dangerousFunctions = [
      'eval', 'Function', 'setTimeout', 'setInterval', 'exec', 'system',
      'spawn', 'execSync', 'require', 'import'
    ];

    for (const func of dangerousFunctions) {
      const regex = new RegExp(`\\b${func}\\s*\\(`, 'gi');
      sanitized = sanitized.replace(regex, `/* ${func} */ `);
    }

    return sanitized;
  }

  static createSecurityContext(context: Partial<SecurityContext>): SecurityContext {
    return {
      correlationId: context.correlationId || this.generateCorrelationId(),
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    };
  }

  private static generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static logValidationAttempt(context: SecurityContext, validation: ValidationResult, field: string): void {
    const logData = {
      correlationId: context.correlationId,
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      field,
      isValid: validation.isValid,
      errors: validation.errors,
      timestamp: new Date().toISOString(),
    };

    if (config.logging.auditEnabled) {
      console.error('VALIDATION_ATTEMPT', JSON.stringify(logData));
    }
  }
}

export default InputValidator;