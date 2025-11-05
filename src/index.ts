/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: index.ts
Description: Main entry point for the Style Guide MCP Server

Created: 2025-01-04
Last Modified: 2025-01-05

Change Log:
-----------
2025-01-04 - Chris Bunting - Initial creation
2025-01-05 - Chris Bunting - Performance optimizations and memory management
*/

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { OptimizedDatabase } from "./database/optimized-db.js";
import { CachedHttpClient } from "./http/cached-client.js";
import { OptimizedContentFetcher } from "./fetching/optimized-fetcher.js";
import { config, ensureDirectories } from "./config/index.js";
import { memoryManager } from "./memory/memory-manager.js";

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

// Ensure required directories exist
ensureDirectories();

// Use optimized database
type StyleGuideDB = OptimizedDatabase;

// Use optimized content fetcher
type ContentFetcher = OptimizedContentFetcher;

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
    const { marked } = require("marked");
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

// Style Guide Manager with optimizations
class StyleGuideManager {
  private db: StyleGuideDB;
  private fetcher: ContentFetcher;
  private httpClient: CachedHttpClient;
  private analyzer: CodeAnalyzer;
  private exporter: ExportManager;
  private updateInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(db: StyleGuideDB) {
    this.db = db;
    this.httpClient = new CachedHttpClient();
    this.fetcher = new OptimizedContentFetcher(this.httpClient);
    this.analyzer = new CodeAnalyzer(db);
    this.exporter = new ExportManager(config.database.path.replace('.db', '-exports'));
    
    // Initialize asynchronously to improve startup time
    this.initializationPromise = this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    try {
      console.error("Initializing StyleGuideManager...");
      
      // Preload critical sources in background
      const criticalSources = this.getCriticalSources();
      if (criticalSources.length > 0) {
        this.fetcher.preloadCriticalSources(criticalSources).catch(error => {
          console.error("Failed to preload critical sources:", error);
        });
      }
      
      this.isInitialized = true;
      console.error("StyleGuideManager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize StyleGuideManager:", error);
      throw error;
    }
  }

  private getCriticalSources(): any[] {
    const sources: any[] = [];
    
    // Add high-priority sources from each language
    Object.entries(config.sources).forEach(([language, languageSources]) => {
      const highPriority = languageSources.filter(s => s.priority <= 2);
      sources.push(...highPriority.map(s => ({ ...s, language })));
    });
    
    return sources;
  }

  async ensureInitialized(): Promise<void> {
    if (!this.isInitialized && this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  startAutoUpdate() {
    console.error("Starting auto-update scheduler...");
    this.updateInterval = setInterval(async () => {
      console.error("Running scheduled update...");
      await this.updateStyleGuides(false);
    }, config.caching.ttl);
  }

  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  async updateStyleGuides(force: boolean = false) {
    await this.ensureInitialized();
    console.error("Updating style guides...");

    // Collect all sources to update
    const sourcesToUpdate: Array<{language: string, source: any}> = [];
    
    for (const [language, sources] of Object.entries(config.sources)) {
      for (const source of sources) {
        if (!force && !this.db.needsUpdate(language, source.name)) {
          console.error(`Skipping ${language}/${source.name} (cached)`);
          continue;
        }
        sourcesToUpdate.push({ language, source });
      }
    }

    if (sourcesToUpdate.length === 0) {
      console.error("All sources are up to date");
      return;
    }

    console.error(`Updating ${sourcesToUpdate.length} sources...`);

    // Batch fetch sources by type for better performance
    const htmlSources = sourcesToUpdate.filter(s => s.source.type === 'html');
    const markdownSources = sourcesToUpdate.filter(s => 
      s.source.type === 'markdown' || s.source.type === 'github-readme'
    );

    // Process HTML sources
    if (htmlSources.length > 0) {
      const htmlUrls = htmlSources.map(s => s.source.url);
      const htmlContents = await this.httpClient.fetchBatch(
        htmlUrls,
        { timeout: 30000 },
        5 // concurrency
      );

      for (const { language, source } of htmlSources) {
        try {
          const content = htmlContents.get(source.url);
          if (!content) continue;

          console.error(`Processing ${language}/${source.name}...`);
          const parsed = this.fetcher.parseHTML(content, source.url);
          
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
          console.error(`✗ Failed to update ${language}/${source.name}:`, error);
        }
      }
    }

    // Process Markdown sources
    if (markdownSources.length > 0) {
      const markdownUrls = markdownSources.map(s => s.source.url);
      const markdownContents = await this.httpClient.fetchBatch(
        markdownUrls,
        { timeout: 30000 },
        5 // concurrency
      );

      for (const { language, source } of markdownSources) {
        try {
          const content = markdownContents.get(source.url);
          if (!content) continue;

          console.error(`Processing ${language}/${source.name}...`);
          const parsed = this.fetcher.parseMarkdown(content);
          
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
          console.error(`✗ Failed to update ${language}/${source.name}:`, error);
        }
      }
    }

    // Add some basic security guidelines
    this.addBasicSecurityGuidelines();
    
    // Optimize database after updates
    this.db.optimize();
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
        vulnerabilityType: "Cross-Site Scripting (XSS)",
        description:
          "Enables attackers to inject malicious scripts into web pages viewed by other users.",
        mitigation:
          "Sanitize and escape all user input before rendering. Use Content Security Policy headers. Encode output based on context (HTML, JavaScript, URL). Use frameworks with auto-escaping.",
        severity: "High",
        cweId: "CWE-79",
      },
      {
        vulnerabilityType: "Broken Authentication",
        description:
          "Weak authentication mechanisms that can be bypassed or compromised.",
        mitigation:
          "Implement multi-factor authentication. Use strong password policies. Secure session management. Implement account lockout after failed attempts. Use secure token generation.",
        severity: "Critical",
        cweId: "CWE-287",
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
      const languages = Object.keys(config.sources);

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

// Main with optimized startup
async function main() {
  const startTime = Date.now();
  
  try {
    console.error("Starting Style Guide MCP Server v2.0...");
    
    // Initialize database with optimizations
    const db = new OptimizedDatabase(config.database.path);
    const manager = new StyleGuideManager(db);

    // Start server immediately, update in background
    const server = new StyleGuideMCPServer(manager);
    
    // Start auto-update scheduler
    manager.startAutoUpdate();

    // Update style guides in background (don't block startup)
    manager.updateStyleGuides(false).catch((err) => {
      console.error("Error updating style guides:", err);
    });

    // Set up graceful shutdown
    const shutdown = () => {
      console.error("Shutting down...");
      manager.stopAutoUpdate();
      db.close();
      memoryManager.shutdown();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("Uncaught exception:", error);
      shutdown();
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled rejection at:", promise, "reason:", reason);
      shutdown();
    });

    const startupTime = Date.now() - startTime;
    console.error(`Server started in ${startupTime}ms`);
    
    await server.run();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});