/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: index.ts
Description: Main entry point for the Style Guide MCP Server

Created: 2025-01-04
Last Modified: 2025-01-04

Change Log:
-----------
2025-01-04 - Chris Bunting - Initial creation
*/

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { marked } from "marked";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Type definitions for better type safety
interface Guideline {
  id: number;
  language: string;
  source_name: string;
  source_url: string;
  title: string | null;
  content: string;
  section: string | null;
  category: string | null;
  priority: number;
  fetched_at: number;
  is_custom: number;
}

interface SecurityGuideline {
  id: number;
  language: string | null;
  vulnerability_type: string;
  description: string;
  mitigation: string;
  severity: string | null;
  cwe_id: string | null;
  fetched_at: number;
}

interface AnalysisRule {
  id: number;
  language: string;
  rule_name: string;
  pattern: string;
  severity: string;
  message: string;
  suggestion: string | null;
  category: string | null;
  enabled: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  sources: {
    typescript: [
      {
        name: "Google TypeScript Style Guide",
        url: "https://google.github.io/styleguide/tsguide.html",
        type: "html",
        priority: 1,
      },
      {
        name: "TypeScript Best Practices",
        url: "https://github.com/andredesousa/typescript-best-practices",
        type: "github-readme",
        priority: 2,
      },
      {
        name: "Microsoft TypeScript Coding Guidelines",
        url: "https://github.com/microsoft/tsdoc",
        type: "github-readme",
        priority: 3,
      },
      {
        name: "TypeScript Deep Dive",
        url: "https://basarat.gitbook.io/typescript/",
        type: "html",
        priority: 4,
      },
    ],
    javascript: [
      {
        name: "Google JavaScript Style Guide",
        url: "https://google.github.io/styleguide/jsguide.html",
        type: "html",
        priority: 1,
      },
      {
        name: "Airbnb JavaScript Style Guide",
        url: "https://github.com/airbnb/javascript",
        type: "github-readme",
        priority: 2,
      },
      {
        name: "MDN JavaScript Guide",
        url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
        type: "html",
        priority: 3,
      },
      {
        name: "JavaScript Best Practices",
        url: "https://github.com/ryanmcdermott/clean-code-javascript",
        type: "github-readme",
        priority: 4,
      },
    ],
    python: [
      {
        name: "Google Python Style Guide",
        url: "https://google.github.io/styleguide/pyguide.html",
        type: "html",
        priority: 1,
      },
      {
        name: "PEP 8",
        url: "https://peps.python.org/pep-0008/",
        type: "html",
        priority: 1,
      },
      {
        name: "PEP 257 (Docstring Conventions)",
        url: "https://peps.python.org/pep-0257/",
        type: "html",
        priority: 2,
      },
      {
        name: "Python Best Practices",
        url: "https://github.com/realpython/python-guide",
        type: "github-readme",
        priority: 3,
      },
      {
        name: "The Hitchhiker's Guide to Python",
        url: "https://docs.python-guide.org/",
        type: "html",
        priority: 4,
      },
    ],
    cpp: [
      {
        name: "Google C++ Style Guide",
        url: "https://google.github.io/styleguide/cppguide.html",
        type: "html",
        priority: 1,
      },
      {
        name: "C++ Core Guidelines",
        url: "https://isocpp.github.io/CppCoreGuidelines/",
        type: "html",
        priority: 2,
      },
      {
        name: "Modern C++ Best Practices",
        url: "https://github.com/isocpp/CppCoreGuidelines/blob/master/README.md",
        type: "github-readme",
        priority: 3,
      },
    ],
    java: [
      {
        name: "Google Java Style Guide",
        url: "https://google.github.io/styleguide/javaguide.html",
        type: "html",
        priority: 1,
      },
      {
        name: "Oracle Java Coding Conventions",
        url: "https://www.oracle.com/technical-resources/articles/java/j2se-code-conventions.html",
        type: "html",
        priority: 2,
      },
      {
        name: "Spring Boot Best Practices",
        url: "https://spring.io/guides",
        type: "html",
        priority: 3,
      },
    ],
    go: [
      {
        name: "Effective Go",
        url: "https://go.dev/doc/effective_go",
        type: "html",
        priority: 1,
      },
      {
        name: "Go Code Review Comments",
        url: "https://github.com/golang/go/wiki/CodeReviewComments",
        type: "github-readme",
        priority: 2,
      },
      {
        name: "Go Best Practices",
        url: "https://golang.org/doc/effective_go.html",
        type: "html",
        priority: 3,
      },
    ],
    rust: [
      {
        name: "Rust API Guidelines",
        url: "https://rust-lang.github.io/api-guidelines/",
        type: "html",
        priority: 1,
      },
      {
        name: "Rust Book",
        url: "https://doc.rust-lang.org/book/",
        type: "html",
        priority: 2,
      },
      {
        name: "Rust by Example",
        url: "https://doc.rust-lang.org/rust-by-example/",
        type: "html",
        priority: 3,
      },
    ],
    csharp: [
      {
        name: "Microsoft C# Coding Conventions",
        url: "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions",
        type: "html",
        priority: 1,
      },
      {
        name: ".NET Framework Design Guidelines",
        url: "https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/",
        type: "html",
        priority: 2,
      },
    ],
    php: [
      {
        name: "PHP-FIG Coding Standards",
        url: "https://www.php-fig.org/psr/",
        type: "html",
        priority: 1,
      },
      {
        name: "PHP Best Practices",
        url: "https://phptherightway.com/",
        type: "html",
        priority: 2,
      },
    ],
    ruby: [
      {
        name: "Ruby Style Guide",
        url: "https://github.com/rubocop/ruby-style-guide",
        type: "github-readme",
        priority: 1,
      },
      {
        name: "Ruby Best Practices",
        url: "https://github.com/JuanitoFatas/fast-ruby",
        type: "github-readme",
        priority: 2,
      },
    ],
    swift: [
      {
        name: "Swift API Design Guidelines",
        url: "https://swift.org/documentation/api-design-guidelines/",
        type: "html",
        priority: 1,
      },
      {
        name: "Swift Style Guide",
        url: "https://github.com/raywenderlich/swift-style-guide",
        type: "github-readme",
        priority: 2,
      },
    ],
    kotlin: [
      {
        name: "Kotlin Coding Conventions",
        url: "https://kotlinlang.org/docs/coding-conventions.html",
        type: "html",
        priority: 1,
      },
      {
        name: "Android Kotlin Style Guide",
        url: "https://developer.android.com/kotlin/style-guide",
        type: "html",
        priority: 2,
      },
    ],
  },
  security: {
    general: [
      {
        name: "OWASP Top 10",
        url: "https://owasp.org/www-project-top-ten/",
        type: "html",
        priority: 1,
      },
      {
        name: "OWASP API Security Top 10",
        url: "https://owasp.org/www-project-api-security/",
        type: "html",
        priority: 1,
      },
      {
        name: "OWASP Secure Coding Practices",
        url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/",
        type: "html",
        priority: 1,
      },
    ],
    web: [
      {
        name: "Content Security Policy Guide",
        url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
        type: "html",
        priority: 1,
      },
      {
        name: "Web Security Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Web_Application_Security_Testing_Cheat_Sheet.html",
        type: "html",
        priority: 2,
      },
    ],
    mobile: [
      {
        name: "OWASP Mobile Top 10",
        url: "https://owasp.org/www-project-mobile-top-10/",
        type: "html",
        priority: 1,
      },
    ],
    cloud: [
      {
        name: "AWS Security Best Practices",
        url: "https://docs.aws.amazon.com/security/",
        type: "html",
        priority: 1,
      },
    ],
  },
  frameworks: {
    react: [
      {
        name: "React Security Best Practices",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/React_Security_Cheat_Sheet.html",
        type: "html",
        priority: 1,
      },
      {
        name: "React Best Practices",
        url: "https://github.com/vasanthk/react-bits",
        type: "github-readme",
        priority: 2,
      },
      {
        name: "React Performance Optimization",
        url: "https://kentcdodds.com/blog/profile-a-react-app-for-performance",
        type: "html",
        priority: 3,
      },
    ],
    vue: [
      {
        name: "Vue.js Style Guide",
        url: "https://vuejs.org/style-guide/",
        type: "html",
        priority: 1,
      },
      {
        name: "Vue.js Best Practices",
        url: "https://github.com/patarapolw/vue-best-practices",
        type: "github-readme",
        priority: 2,
      },
    ],
    angular: [
      {
        name: "Angular Style Guide",
        url: "https://angular.io/guide/styleguide",
        type: "html",
        priority: 1,
      },
      {
        name: "Angular Best Practices",
        url: "https://angular.io/guide/security",
        type: "html",
        priority: 2,
      },
    ],
    nodejs: [
      {
        name: "Node.js Security Best Practices",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html",
        type: "html",
        priority: 1,
      },
      {
        name: "NPM Security Best Practices",
        url: "https://docs.npmjs.com/security-best-practices",
        type: "html",
        priority: 2,
      },
      {
        name: "Node.js Best Practices",
        url: "https://github.com/goldbergyoni/nodebestpractices",
        type: "github-readme",
        priority: 3,
      },
    ],
    express: [
      {
        name: "Express.js Best Practices",
        url: "https://github.com/goldbergyoni/expressbestpractices",
        type: "github-readme",
        priority: 1,
      },
      {
        name: "Express Security Best Practices",
        url: "https://expressjs.com/en/advanced/security-best-practices.html",
        type: "html",
        priority: 2,
      },
    ],
    django: [
      {
        name: "Django Best Practices",
        url: "https://django-best-practices.readthedocs.io/",
        type: "html",
        priority: 1,
      },
      {
        name: "Django Security Best Practices",
        url: "https://docs.djangoproject.com/en/stable/topics/security/",
        type: "html",
        priority: 2,
      },
    ],
    flask: [
      {
        name: "Flask Best Practices",
        url: "https://flask.palletsprojects.com/en/stable/patterns/",
        type: "html",
        priority: 1,
      },
      {
        name: "Flask Security Best Practices",
        url: "https://flask.palletsprojects.com/en/stable/security/",
        type: "html",
        priority: 2,
      },
    ],
    docker: [
      {
        name: "Docker Security Best Practices",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html",
        type: "html",
        priority: 1,
      },
      {
        name: "Docker Best Practices",
        url: "https://github.com/docker/docker.github.io/blob/master/develop/develop-images/dockerfile_best-practices.md",
        type: "github-readme",
        priority: 2,
      },
    ],
    kubernetes: [
      {
        name: "Kubernetes Security Best Practices",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Kubernetes_Security_Cheat_Sheet.html",
        type: "html",
        priority: 1,
      },
      {
        name: "Kubernetes Best Practices",
        url: "https://kubernetes.io/docs/concepts/configuration/overview/",
        type: "html",
        priority: 2,
      },
    ],
  },
  api: {
    rest: [
      {
        name: "Microsoft REST API Guidelines",
        url: "https://github.com/Microsoft/api-guidelines/blob/vNext/Guidelines.md",
        type: "github-readme",
        priority: 1,
      },
      {
        name: "REST API Design Best Practices",
        url: "https://restfulapi.net/",
        type: "html",
        priority: 2,
      },
      {
        name: "HTTP API Design Guide",
        url: "https://github.com/interagent/http-api-design",
        type: "github-readme",
        priority: 3,
      },
    ],
    graphql: [
      {
        name: "GraphQL Best Practices",
        url: "https://graphql.org/learn/best-practices/",
        type: "html",
        priority: 1,
      },
      {
        name: "GraphQL Security Best Practices",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html",
        type: "html",
        priority: 2,
      },
    ],
    openapi: [
      {
        name: "OpenAPI Specification Best Practices",
        url: "https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md",
        type: "github-readme",
        priority: 1,
      },
      {
        name: "API Design with OpenAPI",
        url: "https://swagger.io/resources/articles/best-practices-in-api-design/",
        type: "html",
        priority: 2,
      },
    ],
  },
  database: [
    {
      name: "SQL Best Practices",
      url: "https://github.com/xenowits/sql-style-guide",
      type: "github-readme",
      priority: 1,
    },
    {
      name: "Database Design Best Practices",
      url: "https://github.com/khorevaa/database-design-best-practices",
      type: "github-readme",
      priority: 2,
    },
    {
      name: "PostgreSQL Best Practices",
      url: "https://wiki.postgresql.org/wiki/Don%27t_Do_This",
      type: "html",
      priority: 3,
    },
    {
      name: "MongoDB Best Practices",
      url: "https://www.mongodb.com/blog/post/building-with-patterns-a-summary",
      type: "html",
      priority: 4,
    },
  ],
  testing: [
    {
      name: "Testing Best Practices",
      url: "https://github.com/goldbergyoni/javascript-testing-best-practices",
      type: "github-readme",
      priority: 1,
    },
    {
      name: "Test-Driven Development",
      url: "https://martinfowler.com/articles/mocksArentStubs.html",
      type: "html",
      priority: 2,
    },
    {
      name: "PyTest Best Practices",
      url: "https://docs.pytest.org/en/stable/best-practices.html",
      type: "html",
      priority: 3,
    },
    {
      name: "Jest Testing Best Practices",
      url: "https://github.com/goldbergyoni/javascript-testing-best-practices/blob/main/sections/jest.md",
      type: "github-readme",
      priority: 4,
    },
  ],
  devops: [
    {
      name: "CI/CD Best Practices",
      url: "https://github.com/ci-cd-best-practices-guide/ci-cd-best-practices-guide",
      type: "github-readme",
      priority: 1,
    },
    {
      name: "Git Best Practices",
      url: "https://github.com/github/gitignore/blob/main/README.md",
      type: "github-readme",
      priority: 2,
    },
    {
      name: "GitHub Actions Best Practices",
      url: "https://docs.github.com/en/actions/learn-github-actions/security-hardening-for-github-actions",
      type: "html",
        priority: 3,
      },
    {
      name: "Infrastructure as Code Best Practices",
      url: "https://docs.microsoft.com/en-us/azure/architecture/framework/devops/infrastructure-as-code",
      type: "html",
      priority: 4,
    },
  ],
  cacheDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
  autoUpdateInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
  dataDir: path.join(__dirname, "data"),
  exportDir: path.join(__dirname, "exports"),
};

// Database setup
class StyleGuideDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema() {
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
        FOREIGN KEY (guideline_id) REFERENCES guidelines(id)
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

      CREATE INDEX IF NOT EXISTS idx_guidelines_language ON guidelines(language);
      CREATE INDEX IF NOT EXISTS idx_guidelines_category ON guidelines(category);
      CREATE INDEX IF NOT EXISTS idx_security_language ON security_guidelines(language);
      CREATE INDEX IF NOT EXISTS idx_security_vuln ON security_guidelines(vulnerability_type);
      CREATE INDEX IF NOT EXISTS idx_rules_language ON code_analysis_rules(language);
    `);

    // Add default analysis rules
    this.addDefaultAnalysisRules();
  }

  private addDefaultAnalysisRules() {
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
  }) {
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

  getGuidelines(language: string, category?: string): Guideline[] {
    let query = `
      SELECT * FROM guidelines 
      WHERE language = ?
    `;
    const params: unknown[] = [language];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` ORDER BY priority ASC, source_name ASC`;

    return this.db.prepare(query).all(...params) as Guideline[];
  }

  searchGuidelines(searchTerm: string, language?: string): Guideline[] {
    let query = `
      SELECT * FROM guidelines 
      WHERE (content LIKE ? OR title LIKE ? OR section LIKE ?)
    `;
    const params: unknown[] = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

    if (language) {
      query += ` AND language = ?`;
      params.push(language);
    }

    query += ` ORDER BY priority ASC LIMIT 20`;

    return this.db.prepare(query).all(...params) as Guideline[];
  }

  insertSecurityGuideline(data: {
    language?: string;
    vulnerabilityType: string;
    description: string;
    mitigation: string;
    severity?: string;
    cweId?: string;
  }) {
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

  getSecurityGuidelines(language?: string, vulnerabilityType?: string): SecurityGuideline[] {
    let query = `SELECT * FROM security_guidelines WHERE 1=1`;
    const params: unknown[] = [];

    if (language) {
      query += ` AND (language = ? OR language IS NULL)`;
      params.push(language);
    }

    if (vulnerabilityType) {
      query += ` AND vulnerability_type LIKE ?`;
      params.push(`%${vulnerabilityType}%`);
    }

    return this.db.prepare(query).all(...params) as SecurityGuideline[];
  }

  getAnalysisRules(language: string): AnalysisRule[] {
    return this.db
      .prepare(`SELECT * FROM code_analysis_rules WHERE language = ? AND enabled = 1`)
      .all(language) as AnalysisRule[];
  }

  needsUpdate(language: string, sourceName: string): boolean {
    const result = this.db
      .prepare(
        `SELECT MAX(fetched_at) as last_fetch FROM guidelines WHERE language = ? AND source_name = ?`
      )
      .get(language, sourceName) as { last_fetch: number | null };

    if (!result.last_fetch) return true;

    return Date.now() - result.last_fetch > CONFIG.cacheDuration;
  }
}

// Content Fetcher
class ContentFetcher {
  async fetch(url: string, type: string): Promise<string> {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL provided');
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "StyleGuideMCPServer/2.0.0",
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText} (${response.status})`);
      }

      const text = await response.text();
      if (!text) {
        throw new Error(`Empty response from ${url}`);
      }

      return text;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Network error fetching ${url}: ${error.message}`);
      }
      throw new Error(`Unknown error fetching ${url}`);
    }
  }

  parseHTML(html: string, url: string): ParsedContent[] {
    const $ = cheerio.load(html);
    const results: ParsedContent[] = [];

    // Remove script, style, nav, footer elements
    $("script, style, nav, footer, .nav, .footer").remove();

    // Find main content area
    const mainContent =
      $("main").length > 0
        ? $("main")
        : $("article").length > 0
        ? $("article")
        : $("body");

    // Extract sections with headings
    mainContent.find("h1, h2, h3, h4").each((_, elem) => {
      const heading = $(elem);
      const title = heading.text().trim();
      let content = "";
      let category = this.categorizeContent(title);

      // Get content until next heading
      let next = heading.next();
      while (next.length > 0 && !next.is("h1, h2, h3, h4")) {
        content += next.text().trim() + "\n\n";
        next = next.next();
      }

      if (content.trim()) {
        results.push({
          title,
          content: content.trim(),
          section: title.toLowerCase().replace(/\s+/g, "-"),
          category,
        });
      }
    });

    return results;
  }

  parseMarkdown(markdown: string): ParsedContent[] {
    const html = marked.parse(markdown) as string;
    const results: ParsedContent[] = [];

    // Split by headings
    const sections = markdown.split(/^#+\s+/gm).filter((s) => s.trim());

    sections.forEach((section) => {
      const lines = section.split("\n");
      const title = lines[0]?.trim();
      const content = lines.slice(1).join("\n").trim();

      if (title && content) {
        results.push({
          title,
          content,
          section: title.toLowerCase().replace(/\s+/g, "-"),
          category: this.categorizeContent(title),
        });
      }
    });

    return results;
  }

  private categorizeContent(title: string): string {
    const lower = title.toLowerCase();

    if (lower.includes("naming") || lower.includes("name")) return "naming";
    if (lower.includes("format")) return "formatting";
    if (lower.includes("comment") || lower.includes("document"))
      return "documentation";
    if (lower.includes("type") || lower.includes("interface")) return "types";
    if (lower.includes("class") || lower.includes("object")) return "classes";
    if (lower.includes("function") || lower.includes("method"))
      return "functions";
    if (lower.includes("import") || lower.includes("module")) return "imports";
    if (lower.includes("error") || lower.includes("exception"))
      return "error-handling";
    if (lower.includes("test")) return "testing";
    if (lower.includes("security")) return "security";
    if (lower.includes("performance")) return "performance";

    return "general";
  }
}

interface ParsedContent {
  title: string;
  content: string;
  section: string;
  category: string;
}

// Code Analyzer
class CodeAnalyzer {
  private db: StyleGuideDB;

  constructor(db: StyleGuideDB) {
    this.db = db;
  }

  analyzeCode(code: string, language: string): AnalysisResult[] {
    const rules = this.db.getAnalysisRules(language);
    const results: AnalysisResult[] = [];

    for (const rule of rules) {
      const r = rule as any;
      try {
        const regex = new RegExp(r.pattern, "gm");
        let match;

        while ((match = regex.exec(code)) !== null) {
          const lineNumber = code.substring(0, match.index).split("\n").length;
          const line = code.split("\n")[lineNumber - 1];

          results.push({
            rule: r.rule_name,
            severity: r.severity,
            message: r.message,
            suggestion: r.suggestion,
            line: lineNumber,
            code: line.trim(),
            category: r.category,
          });
        }
      } catch (error) {
        console.error(`Error applying rule ${r.rule_name}:`, error);
      }
    }

    return results;
  }

  generateFixedCode(code: string, language: string): string {
    // Simple automatic fixes for common issues
    let fixed = code;

    if (language === "javascript" || language === "typescript") {
      // Replace var with const
      fixed = fixed.replace(/\bvar\b/g, "const");
      
      // Add semicolons if missing (simple heuristic)
      fixed = fixed.split("\n").map(line => {
        if (line.trim() && !line.trim().endsWith(";") && 
            !line.trim().endsWith("{") && !line.trim().endsWith("}") &&
            !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
          return line + ";";
        }
        return line;
      }).join("\n");
    }

    return fixed;
  }
}

interface AnalysisResult {
  rule: string;
  severity: string;
  message: string;
  suggestion: string | null;
  line: number;
  code: string;
  category: string;
}

// Export Manager
class ExportManager {
  private exportDir: string;

  constructor(exportDir: string) {
    this.exportDir = exportDir;
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
  }

  exportAsMarkdown(content: string, filename: string): string {
    const filepath = path.join(this.exportDir, `${filename}.md`);
    fs.writeFileSync(filepath, content, "utf-8");
    return filepath;
  }

  exportAsHTML(content: string, filename: string): string {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1, h2, h3 { color: #2c3e50; }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: "Monaco", "Courier New", monospace;
    }
    pre {
      background: #f4f4f4;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    .source {
      color: #7f8c8d;
      font-style: italic;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
${marked.parse(content)}
</body>
</html>`;

    const filepath = path.join(this.exportDir, `${filename}.html`);
    fs.writeFileSync(filepath, html, "utf-8");
    return filepath;
  }

  exportAsJSON(data: any, filename: string): string {
    const filepath = path.join(this.exportDir, `${filename}.json`);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
    return filepath;
  }
}

// Style Guide Manager
class StyleGuideManager {
  private db: StyleGuideDB;
  private fetcher: ContentFetcher;
  private analyzer: CodeAnalyzer;
  private exporter: ExportManager;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(db: StyleGuideDB) {
    this.db = db;
    this.fetcher = new ContentFetcher();
    this.analyzer = new CodeAnalyzer(db);
    this.exporter = new ExportManager(CONFIG.exportDir);
  }

  startAutoUpdate() {
    console.error("Starting auto-update scheduler...");
    this.updateInterval = setInterval(async () => {
      console.error("Running scheduled update...");
      await this.updateStyleGuides(false);
    }, CONFIG.autoUpdateInterval);
  }

  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  async updateStyleGuides(force: boolean = false) {
    console.error("Updating style guides...");

    for (const [language, sources] of Object.entries(CONFIG.sources)) {
      for (const source of sources) {
        try {
          if (!force && !this.db.needsUpdate(language, source.name)) {
            console.error(`Skipping ${language}/${source.name} (cached)`);
            continue;
          }

          console.error(`Fetching ${language}/${source.name}...`);
          const content = await this.fetcher.fetch(source.url, source.type);

          let parsed: ParsedContent[];
          if (source.type === "html") {
            parsed = this.fetcher.parseHTML(content, source.url);
          } else if (
            source.type === "markdown" ||
            source.type === "github-readme"
          ) {
            parsed = this.fetcher.parseMarkdown(content);
          } else {
            continue;
          }

          // Store parsed guidelines
          for (const item of parsed) {
            this.db.insertGuideline({
              language,
              sourceName: source.name,
              sourceUrl: source.url,
              title: item.title,
              content: item.content,
              section: item.section,
              category: item.category,
              priority: source.priority,
            });
          }

          console.error(`✓ Updated ${language}/${source.name}`);
        } catch (error) {
          console.error(
            `✗ Failed to update ${language}/${source.name}:`,
            error
          );
        }
      }
    }

    // Add some basic security guidelines
    this.addBasicSecurityGuidelines();
  }

  private addBasicSecurityGuidelines() {
    const securityGuidelines = [
      // Injection Attacks
      {
        vulnerabilityType: "SQL Injection",
        description:
          "Occurs when untrusted data is sent to an interpreter as part of a command or query.",
        mitigation:
          "Use parameterized queries, prepared statements, or ORM frameworks. Never concatenate user input directly into SQL queries.",
        severity: "High",
        cweId: "CWE-89",
      },
      {
        vulnerabilityType: "Command Injection",
        description:
          "Occurs when an application passes unsafe user input to a system shell.",
        mitigation:
          "Avoid using shell commands with user input. Use libraries that don't invoke shell. Validate and sanitize all inputs. Use allowlists for commands.",
        severity: "Critical",
        cweId: "CWE-78",
      },
      {
        vulnerabilityType: "LDAP Injection",
        description:
          "Allows attackers to modify LDAP queries and access unauthorized data.",
        mitigation:
          "Use parameterized LDAP queries. Validate and escape special characters. Implement least privilege access.",
        severity: "High",
        cweId: "CWE-90",
      },
      // XSS Family
      {
        vulnerabilityType: "Cross-Site Scripting (XSS)",
        description:
          "Enables attackers to inject malicious scripts into web pages viewed by other users.",
        mitigation:
          "Sanitize and escape all user input before rendering. Use Content Security Policy headers. Encode output based on context (HTML, JavaScript, URL). Use frameworks with auto-escaping.",
        severity: "High",
        cweId: "CWE-79",
      },
      {
        vulnerabilityType: "DOM-based XSS",
        description:
          "XSS vulnerability that exists in client-side code rather than server-side.",
        mitigation:
          "Avoid using dangerous DOM APIs like innerHTML with user data. Use textContent or safer alternatives. Sanitize data before DOM manipulation.",
        severity: "High",
        cweId: "CWE-79",
      },
      // CSRF and Related
      {
        vulnerabilityType: "Cross-Site Request Forgery (CSRF)",
        description:
          "Forces users to execute unwanted actions on a web application where they're authenticated.",
        mitigation:
          "Use anti-CSRF tokens, SameSite cookie attribute, and verify origin/referer headers. Require re-authentication for sensitive actions.",
        severity: "Medium",
        cweId: "CWE-352",
      },
      {
        vulnerabilityType: "Clickjacking",
        description:
          "Tricks users into clicking on something different from what they perceive.",
        mitigation:
          "Use X-Frame-Options or Content-Security-Policy frame-ancestors directive. Implement frame-busting scripts.",
        severity: "Medium",
        cweId: "CWE-1021",
      },
      // Deserialization
      {
        vulnerabilityType: "Insecure Deserialization",
        description:
          "Occurs when untrusted data is used to abuse application logic, inflict DoS, or execute arbitrary code.",
        mitigation:
          "Avoid deserializing untrusted data. Use safe deserialization methods. Implement integrity checks and type constraints. Use allowlists for classes.",
        severity: "High",
        cweId: "CWE-502",
      },
      // Path/File Issues
      {
        vulnerabilityType: "Path Traversal",
        description:
          "Allows attackers to access files and directories outside the intended directory.",
        mitigation:
          "Validate and sanitize file paths. Use whitelist of allowed files/directories. Avoid user input in file paths when possible. Use path normalization.",
        severity: "High",
        cweId: "CWE-22",
      },
      {
        vulnerabilityType: "Unrestricted File Upload",
        description:
          "Allows users to upload dangerous file types that can be executed.",
        mitigation:
          "Validate file types using allowlists. Check file content, not just extension. Store uploads outside web root. Use antivirus scanning. Limit file sizes.",
        severity: "High",
        cweId: "CWE-434",
      },
      // Authentication & Session
      {
        vulnerabilityType: "Broken Authentication",
        description:
          "Weak authentication mechanisms that can be bypassed or compromised.",
        mitigation:
          "Implement multi-factor authentication. Use strong password policies. Secure session management. Implement account lockout after failed attempts. Use secure token generation.",
        severity: "Critical",
        cweId: "CWE-287",
      },
      {
        vulnerabilityType: "Session Fixation",
        description:
          "Attacker sets a user's session ID to a known value.",
        mitigation:
          "Regenerate session IDs after authentication. Use secure, httpOnly, and SameSite cookie flags. Implement proper session timeout.",
        severity: "High",
        cweId: "CWE-384",
      },
      {
        vulnerabilityType: "Insecure Direct Object References",
        description:
          "Exposes references to internal implementation objects allowing unauthorized access.",
        mitigation:
          "Use indirect references or access control checks. Validate user authorization for every request. Use UUIDs instead of sequential IDs.",
        severity: "High",
        cweId: "CWE-639",
      },
      // Cryptography
      {
        vulnerabilityType: "Weak Cryptography",
        description:
          "Use of weak or broken cryptographic algorithms.",
        mitigation:
          "Use modern, strong algorithms (AES-256, RSA-2048+, SHA-256+). Avoid MD5, SHA-1, DES. Use proper key management. Implement secure random number generation.",
        severity: "High",
        cweId: "CWE-327",
      },
      {
        vulnerabilityType: "Hardcoded Credentials",
        description:
          "Credentials embedded directly in source code.",
        mitigation:
          "Use environment variables or secure vaults. Never commit secrets to version control. Rotate credentials regularly. Use secret scanning tools.",
        severity: "Critical",
        cweId: "CWE-798",
      },
      // API Security
      {
        vulnerabilityType: "API Broken Object Level Authorization",
        description:
          "APIs expose endpoints that handle object identifiers without proper authorization checks.",
        mitigation:
          "Implement authorization checks for every object access. Use random, unpredictable object IDs. Validate user permissions at the object level.",
        severity: "High",
        cweId: "CWE-639",
      },
      {
        vulnerabilityType: "API Excessive Data Exposure",
        description:
          "APIs return more data than necessary, relying on client to filter.",
        mitigation:
          "Never rely on client-side filtering. Return only necessary data. Use DTOs to control API responses. Implement proper data minimization.",
        severity: "Medium",
        cweId: "CWE-213",
      },
      {
        vulnerabilityType: "API Rate Limiting",
        description:
          "Lack of rate limiting allows abuse and DoS attacks.",
        mitigation:
          "Implement rate limiting per user/IP. Use exponential backoff. Monitor for abuse patterns. Set appropriate timeouts.",
        severity: "Medium",
        cweId: "CWE-770",
      },
      // Server-Side Request Forgery
      {
        vulnerabilityType: "Server-Side Request Forgery (SSRF)",
        description:
          "Attacker can make the server perform requests to unintended locations.",
        mitigation:
          "Validate and sanitize all URLs. Use allowlists for domains. Disable unused URL schemas. Implement network segmentation. Don't return raw responses.",
        severity: "High",
        cweId: "CWE-918",
      },
      // XML Issues
      {
        vulnerabilityType: "XML External Entity (XXE)",
        description:
          "Attacker can interfere with XML processing to access files or internal systems.",
        mitigation:
          "Disable XML external entity processing. Use less complex data formats like JSON. Keep XML processors updated. Validate XML against schema.",
        severity: "High",
        cweId: "CWE-611",
      },
      // Security Misconfiguration
      {
        vulnerabilityType: "Security Misconfiguration",
        description:
          "Insecure default configurations, incomplete setups, or verbose error messages.",
        mitigation:
          "Use security headers (CSP, HSTS, X-Frame-Options). Disable directory listings. Remove default accounts. Keep software updated. Don't expose stack traces.",
        severity: "Medium",
        cweId: "CWE-16",
      },
      {
        vulnerabilityType: "Sensitive Data Exposure",
        description:
          "Insufficient protection of sensitive data like passwords, credit cards, health records.",
        mitigation:
          "Encrypt data at rest and in transit. Use TLS 1.2+. Don't store unnecessary sensitive data. Implement proper key management. Use secure deletion.",
        severity: "High",
        cweId: "CWE-311",
      },
      // Modern Web/App Issues
      {
        vulnerabilityType: "Insecure Dependencies",
        description:
          "Using components with known vulnerabilities.",
        mitigation:
          "Keep dependencies updated. Use automated scanning (npm audit, Snyk, Dependabot). Remove unused dependencies. Pin versions and verify integrity.",
        severity: "High",
        cweId: "CWE-1035",
      },
      {
        vulnerabilityType: "Insufficient Logging & Monitoring",
        description:
          "Inadequate logging allows attacks to go undetected.",
        mitigation:
          "Log authentication events, access control failures, input validation failures. Centralize logs. Implement alerting. Ensure log integrity. NEVER log sensitive data.",
        severity: "Medium",
        cweId: "CWE-778",
      },
      {
        vulnerabilityType: "Open Redirect",
        description:
          "Application accepts user-controlled input for redirect destinations.",
        mitigation:
          "Avoid redirects based on user input. Use allowlists for valid destinations. Validate URLs thoroughly. Don't use user input in redirect parameters.",
        severity: "Medium",
        cweId: "CWE-601",
      },
      // Container & Cloud
      {
        vulnerabilityType: "Container Escape",
        description:
          "Attacker breaks out of container to access host system.",
        mitigation:
          "Use minimal base images. Don't run containers as root. Keep container runtime updated. Use security profiles (AppArmor, SELinux). Scan images for vulnerabilities.",
        severity: "Critical",
        cweId: "CWE-269",
      },
      {
        vulnerabilityType: "Cloud Misconfigurations",
        description:
          "Improperly configured cloud resources exposing data or services.",
        mitigation:
          "Use principle of least privilege. Enable encryption by default. Audit IAM policies regularly. Use cloud security posture management tools. Enable logging.",
        severity: "High",
        cweId: "CWE-16",
      },
      // Race Conditions & Logic
      {
        vulnerabilityType: "Race Condition",
        description:
          "Time-of-check to time-of-use (TOCTOU) vulnerabilities.",
        mitigation:
          "Use atomic operations. Implement proper locking mechanisms. Avoid shared state when possible. Use database transactions correctly.",
        severity: "Medium",
        cweId: "CWE-367",
      },
      {
        vulnerabilityType: "Business Logic Vulnerabilities",
        description:
          "Flaws in application workflow that can be exploited.",
        mitigation:
          "Implement server-side validation. Don't trust client-side checks. Test edge cases. Use finite state machines. Implement transaction monitoring.",
        severity: "High",
        cweId: "CWE-840",
      },
    ];

    for (const guideline of securityGuidelines) {
      try {
        this.db.insertSecurityGuideline(guideline);
      } catch (error) {
        // Ignore duplicates
      }
    }
  }

  addCustomGuideline(data: {
    language: string;
    title: string;
    content: string;
    category?: string;
  }) {
    return this.db.insertGuideline({
      language: data.language,
      sourceName: "Custom Guidelines",
      sourceUrl: "user-defined",
      title: data.title,
      content: data.content,
      category: data.category || "general",
      priority: 10,
      isCustom: true,
    });
  }

  getStyleGuide(language: string, section?: string) {
    const guidelines = this.db.getGuidelines(language, section);

    if (guidelines.length === 0) {
      return null;
    }

    // Group by source
    const bySource: Record<string, any[]> = {};
    for (const guideline of guidelines) {
      const source = (guideline as any).source_name;
      if (!bySource[source]) {
        bySource[source] = [];
      }
      bySource[source].push(guideline);
    }

    return {
      language,
      sources: bySource,
      guidelines,
    };
  }

  searchGuidelines(query: string, language?: string) {
    return this.db.searchGuidelines(query, language);
  }

  getSecurityGuidelines(language?: string, vulnerabilityType?: string) {
    return this.db.getSecurityGuidelines(language, vulnerabilityType);
  }

  analyzeCode(code: string, language: string) {
    return this.analyzer.analyzeCode(code, language);
  }

  generateFixedCode(code: string, language: string) {
    return this.analyzer.generateFixedCode(code, language);
  }

  exportGuidelines(language: string, format: string): string {
    const guide = this.getStyleGuide(language);
    if (!guide) {
      throw new Error(`No guidelines found for ${language}`);
    }

    let content = `# ${language.toUpperCase()} Style Guide\n\n`;
    content += `Generated: ${new Date().toISOString()}\n\n`;

    for (const [source, guidelines] of Object.entries(guide.sources)) {
      content += `## ${source}\n\n`;
      for (const guideline of guidelines) {
        const g = guideline as any;
        if (g.title) {
          content += `### ${g.title}\n\n`;
        }
        content += `${g.content}\n\n`;
      }
    }

    const filename = `${language}-style-guide-${Date.now()}`;

    if (format === "markdown") {
      return this.exporter.exportAsMarkdown(content, filename);
    } else if (format === "html") {
      return this.exporter.exportAsHTML(content, filename);
    } else if (format === "json") {
      return this.exporter.exportAsJSON(guide, filename);
    }

    throw new Error(`Unsupported export format: ${format}`);
  }
}

// MCP Server
class StyleGuideMCPServer {
  private server: Server;
  private manager: StyleGuideManager;

  constructor(manager: StyleGuideManager) {
    this.manager = manager;
    this.server = new Server(
      {
        name: "style-guide-server",
        version: "2.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const languages = Object.keys(CONFIG.sources);

      const resources = [];

      for (const lang of languages) {
        resources.push({
          uri: `style-guide://${lang}`,
          name: `${lang.charAt(0).toUpperCase() + lang.slice(1)} Style Guide`,
          description: `Complete style guide for ${lang}`,
          mimeType: "text/plain",
        });

        resources.push({
          uri: `best-practices://${lang}`,
          name: `${lang.charAt(0).toUpperCase() + lang.slice(1)} Best Practices`,
          description: `Best practices for ${lang}`,
          mimeType: "text/plain",
        });
      }

      resources.push({
        uri: "security://all",
        name: "Security Guidelines",
        description: "Security best practices and vulnerability information",
        mimeType: "text/plain",
      });

      return { resources };
    });

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const [scheme, path] = uri.split("://");

      if (scheme === "style-guide") {
        const guide = this.manager.getStyleGuide(path);
        if (!guide) {
          throw new Error(`No style guide found for ${path}`);
        }

        let content = `# ${path.toUpperCase()} Style Guide\n\n`;

        for (const [source, guidelines] of Object.entries(guide.sources)) {
          content += `## ${source}\n\n`;
          for (const guideline of guidelines) {
            const g = guideline as any;
            if (g.title) {
              content += `### ${g.title}\n\n`;
            }
            content += `${g.content}\n\n`;
          }
        }

        return {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: content,
            },
          ],
        };
      } else if (scheme === "best-practices") {
        const guide = this.manager.getStyleGuide(path);
        if (!guide) {
          throw new Error(`No best practices found for ${path}`);
        }

        let content = `# ${path.toUpperCase()} Best Practices\n\n`;

        const categories = ["general", "performance", "security", "testing"];
        for (const category of categories) {
          const categoryGuidelines = guide.guidelines.filter(
            (g: any) => g.category === category
          );

          if (categoryGuidelines.length > 0) {
            content += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;

            for (const guideline of categoryGuidelines) {
              const g = guideline as any;
              if (g.title) {
                content += `### ${g.title}\n\n`;
              }
              content += `${g.content}\n\n`;
            }
          }
        }

        return {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: content,
            },
          ],
        };
      } else if (scheme === "security") {
        const guidelines = this.manager.getSecurityGuidelines();

        let content = `# Security Guidelines\n\n`;

        for (const guideline of guidelines) {
          const g = guideline as any;
          content += `## ${g.vulnerability_type}`;
          if (g.severity) {
            content += ` [${g.severity}]`;
          }
          if (g.cwe_id) {
            content += ` (${g.cwe_id})`;
          }
          content += `\n\n`;

          content += `**Description:** ${g.description}\n\n`;
          content += `**Mitigation:** ${g.mitigation}\n\n`;
        }

        return {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: content,
            },
          ],
        };
      }

      throw new Error(`Unknown resource URI: ${uri}`);
    });

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "search_guidelines",
            description:
              "Search for specific guidelines across all style guides",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query",
                },
                language: {
                  type: "string",
                  description: "Filter by programming language (optional)",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "get_guideline",
            description: "Get specific guideline by topic",
            inputSchema: {
              type: "object",
              properties: {
                language: {
                  type: "string",
                  description: "Programming language",
                },
                topic: {
                  type: "string",
                  description:
                    "Topic or category (e.g., naming, formatting, security)",
                },
              },
              required: ["language", "topic"],
            },
          },
          {
            name: "check_security",
            description: "Get security guidelines for potential vulnerabilities",
            inputSchema: {
              type: "object",
              properties: {
                language: {
                  type: "string",
                  description: "Programming language (optional)",
                },
                vulnerability_type: {
                  type: "string",
                  description:
                    "Type of vulnerability (e.g., SQL injection, XSS)",
                },
              },
              required: [],
            },
          },
          {
            name: "compare_approaches",
            description: "Compare different style guide recommendations",
            inputSchema: {
              type: "object",
              properties: {
                language: {
                  type: "string",
                  description: "Programming language",
                },
                topic: {
                  type: "string",
                  description: "Topic to compare",
                },
              },
              required: ["language", "topic"],
            },
          },
          {
            name: "analyze_code",
            description: "Analyze code against style guidelines and detect issues",
            inputSchema: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  description: "Code to analyze",
                },
                language: {
                  type: "string",
                  description: "Programming language of the code",
                },
                auto_fix: {
                  type: "boolean",
                  description: "Whether to generate auto-fixed code (optional)",
                },
              },
              required: ["code", "language"],
            },
          },
          {
            name: "add_custom_guideline",
            description: "Add a custom style guideline for your project",
            inputSchema: {
              type: "object",
              properties: {
                language: {
                  type: "string",
                  description: "Programming language",
                },
                title: {
                  type: "string",
                  description: "Title of the guideline",
                },
                content: {
                  type: "string",
                  description: "Content of the guideline",
                },
                category: {
                  type: "string",
                  description: "Category (e.g., naming, formatting, security)",
                },
              },
              required: ["language", "title", "content"],
            },
          },
          {
            name: "export_guidelines",
            description: "Export style guidelines to a file",
            inputSchema: {
              type: "object",
              properties: {
                language: {
                  type: "string",
                  description: "Programming language",
                },
                format: {
                  type: "string",
                  enum: ["markdown", "html", "json"],
                  description: "Export format",
                },
              },
              required: ["language", "format"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!args) {
        throw new Error("Missing arguments");
      }

      if (name === "search_guidelines") {
        const results = this.manager.searchGuidelines(
          args.query as string,
          args.language as string | undefined
        );

        let response = `Found ${results.length} results for "${args.query}":\n\n`;

        for (const result of results) {
          const r = result as any;
          response += `## ${r.title || r.section} (${r.language} - ${r.source_name})\n\n`;
          response += `${r.content.substring(0, 300)}...\n\n`;
        }

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      } else if (name === "get_guideline") {
        const guide = this.manager.getStyleGuide(
          args.language as string,
          args.topic as string
        );

        if (!guide) {
          return {
            content: [
              {
                type: "text",
                text: `No guidelines found for ${args.language}/${args.topic}`,
              },
            ],
          };
        }

        let response = `# ${args.language} - ${args.topic}\n\n`;

        for (const guideline of guide.guidelines) {
          const g = guideline as any;
          if (g.title) {
            response += `## ${g.title}\n\n`;
          }
          response += `${g.content}\n\n`;
          response += `*Source: ${g.source_name}*\n\n`;
        }

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      } else if (name === "check_security") {
        const guidelines = this.manager.getSecurityGuidelines(
          args.language as string | undefined,
          args.vulnerability_type as string | undefined
        );

        if (guidelines.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No security guidelines found matching your criteria.",
              },
            ],
          };
        }

        let response = "# Security Guidelines\n\n";

        for (const guideline of guidelines) {
          const g = guideline as any;
          response += `## ${g.vulnerability_type}`;
          if (g.severity) {
            response += ` [${g.severity} Severity]`;
          }
          response += `\n\n`;

          if (g.cwe_id) {
            response += `**CWE ID:** ${g.cwe_id}\n\n`;
          }

          response += `**Description:** ${g.description}\n\n`;
          response += `**Mitigation:** ${g.mitigation}\n\n`;

          if (g.language) {
            response += `**Language-Specific:** ${g.language}\n\n`;
          }

          response += `---\n\n`;
        }

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      } else if (name === "compare_approaches") {
        const guide = this.manager.getStyleGuide(args.language as string);

        if (!guide) {
          return {
            content: [
              {
                type: "text",
                text: `No guidelines found for ${args.language}`,
              },
            ],
          };
        }

        const topic = args.topic as string;
        const relevant = guide.guidelines.filter(
          (g: any) =>
            g.content.toLowerCase().includes(topic.toLowerCase()) ||
            g.title?.toLowerCase().includes(topic.toLowerCase())
        );

        if (relevant.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No guidelines found for topic: ${topic}`,
              },
            ],
          };
        }

        let response = `# Comparing Approaches for ${topic} in ${args.language}\n\n`;

        const bySource: Record<string, any[]> = {};
        for (const guideline of relevant) {
          const g = guideline as any;
          if (!bySource[g.source_name]) {
            bySource[g.source_name] = [];
          }
          bySource[g.source_name].push(g);
        }

        for (const [source, guidelines] of Object.entries(bySource)) {
          response += `## ${source}\n\n`;
          for (const guideline of guidelines) {
            if (guideline.title) {
              response += `### ${guideline.title}\n\n`;
            }
            response += `${guideline.content}\n\n`;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      } else if (name === "analyze_code") {
        const code = args.code as string;
        const language = args.language as string;
        const autoFix = args.auto_fix as boolean | undefined;

        const results = this.manager.analyzeCode(code, language);

        let response = `# Code Analysis Results for ${language}\n\n`;

        if (results.length === 0) {
          response += "✓ No issues found! Code follows style guidelines.\n\n";
        } else {
          response += `Found ${results.length} issue(s):\n\n`;

          // Group by severity
          const critical = results.filter((r) => r.severity === "error");
          const warnings = results.filter((r) => r.severity === "warning");
          const info = results.filter((r) => r.severity === "info");

          if (critical.length > 0) {
            response += `## ❌ Errors (${critical.length})\n\n`;
            for (const result of critical) {
              response += this.formatAnalysisResult(result);
            }
          }

          if (warnings.length > 0) {
            response += `## ⚠️ Warnings (${warnings.length})\n\n`;
            for (const result of warnings) {
              response += this.formatAnalysisResult(result);
            }
          }

          if (info.length > 0) {
            response += `## ℹ️ Info (${info.length})\n\n`;
            for (const result of info) {
              response += this.formatAnalysisResult(result);
            }
          }
        }

        if (autoFix && results.length > 0) {
          const fixed = this.manager.generateFixedCode(code, language);
          response += `\n## Auto-Fixed Code\n\n\`\`\`${language}\n${fixed}\n\`\`\`\n\n`;
          response += "*Note: Auto-fix is experimental and may not fix all issues. Please review the changes.*\n";
        }

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      } else if (name === "add_custom_guideline") {
        try {
          this.manager.addCustomGuideline({
            language: args.language as string,
            title: args.title as string,
            content: args.content as string,
            category: args.category as string | undefined,
          });

          return {
            content: [
              {
                type: "text",
                text: `✓ Successfully added custom guideline "${args.title}" for ${args.language}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `✗ Failed to add custom guideline: ${error}`,
              },
            ],
          };
        }
      } else if (name === "export_guidelines") {
        try {
          const filepath = this.manager.exportGuidelines(
            args.language as string,
            args.format as string
          );

          return {
            content: [
              {
                type: "text",
                text: `✓ Successfully exported ${args.language} guidelines to:\n${filepath}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `✗ Failed to export guidelines: ${error}`,
              },
            ],
          };
        }
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  private formatAnalysisResult(result: AnalysisResult): string {
    let formatted = `### Line ${result.line}: ${result.message}\n\n`;
    formatted += `**Rule:** ${result.rule} (${result.category})\n\n`;
    formatted += `**Code:**\n\`\`\`\n${result.code}\n\`\`\`\n\n`;
    
    if (result.suggestion) {
      formatted += `**Suggestion:** ${result.suggestion}\n\n`;
    }
    
    formatted += `---\n\n`;
    return formatted;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Style Guide MCP Server v2.0 running on stdio");
  }
}

// Main
async function main() {
  // Ensure data directory exists
  if (!fs.existsSync(CONFIG.dataDir)) {
    fs.mkdirSync(CONFIG.dataDir, { recursive: true });
  }

  // Ensure export directory exists
  if (!fs.existsSync(CONFIG.exportDir)) {
    fs.mkdirSync(CONFIG.exportDir, { recursive: true });
  }

  const dbPath = path.join(CONFIG.dataDir, "styleguides.db");
  const db = new StyleGuideDB(dbPath);
  const manager = new StyleGuideManager(db);

  // Start auto-update scheduler
  manager.startAutoUpdate();

  // Update style guides on startup (async, don't wait)
  manager.updateStyleGuides(false).catch((err) => {
    console.error("Error updating style guides:", err);
  });

  const server = new StyleGuideMCPServer(manager);
  
  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.error("Shutting down...");
    manager.stopAutoUpdate();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.error("Shutting down...");
    manager.stopAutoUpdate();
    process.exit(0);
  });

  await server.run();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});