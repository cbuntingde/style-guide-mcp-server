/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: tests/setup.ts
Description: Test setup and configuration for enterprise testing suite

Created: 2025-01-04
Last Modified: 2025-01-04

Change Log:
-----------
2025-01-04 - Chris Bunting - Initial creation
*/

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test environment setup
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.STRUCTURED_LOGGING = 'true';
process.env.AUDIT_LOGGING_ENABLED = 'false';
process.env.RATE_LIMITING_ENABLED = 'false';
process.env.MONITORING_ENABLED = 'false';

// Test database path
process.env.DATABASE_PATH = path.join(__dirname, '../data/test-styleguides.db');
process.env.DATABASE_BACKUP_ENABLED = 'false';
process.env.DATABASE_ENCRYPTION_ENABLED = 'false';

// Test configuration
process.env.SERVER_NAME = 'test-style-guide-server';
process.env.SERVER_VERSION = '2.0.0-test';

// Security settings for testing
process.env.MAX_QUERY_LENGTH = '1000';
process.env.MAX_CODE_LENGTH = '10000';
process.env.ALLOWED_LANGUAGES = 'typescript,javascript,python,cpp,java,go,rust';

// Create test directories
const testDirs = [
  path.join(__dirname, '../data'),
  path.join(__dirname, '../logs'),
  path.join(__dirname, '../exports'),
  path.join(__dirname, '../temp'),
];

testDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Global test utilities
export const TestUtils = {
  // Clean up test data
  cleanupTestData: async (): Promise<void> => {
    const testDbPath = process.env.DATABASE_PATH!;
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Clean up temp files
    const tempDir = path.join(__dirname, '../temp');
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(tempDir, file));
      });
    }
  },

  // Create mock data
  createMockStyleGuideData: () => ({
    language: 'typescript',
    sourceName: 'Test Guide',
    sourceUrl: 'https://example.com/test',
    title: 'Test Title',
    content: 'This is test content for style guidelines.',
    section: 'test-section',
    category: 'general',
    priority: 1,
    isCustom: false,
  }),

  // Create mock security guideline
  createMockSecurityGuideline: () => ({
    language: 'typescript',
    vulnerabilityType: 'Test Vulnerability',
    description: 'This is a test vulnerability description.',
    mitigation: 'This is a test mitigation strategy.',
    severity: 'Medium' as const,
    cweId: 'CWE-TEST',
  }),

  // Wait for async operations
  waitFor: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Generate random test data
  randomString: (length: number = 10): string => {
    return Math.random().toString(36).substring(2, 2 + length);
  },

  // Generate test correlation ID
  generateCorrelationId: (): string => {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
};

// Note: Test hooks should be implemented in the specific test runner configuration
// These are provided as examples for different test frameworks:

// For Jest (add to jest.config.js):
// global.beforeEach = async () => {
//   await TestUtils.cleanupTestData();
// };
// global.afterEach = async () => {
//   await TestUtils.cleanupTestData();
// };
// global.afterAll = async () => {
//   await TestUtils.cleanupTestData();
// };

// For Mocha (add to test files):
// beforeEach(async () => {
//   await TestUtils.cleanupTestData();
// });
// afterEach(async () => {
//   await TestUtils.cleanupTestData();
// });
// after(async () => {
//   await TestUtils.cleanupTestData();
// });

// Export for use in test files
export default TestUtils;