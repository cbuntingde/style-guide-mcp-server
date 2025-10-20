/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: tests/unit/validation.test.ts
Description: Unit tests for input validation and sanitization

Created: 2025-01-04
Last Modified: 2025-01-04

Change Log:
-----------
2025-01-04 - Chris Bunting - Initial creation
*/

// Note: These tests should be run with a test framework like Mocha or Jest
// The test runner should provide describe, it, expect, beforeEach, afterEach globals

// Mock test framework globals for TypeScript compilation
declare global {
  function describe(name: string, fn: () => void): void;
  function it(name: string, fn: () => void): void;
  function expect(actual: any): any;
  function beforeEach(fn: () => void): void;
  function afterEach(fn: () => void): void;
}
import { InputValidator } from '../../src/validation/index.js';
import TestUtils from '../setup.js';

describe('InputValidator', () => {
  beforeEach(async () => {
    await TestUtils.cleanupTestData();
  });

  afterEach(async () => {
    await TestUtils.cleanupTestData();
  });

  describe('validateString', () => {
    it('should validate valid string input', () => {
      const result = InputValidator.validateString('test input', 'testField');
      
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
      expect(result.sanitized).to.equal('test input');
    });

    it('should reject empty required string', () => {
      const result = InputValidator.validateString('', 'testField', { required: true });
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('testField is required');
    });

    it('should accept empty optional string', () => {
      const result = InputValidator.validateString('', 'testField', { required: false });
      
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should enforce minimum length', () => {
      const result = InputValidator.validateString('ab', 'testField', { minLength: 5 });
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('testField must be at least 5 characters long');
    });

    it('should enforce maximum length', () => {
      const longString = 'a'.repeat(101);
      const result = InputValidator.validateString(longString, 'testField', { maxLength: 100 });
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('testField must not exceed 100 characters');
    });

    it('should validate pattern', () => {
      const result = InputValidator.validateString('abc123', 'testField', { 
        pattern: /^[a-z]+$/ 
      });
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('testField format is invalid');
    });

    it('should sanitize HTML by default', () => {
      const result = InputValidator.validateString('<script>alert("xss")</script>', 'testField');
      
      expect(result.isValid).to.be.true;
      expect(result.sanitized).to.not.include('<script>');
      expect(result.sanitized).to.include('<script>');
    });

    it('should allow HTML when specified', () => {
      const result = InputValidator.validateString('<p>Valid HTML</p>', 'testField', { 
        allowHtml: true 
      });
      
      expect(result.isValid).to.be.true;
      expect(result.sanitized).to.include('<p>');
    });

    it('should reject non-string input', () => {
      const result = InputValidator.validateString(123, 'testField');
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('testField must be a string');
    });
  });

  describe('validateLanguage', () => {
    it('should validate allowed languages', () => {
      const result = InputValidator.validateLanguage('typescript');
      
      expect(result.isValid).to.be.true;
      expect(result.sanitized).to.equal('typescript');
    });

    it('should normalize language case', () => {
      const result = InputValidator.validateLanguage('TypeScript');
      
      expect(result.isValid).to.be.true;
      expect(result.sanitized).to.equal('typescript');
    });

    it('should reject unsupported languages', () => {
      const result = InputValidator.validateLanguage('ruby');
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include("Language 'ruby' is not supported");
    });

    it('should reject non-string input', () => {
      const result = InputValidator.validateLanguage(123);
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('Language must be a string');
    });
  });

  describe('validateCode', () => {
    it('should validate safe code', () => {
      const code = 'const x = 5; console.log(x);';
      const result = InputValidator.validateCode(code, 'javascript');
      
      expect(result.isValid).to.be.true;
      expect(result.sanitized).to.be.a('string');
    });

    it('should reject code with dangerous patterns', () => {
      const code = 'eval("malicious code")';
      const result = InputValidator.validateCode(code, 'javascript');
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.not.be.empty;
    });

    it('should reject code exceeding maximum length', () => {
      const code = 'a'.repeat(10001);
      const result = InputValidator.validateCode(code, 'javascript');
      
      expect(result.isValid).to.be.false;
      expect(result.errors.some(e => e.includes('must not exceed'))).to.be.true;
    });

    it('should sanitize dangerous imports', () => {
      const code = 'import os from "os"; os.exec("ls")';
      const result = InputValidator.validateCode(code, 'python');
      
      expect(result.sanitized).to.include('// import');
    });
  });

  describe('validateQuery', () => {
    it('should validate safe queries', () => {
      const query = 'naming conventions';
      const result = InputValidator.validateQuery(query);
      
      expect(result.isValid).to.be.true;
      expect(result.sanitized).to.be.a('string');
    });

    it('should detect SQL injection attempts', () => {
      const query = "SELECT * FROM users WHERE '1'='1'";
      const result = InputValidator.validateQuery(query);
      
      expect(result.isValid).to.be.false;
      expect(result.errors.some(e => e.includes('malicious'))).to.be.true;
    });

    it('should detect XSS attempts', () => {
      const query = '<script>alert("xss")</script>';
      const result = InputValidator.validateQuery(query);
      
      expect(result.isValid).to.be.false;
      expect(result.errors.some(e => e.includes('malicious'))).to.be.true;
    });

    it('should enforce maximum length', () => {
      const query = 'a'.repeat(1001);
      const result = InputValidator.validateQuery(query);
      
      expect(result.isValid).to.be.false;
      expect(result.errors.some(e => e.includes('must not exceed'))).to.be.true;
    });
  });

  describe('validateUrl', () => {
    it('should validate HTTPS URLs', () => {
      const url = 'https://example.com';
      const result = InputValidator.validateUrl(url);
      
      expect(result.isValid).to.be.true;
      expect(result.sanitized).to.equal(url);
    });

    it('should validate HTTP URLs', () => {
      const url = 'http://example.com';
      const result = InputValidator.validateUrl(url);
      
      expect(result.isValid).to.be.true;
      expect(result.sanitized).to.equal(url);
    });

    it('should reject non-HTTP/HTTPS protocols', () => {
      const url = 'ftp://example.com';
      const result = InputValidator.validateUrl(url);
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('Only HTTP and HTTPS URLs are allowed');
    });

    it('should reject localhost URLs', () => {
      const url = 'http://localhost:3000';
      const result = InputValidator.validateUrl(url);
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('URLs pointing to internal or private addresses are not allowed');
    });

    it('should reject private IP addresses', () => {
      const url = 'http://192.168.1.1';
      const result = InputValidator.validateUrl(url);
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('URLs pointing to internal or private addresses are not allowed');
    });

    it('should reject invalid URLs', () => {
      const url = 'not-a-url';
      const result = InputValidator.validateUrl(url);
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('Invalid URL format');
    });
  });

  describe('validateFilePath', () => {
    it('should validate safe file paths', () => {
      const path = 'documents/file.txt';
      const result = InputValidator.validateFilePath(path);
      
      expect(result.isValid).to.be.true;
      expect(result.sanitized).to.be.a('string');
    });

    it('should detect path traversal attempts', () => {
      const path = '../../../etc/passwd';
      const result = InputValidator.validateFilePath(path);
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('File path contains potentially dangerous traversal patterns');
    });

    it('should normalize dangerous paths', () => {
      const path = '../../../dangerous/file';
      const result = InputValidator.validateFilePath(path);
      
      expect(result.sanitized).to.not.include('..');
      expect(result.sanitized).to.include('_');
    });

    it('should reject non-string input', () => {
      const result = InputValidator.validateFilePath(123);
      
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('File path must be a string');
    });
  });

  describe('createSecurityContext', () => {
    it('should create security context with correlation ID', () => {
      const context = InputValidator.createSecurityContext({
        userId: 'test-user',
        ipAddress: '192.168.1.1',
      });
      
      expect(context.correlationId).to.be.a('string');
      expect(context.correlationId).to.startWith('corr_');
      expect(context.userId).to.equal('test-user');
      expect(context.ipAddress).to.equal('192.168.1.1');
    });

    it('should use provided correlation ID', () => {
      const correlationId = 'custom-corr-id';
      const context = InputValidator.createSecurityContext({
        correlationId,
      });
      
      expect(context.correlationId).to.equal(correlationId);
    });
  });

  describe('logValidationAttempt', () => {
    it('should not throw when logging validation attempts', () => {
      const context = InputValidator.createSecurityContext({});
      const validation = { isValid: true, errors: [] };
      
      expect(() => {
        InputValidator.logValidationAttempt(context, validation, 'testField');
      }).to.not.throw();
    });
  });
});