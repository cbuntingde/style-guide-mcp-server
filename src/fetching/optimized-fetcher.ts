/*
Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

File: fetching/optimized-fetcher.ts
Description: Optimized content fetcher with parallel processing and smart caching

Created: 2025-01-05
Last Modified: 2025-01-05

Change Log:
-----------
2025-01-05 - Chris Bunting - Initial creation with performance optimizations
*/

import { marked } from 'marked';
import * as cheerio from 'cheerio';
import { CachedHttpClient } from '../http/cached-client.js';
import { config } from '../config/index.js';

interface ParsedContent {
  title: string;
  content: string;
  section: string;
  category: string;
}

interface FetchOptions {
  timeout?: number;
  priority?: number;
  skipCache?: boolean;
}

interface SourceConfig {
  name: string;
  url: string;
  type: string;
  priority: number;
  timeout?: number;
}

export class OptimizedContentFetcher {
  private httpClient: CachedHttpClient;
  private processingQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private maxConcurrency = 5;
  private activeProcessing = 0;

  constructor(httpClient?: CachedHttpClient) {
    this.httpClient = httpClient || new CachedHttpClient();
    
    // Configure marked for better performance
    marked.setOptions({
      gfm: true,
      breaks: false,
      pedantic: false
    });
  }

  async fetch(url: string, type: string, options: FetchOptions = {}): Promise<string> {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL provided');
    }

    const fetchOptions = {
      timeout: options.timeout || 30000,
      headers: {
        'Accept': this.getAcceptHeader(type),
        'User-Agent': 'StyleGuideMCPServer/2.0.0'
      }
    };

    if (options.skipCache) {
      // For requests that should skip cache, add cache-busting
      const separator = url.includes('?') ? '&' : '?';
      const cacheBuster = `${separator}_t=${Date.now()}`;
      return this.httpClient.fetch(url + cacheBuster, fetchOptions);
    }

    return this.httpClient.fetch(url, fetchOptions);
  }

  private getAcceptHeader(type: string): string {
    switch (type) {
      case 'html':
        return 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
      case 'github-readme':
      case 'markdown':
        return 'text/markdown,text/plain;q=0.9,*/*;q=0.8';
      default:
        return 'text/plain,text/html;q=0.9,*/*;q=0.8';
    }
  }

  parseHTML(html: string, url: string): ParsedContent[] {
    const $ = cheerio.load(html);
    const results: ParsedContent[] = [];

    // Remove unwanted elements
    $('script, style, nav, footer, .nav, .footer, .sidebar, .menu, .ads').remove();
    
    // Try to find main content area with multiple selectors
    const mainContent = 
      $('main').length > 0 ? $('main') :
      $('article').length > 0 ? $('article') :
      $('.content, .main-content, .post-content, .entry-content').length > 0 ? $('.content, .main-content, .post-content, .entry-content').first() :
      $('body');

    // Extract structured content
    const headings = mainContent.find('h1, h2, h3, h4, h5, h6');
    
    if (headings.length > 0) {
      // Process content with headings
      headings.each((index, elem) => {
        const heading = $(elem);
        const title = this.cleanText(heading.text());
        if (!title) return;

        let content = '';
        let category = this.categorizeContent(title, url);

        // Get content until next heading of same or higher level
        const currentLevel = parseInt(elem.tagName.substring(1));
        let next = heading.next();
        
        while (next.length > 0) {
          const nextTag = next.get(0)?.tagName;
          if (nextTag && /^H[1-6]$/.test(nextTag)) {
            const nextLevel = parseInt(nextTag.substring(1));
            if (nextLevel <= currentLevel) break;
          }
          
          // Extract text content
          const textContent = this.extractTextContent(next);
          if (textContent.trim()) {
            content += textContent + '\n\n';
          }
          
          next = next.next();
        }

        if (content.trim()) {
          results.push({
            title,
            content: this.cleanContent(content),
            section: this.generateSection(title),
            category
          });
        }
      });
    } else {
      // No headings found, try to extract the main content as a single section
      const mainText = this.extractTextContent(mainContent);
      if (mainText.trim()) {
        const title = this.extractTitle($, url) || 'Content';
        results.push({
          title,
          content: this.cleanContent(mainText),
          section: this.generateSection(title),
          category: this.categorizeContent(title, url)
        });
      }
    }

    return results;
  }

  parseMarkdown(markdown: string): ParsedContent[] {
    const results: ParsedContent[] = [];
    
    // Split by headings while preserving the heading level
    const sections = markdown.split(/^(#{1,6})\s+(.+)$/gm);
    
    // Remove the first empty element if it exists
    if (sections[0] === '') {
      sections.shift();
    }
    
    // Process sections in pairs: [hashes, title, content]
    for (let i = 0; i < sections.length; i += 3) {
      if (i + 2 < sections.length) {
        const hashes = sections[i];
        const title = sections[i + 1].trim();
        const content = sections[i + 2].trim();
        
        if (title && content) {
          results.push({
            title,
            content: this.cleanContent(content),
            section: this.generateSection(title),
            category: this.categorizeContent(title)
          });
        }
      }
    }

    // If no structured sections found, try alternative parsing
    if (results.length === 0) {
      const lines = markdown.split('\n');
      let currentSection = '';
      let currentTitle = '';
      let currentCategory = '';
      
      for (const line of lines) {
        if (line.startsWith('#')) {
          // Save previous section if it exists
          if (currentTitle && currentSection.trim()) {
            results.push({
              title: currentTitle,
              content: this.cleanContent(currentSection),
              section: this.generateSection(currentTitle),
              category: currentCategory
            });
          }
          
          // Start new section
          currentTitle = line.replace(/^#+\s+/, '').trim();
          currentSection = '';
          currentCategory = this.categorizeContent(currentTitle);
        } else {
          currentSection += line + '\n';
        }
      }
      
      // Add the last section
      if (currentTitle && currentSection.trim()) {
        results.push({
          title: currentTitle,
          content: this.cleanContent(currentSection),
          section: this.generateSection(currentTitle),
          category: currentCategory
        });
      }
    }

    return results;
  }

  private extractTextContent(element: cheerio.Cheerio<any>): string {
    // Clone the element to avoid modifying the original
    const cloned = element.clone();
    
    // Remove script and style tags
    cloned.find('script, style').remove();
    
    // Convert newlines and paragraphs properly
    cloned.find('br').replaceWith('\n');
    cloned.find('p').each((_, elem) => {
      const $p = cheerio.load(elem);
      $p('p').replaceWith($p.text() + '\n\n');
    });
    
    // Handle lists
    cloned.find('li').each((_, elem) => {
      const $li = cheerio.load(elem);
      $li('li').replaceWith('• ' + $li.text() + '\n');
    });
    
    // Handle code blocks
    cloned.find('pre, code').each((_, elem) => {
      const $code = cheerio.load(elem);
      const codeText = $code.text();
      $code('pre, code').replaceWith('```\n' + codeText + '\n```\n');
    });
    
    return cloned.text();
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.,!?;:()[\]{}"']/g, '')
      .trim();
  }

  private cleanContent(content: string): string {
    return content
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
      .replace(/[ \t]+/g, ' ') // Normalize spaces
      .replace(/^\s+|\s+$/gm, '') // Trim lines
      .trim();
  }

  private extractTitle($: cheerio.CheerioAPI, url: string): string | null {
    // Try multiple title sources
    const titleSelectors = [
      'title',
      'h1:first',
      '.title',
      '.page-title',
      '[property="og:title"]',
      '[name="title"]'
    ];

    for (const selector of titleSelectors) {
      const title = $(selector).first().text().trim();
      if (title) return title;
    }

    // Fallback to URL-based title
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      return pathParts[pathParts.length - 1] || 'Content';
    } catch {
      return 'Content';
    }
  }

  private generateSection(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  private categorizeContent(title: string, url?: string): string {
    const lower = title.toLowerCase();
    const urlLower = url?.toLowerCase() || '';

    // Enhanced categorization with more patterns
    const categories = {
      naming: ['naming', 'name', 'variable', 'function', 'method', 'class', 'constant'],
      formatting: ['format', 'style', 'indent', 'spacing', 'line', 'length', 'layout'],
      documentation: ['comment', 'doc', 'readme', 'document', 'description'],
      types: ['type', 'interface', 'enum', 'union', 'generic', 'annotation'],
      classes: ['class', 'object', 'instance', 'constructor', 'destructor'],
      functions: ['function', 'method', 'procedure', 'routine', 'call'],
      imports: ['import', 'export', 'module', 'package', 'require', 'include'],
      'error-handling': ['error', 'exception', 'try', 'catch', 'throw', 'handle'],
      testing: ['test', 'spec', 'mock', 'stub', 'assert', 'verify'],
      security: ['security', 'secure', 'auth', 'encrypt', 'hash', 'vulnerability'],
      performance: ['performance', 'optimize', 'speed', 'memory', 'cache', 'async'],
      concurrency: ['async', 'await', 'promise', 'thread', 'parallel', 'concurrent'],
      'best-practices': ['best', 'practice', 'guideline', 'recommendation', 'should'],
      patterns: ['pattern', 'design', 'architecture', 'structure', 'organize']
    };

    // Check title and URL for category matches
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lower.includes(keyword) || urlLower.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  // Batch processing for multiple sources
  async fetchBatch(sources: SourceConfig[], options: FetchOptions = {}): Promise<Map<string, ParsedContent[]>> {
    const results = new Map<string, ParsedContent[]>();
    
    // Sort by priority
    const sortedSources = sources.sort((a, b) => (a.priority || 5) - (b.priority || 5));
    
    // Group by type for optimized processing
    const htmlSources = sortedSources.filter(s => s.type === 'html');
    const markdownSources = sortedSources.filter(s => s.type === 'markdown' || s.type === 'github-readme');
    
    // Fetch HTML sources in parallel
    if (htmlSources.length > 0) {
      const htmlUrls = htmlSources.map(s => s.url);
      const htmlContents = await this.httpClient.fetchBatch(
        htmlUrls,
        { timeout: options.timeout || 30000 },
        this.maxConcurrency
      );
      
      for (const source of htmlSources) {
        const content = htmlContents.get(source.url);
        if (content) {
          try {
            const parsed = this.parseHTML(content, source.url);
            results.set(source.url, parsed);
          } catch (error) {
            console.error(`Failed to parse HTML from ${source.url}:`, error);
            results.set(source.url, []);
          }
        }
      }
    }
    
    // Fetch markdown sources in parallel
    if (markdownSources.length > 0) {
      const markdownUrls = markdownSources.map(s => s.url);
      const markdownContents = await this.httpClient.fetchBatch(
        markdownUrls,
        { timeout: options.timeout || 30000 },
        this.maxConcurrency
      );
      
      for (const source of markdownSources) {
        const content = markdownContents.get(source.url);
        if (content) {
          try {
            const parsed = this.parseMarkdown(content);
            results.set(source.url, parsed);
          } catch (error) {
            console.error(`Failed to parse Markdown from ${source.url}:`, error);
            results.set(source.url, []);
          }
        }
      }
    }
    
    return results;
  }

  // Queue-based processing for background updates
  queueFetch(source: SourceConfig, callback: (content: ParsedContent[]) => void): void {
    const task = async () => {
      try {
        const content = await this.fetch(source.url, source.type);
        let parsed: ParsedContent[] = [];
        
        if (source.type === 'html') {
          parsed = this.parseHTML(content, source.url);
        } else if (source.type === 'markdown' || source.type === 'github-readme') {
          parsed = this.parseMarkdown(content);
        }
        
        callback(parsed);
      } catch (error) {
        console.error(`Failed to fetch and parse ${source.url}:`, error);
        callback([]);
      }
    };
    
    this.processingQueue.push(task);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.activeProcessing >= this.maxConcurrency) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.processingQueue.length > 0 && this.activeProcessing < this.maxConcurrency) {
      const task = this.processingQueue.shift();
      if (task) {
        this.activeProcessing++;
        
        task().finally(() => {
          this.activeProcessing--;
          this.processQueue();
        });
      }
    }
    
    this.isProcessing = false;
  }

  // Performance monitoring
  getPerformanceStats(): any {
    return {
      cacheStats: this.httpClient.getCacheStats(),
      requestStats: this.httpClient.getRequestStats(),
      queueSize: this.processingQueue.length,
      activeProcessing: this.activeProcessing
    };
  }

  // Preload critical sources
  async preloadCriticalSources(sources: SourceConfig[]): Promise<void> {
    const criticalUrls = sources
      .filter(s => (s.priority || 5) <= 2) // Priority 1-2
      .map(s => s.url);
    
    if (criticalUrls.length > 0) {
      console.log(`Preloading ${criticalUrls.length} critical sources...`);
      await this.httpClient.preloadCache(criticalUrls);
    }
  }
}