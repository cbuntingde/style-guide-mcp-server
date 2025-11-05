/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: database/optimized-db.ts
Description: Optimized database layer with connection pooling and performance enhancements

Created: 2025-01-05
Last Modified: 2025-01-05

Change Log:
-----------
2025-01-05 - Chris Bunting - Initial creation with performance optimizations
*/

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config/index.js';

interface DatabaseOptions {
  readonly: boolean;
  fileMustExist: boolean;
  timeout: number;
  verbose?: ((message?: unknown, ...additionalArgs: unknown[]) => void) | undefined;
}

interface QueryStats {
  query: string;
  count: number;
  totalTime: number;
  avgTime: number;
}

export class OptimizedDatabase {
  private db: Database.Database;
  private queryStats: Map<string, QueryStats> = new Map();
  private preparedStatements: Map<string, Database.Statement> = new Map();
  private transactionQueue: Array<() => void> = [];
  private isTransactionInProgress = false;

  constructor(dbPath: string, options: Partial<DatabaseOptions> = {}) {
    const defaultOptions: DatabaseOptions = {
      readonly: false,
      fileMustExist: false,
      timeout: 30000,
      verbose: config.logging.level === 'debug' ? console.log : undefined
    };

    const finalOptions = { ...defaultOptions, ...options };

    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath, finalOptions);
    
    // Performance optimizations
    this.configurePerformanceSettings();
    this.initializeSchema();
    this.prepareCommonStatements();
  }

  private configurePerformanceSettings(): void {
    // Enable WAL mode for better concurrency
    this.db.exec('PRAGMA journal_mode = WAL');
    
    // Increase cache size (default is 2MB, set to 64MB)
    this.db.exec('PRAGMA cache_size = -65536');
    
    // Enable foreign key constraints
    this.db.exec('PRAGMA foreign_keys = ON');
    
    // Optimize for SSD storage
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA temp_store = MEMORY');
    
    // Set busy timeout to handle contention
    this.db.exec('PRAGMA busy_timeout = 30000');
    
    // Enable query planner optimizations
    this.db.exec('PRAGMA optimize');
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guidelines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        section TEXT,
        category TEXT,
        priority INTEGER DEFAULT 5,
        fetched_at INTEGER NOT NULL,
        is_custom INTEGER DEFAULT 0,
        UNIQUE(language, source_name, section)
      );

      CREATE TABLE IF NOT EXISTS code_examples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guideline_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        description TEXT,
        is_good_example INTEGER DEFAULT 1,
        FOREIGN KEY (guideline_id) REFERENCES guidelines(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS security_guidelines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language TEXT,
        vulnerability_type TEXT NOT NULL,
        description TEXT NOT NULL,
        mitigation TEXT NOT NULL,
        severity TEXT,
        cwe_id TEXT,
        fetched_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS code_analysis_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language TEXT NOT NULL,
        rule_name TEXT NOT NULL,
        pattern TEXT NOT NULL,
        severity TEXT DEFAULT 'warning',
        message TEXT NOT NULL,
        suggestion TEXT,
        category TEXT,
        enabled INTEGER DEFAULT 1,
        UNIQUE(language, rule_name)
      );

      -- Optimized indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_guidelines_language ON guidelines(language);
      CREATE INDEX IF NOT EXISTS idx_guidelines_category ON guidelines(category);
      CREATE INDEX IF NOT EXISTS idx_guidelines_priority ON guidelines(priority);
      CREATE INDEX IF NOT EXISTS idx_guidelines_fetched_at ON guidelines(fetched_at);
      CREATE INDEX IF NOT EXISTS idx_guidelines_language_category ON guidelines(language, category);
      
      CREATE INDEX IF NOT EXISTS idx_security_language ON security_guidelines(language);
      CREATE INDEX IF NOT EXISTS idx_security_vuln ON security_guidelines(vulnerability_type);
      CREATE INDEX IF NOT EXISTS idx_security_severity ON security_guidelines(severity);
      
      CREATE INDEX IF NOT EXISTS idx_rules_language ON code_analysis_rules(language);
      CREATE INDEX IF NOT EXISTS idx_rules_enabled ON code_analysis_rules(enabled);
      CREATE INDEX IF NOT EXISTS idx_rules_category ON code_analysis_rules(category);
    `);

    this.addDefaultAnalysisRules();
  }

  private prepareCommonStatements(): void {
    // Prepare frequently used statements for better performance
    const statements = [
      'SELECT * FROM guidelines WHERE language = ? ORDER BY priority ASC, source_name ASC',
      'SELECT * FROM guidelines WHERE language = ? AND category = ? ORDER BY priority ASC, source_name ASC',
      'SELECT * FROM guidelines WHERE content LIKE ? OR title LIKE ? OR section LIKE ? ORDER BY priority ASC LIMIT 20',
      'SELECT * FROM security_guidelines WHERE language = ? OR language IS NULL',
      'SELECT * FROM security_guidelines WHERE vulnerability_type LIKE ?',
      'SELECT * FROM code_analysis_rules WHERE language = ? AND enabled = 1',
      'SELECT MAX(fetched_at) as last_fetch FROM guidelines WHERE language = ? AND source_name = ?'
    ];

    statements.forEach(sql => {
      try {
        const stmt = this.db.prepare(sql);
        this.preparedStatements.set(sql, stmt);
      } catch (error) {
        console.error(`Failed to prepare statement: ${sql}`, error);
      }
    });
  }

  private addDefaultAnalysisRules(): void {
    const rules = [
      {
        language: "javascript",
        rule_name: "no-var",
        pattern: "\\bvar\\s+",
        severity: "warning",
        message: "Use 'let' or 'const' instead of 'var'",
        suggestion: "Replace 'var' with 'const' or 'let'",
        category: "best-practices",
      },
      {
        language: "javascript",
        rule_name: "prefer-const",
        pattern: "\\blet\\s+\\w+\\s*=\\s*[^;]+;(?!.*\\1\\s*=)",
        severity: "info",
        message: "Variable never reassigned, use 'const'",
        suggestion: "Change 'let' to 'const' for variables that are never reassigned",
        category: "best-practices",
      },
      {
        language: "typescript",
        rule_name: "no-any",
        pattern: ":\\s*any\\b",
        severity: "warning",
        message: "Avoid using 'any' type",
        suggestion: "Use specific types instead of 'any'",
        category: "types",
      },
      {
        language: "python",
        rule_name: "no-bare-except",
        pattern: "except\\s*:",
        severity: "error",
        message: "Bare 'except:' catches all exceptions including system exits",
        suggestion: "Specify exception types or use 'except Exception:'",
        category: "error-handling",
      },
    ];

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO code_analysis_rules 
      (language, rule_name, pattern, severity, message, suggestion, category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Use transaction for bulk insert
    const transaction = this.db.transaction(() => {
      for (const rule of rules) {
        stmt.run(
          rule.language,
          rule.rule_name,
          rule.pattern,
          rule.severity,
          rule.message,
          rule.suggestion,
          rule.category
        );
      }
    });

    transaction();
  }

  private executeQuery<T>(sql: string, params: any[] = []): T[] {
    const startTime = Date.now();
    
    try {
      let stmt = this.preparedStatements.get(sql);
      if (!stmt) {
        stmt = this.db.prepare(sql);
        // Cache the statement for future use
        if (this.preparedStatements.size < 100) { // Limit cache size
          this.preparedStatements.set(sql, stmt);
        }
      }

      const result = stmt.all(...params) as T[];
      
      // Update query statistics
      this.updateQueryStats(sql, Date.now() - startTime);
      
      return result;
    } catch (error) {
      console.error(`Query execution failed: ${sql}`, error);
      throw error;
    }
  }

  private updateQueryStats(sql: string, duration: number): void {
    const existing = this.queryStats.get(sql);
    if (existing) {
      existing.count++;
      existing.totalTime += duration;
      existing.avgTime = existing.totalTime / existing.count;
    } else {
      this.queryStats.set(sql, {
        query: sql,
        count: 1,
        totalTime: duration,
        avgTime: duration
      });
    }
  }

  // Public API methods
  getGuidelines(language: string, category?: string): any[] {
    if (category) {
      return this.executeQuery(
        'SELECT * FROM guidelines WHERE language = ? AND category = ? ORDER BY priority ASC, source_name ASC',
        [language, category]
      );
    }
    return this.executeQuery(
      'SELECT * FROM guidelines WHERE language = ? ORDER BY priority ASC, source_name ASC',
      [language]
    );
  }

  searchGuidelines(searchTerm: string, language?: string): any[] {
    const params = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];
    let sql = 'SELECT * FROM guidelines WHERE (content LIKE ? OR title LIKE ? OR section LIKE ?)';
    
    if (language) {
      sql += ' AND language = ?';
      params.push(language);
    }
    
    sql += ' ORDER BY priority ASC LIMIT 20';
    
    return this.executeQuery(sql, params);
  }

  getSecurityGuidelines(language?: string, vulnerabilityType?: string): any[] {
    if (vulnerabilityType) {
      return this.executeQuery(
        'SELECT * FROM security_guidelines WHERE vulnerability_type LIKE ?',
        [`%${vulnerabilityType}%`]
      );
    }
    
    if (language) {
      return this.executeQuery(
        'SELECT * FROM security_guidelines WHERE language = ? OR language IS NULL',
        [language]
      );
    }
    
    return this.executeQuery('SELECT * FROM security_guidelines', []);
  }

  getAnalysisRules(language: string): any[] {
    return this.executeQuery(
      'SELECT * FROM code_analysis_rules WHERE language = ? AND enabled = 1',
      [language]
    );
  }

  insertGuideline(data: {
    language: string;
    sourceName: string;
    sourceUrl: string;
    title?: string;
    content: string;
    section?: string;
    category?: string;
    priority: number;
    isCustom?: boolean;
  }): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO guidelines 
      (language, source_name, source_url, title, content, section, category, priority, fetched_at, is_custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      data.language,
      data.sourceName,
      data.sourceUrl,
      data.title || null,
      data.content,
      data.section || null,
      data.category || null,
      data.priority,
      Date.now(),
      data.isCustom ? 1 : 0
    );
  }

  insertSecurityGuideline(data: {
    language?: string;
    vulnerabilityType: string;
    description: string;
    mitigation: string;
    severity?: string;
    cweId?: string;
  }): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO security_guidelines 
      (language, vulnerability_type, description, mitigation, severity, cwe_id, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      data.language || null,
      data.vulnerabilityType,
      data.description,
      data.mitigation,
      data.severity || null,
      data.cweId || null,
      Date.now()
    );
  }

  needsUpdate(language: string, sourceName: string): boolean {
    const result = this.executeQuery<{ last_fetch: number | null }>(
      'SELECT MAX(fetched_at) as last_fetch FROM guidelines WHERE language = ? AND source_name = ?',
      [language, sourceName]
    )[0];

    if (!result.last_fetch) return true;

    return Date.now() - result.last_fetch > config.caching.ttl;
  }

  // Performance monitoring
  getQueryStats(): QueryStats[] {
    return Array.from(this.queryStats.values())
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 20); // Top 20 slowest queries
  }

  optimize(): void {
    // Run SQLite's ANALYZE command to update query planner statistics
    this.db.exec('ANALYZE');
    this.db.exec('PRAGMA optimize');
    
    // Clear prepared statements cache to force recompilation
    this.preparedStatements.clear();
    this.prepareCommonStatements();
  }

  vacuum(): void {
    // Rebuild the database file to reclaim space
    this.db.exec('VACUUM');
  }

  close(): void {
    this.preparedStatements.clear();
    this.queryStats.clear();
    this.db.close();
  }

  // Transaction management
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // Batch operations for better performance
  bulkInsertGuidelines(guidelines: any[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO guidelines 
      (language, source_name, source_url, title, content, section, category, priority, fetched_at, is_custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const guideline of guidelines) {
        stmt.run(
          guideline.language,
          guideline.sourceName,
          guideline.sourceUrl,
          guideline.title || null,
          guideline.content,
          guideline.section || null,
          guideline.category || null,
          guideline.priority,
          Date.now(),
          guideline.isCustom ? 1 : 0
        );
      }
    });

    transaction();
  }
}