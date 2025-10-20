/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: config/index.ts
Description: Enterprise configuration management with environment variables and validation

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

export interface AppConfig {
  server: {
    name: string;
    version: string;
    port?: number;
    host?: string;
  };
  database: {
    path: string;
    backupEnabled: boolean;
    backupInterval: number;
    encryptionEnabled: boolean;
    encryptionKey?: string;
  };
  security: {
    rateLimiting: {
      enabled: boolean;
      windowMs: number;
      maxRequests: number;
    };
    inputValidation: {
      maxQueryLength: number;
      maxCodeLength: number;
      allowedLanguages: string[];
    };
    encryption: {
      algorithm: string;
      keyRotationInterval: number;
    };
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    structured: boolean;
    correlationIds: boolean;
    auditEnabled: boolean;
    retentionDays: number;
  };
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    healthCheckInterval: number;
  };
  sources: {
    [language: string]: Array<{
      name: string;
      url: string;
      type: string;
      priority: number;
      timeout?: number;
    }>;
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

function validateConfig(config: AppConfig): void {
  // Validate database path
  if (!config.database.path) {
    throw new Error('Database path is required');
  }

  // Validate security settings
  if (config.security.rateLimiting.maxRequests <= 0) {
    throw new Error('Rate limiting max requests must be positive');
  }

  // Validate logging
  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLevels.includes(config.logging.level)) {
    throw new Error(`Invalid log level: ${config.logging.level}`);
  }

  // Validate encryption
  const validAlgorithms = ['aes-256-gcm', 'aes-256-cbc'];
  if (!validAlgorithms.includes(config.security.encryption.algorithm)) {
    throw new Error(`Invalid encryption algorithm: ${config.security.encryption.algorithm}`);
  }
}

export function loadConfig(): AppConfig {
  const config: AppConfig = {
    server: {
      name: getEnvVar('SERVER_NAME', 'style-guide-server'),
      version: getEnvVar('SERVER_VERSION', '2.0.0'),
      port: getEnvNumber('SERVER_PORT', 0), // 0 means stdio for MCP
      host: getEnvVar('SERVER_HOST', 'localhost'),
    },
    database: {
      path: getEnvVar('DATABASE_PATH', path.join(__dirname, '../../data/styleguides.db')),
      backupEnabled: getEnvBoolean('DATABASE_BACKUP_ENABLED', true),
      backupInterval: getEnvNumber('DATABASE_BACKUP_INTERVAL', 24 * 60 * 60 * 1000), // 24 hours
      encryptionEnabled: getEnvBoolean('DATABASE_ENCRYPTION_ENABLED', false),
      encryptionKey: process.env.DATABASE_ENCRYPTION_KEY,
    },
    security: {
      rateLimiting: {
        enabled: getEnvBoolean('RATE_LIMITING_ENABLED', true),
        windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60 * 1000), // 1 minute
        maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
      },
      inputValidation: {
        maxQueryLength: getEnvNumber('MAX_QUERY_LENGTH', 1000),
        maxCodeLength: getEnvNumber('MAX_CODE_LENGTH', 10000),
        allowedLanguages: getEnvVar('ALLOWED_LANGUAGES', 'typescript,javascript,python,cpp,java,go,rust').split(','),
      },
      encryption: {
        algorithm: getEnvVar('ENCRYPTION_ALGORITHM', 'aes-256-gcm'),
        keyRotationInterval: getEnvNumber('KEY_ROTATION_INTERVAL', 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    },
    logging: {
      level: getEnvVar('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
      structured: getEnvBoolean('STRUCTURED_LOGGING', true),
      correlationIds: getEnvBoolean('CORRELATION_IDS', true),
      auditEnabled: getEnvBoolean('AUDIT_LOGGING_ENABLED', true),
      retentionDays: getEnvNumber('LOG_RETENTION_DAYS', 90),
    },
    caching: {
      enabled: getEnvBoolean('CACHING_ENABLED', true),
      ttl: getEnvNumber('CACHE_TTL', 24 * 60 * 60 * 1000), // 24 hours
      maxSize: getEnvNumber('CACHE_MAX_SIZE', 1000),
    },
    monitoring: {
      enabled: getEnvBoolean('MONITORING_ENABLED', true),
      metricsInterval: getEnvNumber('METRICS_INTERVAL', 60 * 1000), // 1 minute
      healthCheckInterval: getEnvNumber('HEALTH_CHECK_INTERVAL', 30 * 1000), // 30 seconds
    },
    sources: {
      typescript: [
        {
          name: "Google TypeScript Style Guide",
          url: getEnvVar('TS_GOOGLE_STYLE_GUIDE_URL', 'https://google.github.io/styleguide/tsguide.html'),
          type: "html",
          priority: 1,
          timeout: getEnvNumber('FETCH_TIMEOUT', 30000),
        },
        {
          name: "TypeScript Best Practices",
          url: getEnvVar('TS_BEST_PRACTICES_URL', 'https://github.com/andredesousa/typescript-best-practices'),
          type: "github-readme",
          priority: 2,
          timeout: getEnvNumber('FETCH_TIMEOUT', 30000),
        },
      ],
      javascript: [
        {
          name: "Google JavaScript Style Guide",
          url: getEnvVar('JS_GOOGLE_STYLE_GUIDE_URL', 'https://google.github.io/styleguide/jsguide.html'),
          type: "html",
          priority: 1,
          timeout: getEnvNumber('FETCH_TIMEOUT', 30000),
        },
      ],
      python: [
        {
          name: "Google Python Style Guide",
          url: getEnvVar('PYTHON_GOOGLE_STYLE_GUIDE_URL', 'https://google.github.io/styleguide/pyguide.html'),
          type: "html",
          priority: 1,
          timeout: getEnvNumber('FETCH_TIMEOUT', 30000),
        },
        {
          name: "PEP 8",
          url: getEnvVar('PYTHON_PEP8_URL', 'https://peps.python.org/pep-0008/'),
          type: "html",
          priority: 1,
          timeout: getEnvNumber('FETCH_TIMEOUT', 30000),
        },
      ],
      cpp: [
        {
          name: "Google C++ Style Guide",
          url: getEnvVar('CPP_GOOGLE_STYLE_GUIDE_URL', 'https://google.github.io/styleguide/cppguide.html'),
          type: "html",
          priority: 1,
          timeout: getEnvNumber('FETCH_TIMEOUT', 30000),
        },
      ],
      java: [
        {
          name: "Google Java Style Guide",
          url: getEnvVar('JAVA_GOOGLE_STYLE_GUIDE_URL', 'https://google.github.io/styleguide/javaguide.html'),
          type: "html",
          priority: 1,
          timeout: getEnvNumber('FETCH_TIMEOUT', 30000),
        },
      ],
      go: [
        {
          name: "Effective Go",
          url: getEnvVar('GO_EFFECTIVE_GO_URL', 'https://go.dev/doc/effective_go'),
          type: "html",
          priority: 1,
          timeout: getEnvNumber('FETCH_TIMEOUT', 30000),
        },
      ],
      rust: [
        {
          name: "Rust API Guidelines",
          url: getEnvVar('RUST_API_GUIDELINES_URL', 'https://rust-lang.github.io/api-guidelines/'),
          type: "html",
          priority: 1,
          timeout: getEnvNumber('FETCH_TIMEOUT', 30000),
        },
      ],
    },
  };

  validateConfig(config);
  return config;
}

export const config = loadConfig();

// Ensure required directories exist
export function ensureDirectories(): void {
  const dirs = [
    path.dirname(config.database.path),
    path.join(__dirname, '../../data'),
    path.join(__dirname, '../../exports'),
    path.join(__dirname, '../../logs'),
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}