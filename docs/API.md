# Style Guide MCP Server API Documentation

## Overview

The Style Guide MCP Server provides enterprise-grade access to programming style guides, best practices, and security guidelines through the Model Context Protocol (MCP). This document describes the complete API specification, including resources, tools, and usage examples.

## Table of Contents

- [Authentication](#authentication)
- [Resources](#resources)
- [Tools](#tools)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Security](#security)
- [Examples](#examples)

## Authentication

The MCP server uses standard MCP authentication mechanisms. All requests should include proper MCP headers and follow the MCP protocol specification.

### Headers

```
Content-Type: application/json
Authorization: Bearer <token>
X-Correlation-ID: <uuid>
```

## Resources

### Style Guide Resources

Access style guides directly through URI schemes:

#### `style-guide://{language}`

Complete style guide for a specific programming language.

**Parameters:**
- `language` (string): Programming language (typescript, javascript, python, cpp, java, go, rust)

**Example:**
```
GET style-guide://typescript
```

**Response:**
```json
{
  "contents": [
    {
      "uri": "style-guide://typescript",
      "mimeType": "text/plain",
      "text": "# TYPESCRIPT STYLE GUIDE\n\n## Google TypeScript Style Guide\n\n### Naming Conventions\n..."
    }
  ]
}
```

#### `best-practices://{language}`

Best practices organized by category for a specific language.

**Parameters:**
- `language` (string): Programming language

**Example:**
```
GET best-practices://python
```

#### `security://all`

All security guidelines and vulnerability information.

**Example:**
```
GET security://all
```

## Tools

### 1. Search Guidelines

Search across all style guides for specific topics.

**Name:** `search_guidelines`

**Parameters:**
- `query` (string, required): Search query
- `language` (string, optional): Filter by programming language

**Example:**
```json
{
  "name": "search_guidelines",
  "arguments": {
    "query": "naming conventions",
    "language": "typescript"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 5 results for \"naming conventions\":\n\n## Naming Conventions (TypeScript - Google Style Guide)\n\nUse PascalCase for class names..."
    }
  ]
}
```

### 2. Get Specific Guidelines

Retrieve guidelines by topic and language.

**Name:** `get_guideline`

**Parameters:**
- `language` (string, required): Programming language
- `topic` (string, required): Topic or category (naming, formatting, security, etc.)

**Example:**
```json
{
  "name": "get_guideline",
  "arguments": {
    "language": "javascript",
    "topic": "error-handling"
  }
}
```

### 3. Check Security

Get security guidelines for potential vulnerabilities.

**Name:** `check_security`

**Parameters:**
- `language` (string, optional): Programming language
- `vulnerability_type` (string, optional): Type of vulnerability (SQL injection, XSS, etc.)

**Example:**
```json
{
  "name": "check_security",
  "arguments": {
    "vulnerability_type": "SQL injection"
  }
}
```

### 4. Compare Approaches

Compare different style guide recommendations.

**Name:** `compare_approaches`

**Parameters:**
- `language` (string, required): Programming language
- `topic` (string, required): Topic to compare

**Example:**
```json
{
  "name": "compare_approaches",
  "arguments": {
    "language": "python",
    "topic": "import statements"
  }
}
```

### 5. Analyze Code

Analyze code against style guidelines and detect issues.

**Name:** `analyze_code`

**Parameters:**
- `code` (string, required): Code to analyze
- `language` (string, required): Programming language of the code
- `auto_fix` (boolean, optional): Whether to generate auto-fixed code

**Example:**
```json
{
  "name": "analyze_code",
  "arguments": {
    "code": "var name = 'John';\nlet age = 30;",
    "language": "javascript",
    "auto_fix": true
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "# Code Analysis Results for JavaScript\n\nFound 2 issue(s):\n\n## ⚠️ Warnings (1)\n### Line 1: Use 'let' or 'const' instead of 'var'\n**Rule:** no-var (best-practices)\n**Suggestion:** Replace 'var' with 'const' or 'let'\n\n## Auto-Fixed Code\n\n```javascript\nconst name = 'John';\nlet age = 30;\n```"
    }
  ]
}
```

### 6. Add Custom Guidelines

Add your own project-specific guidelines.

**Name:** `add_custom_guideline`

**Parameters:**
- `language` (string, required): Programming language
- `title` (string, required): Title of the guideline
- `content` (string, required): Content of the guideline
- `category` (string, optional): Category (naming, formatting, security)

**Example:**
```json
{
  "name": "add_custom_guideline",
  "arguments": {
    "language": "typescript",
    "title": "API Response Types",
    "content": "All API responses must have explicit return types",
    "category": "types"
  }
}
```

### 7. Export Guidelines

Export style guidelines to files in various formats.

**Name:** `export_guidelines`

**Parameters:**
- `language` (string, required): Programming language
- `format` (string, required): Export format (markdown, html, json)

**Example:**
```json
{
  "name": "export_guidelines",
  "arguments": {
    "language": "python",
    "format": "html"
  }
}
```

## Error Handling

### Error Response Format

All errors follow the MCP error response format:

```json
{
  "error": {
    "code": -32603,
    "message": "Invalid input: query too long",
    "data": {
      "type": "ValidationError",
      "severity": "MEDIUM",
      "correlationId": "corr_1234567890_abc123"
    }
  }
}
```

### Common Error Codes

| Code | Description | Example |
|------|-------------|---------|
| -32602 | Invalid params | Missing required parameter |
| -32603 | Internal error | Database connection failed |
| -32700 | Parse error | Invalid JSON in request |
| 4001 | Validation error | Input too long |
| 4002 | Rate limit exceeded | Too many requests |
| 4003 | Resource not found | Language not supported |

## Rate Limiting

The server implements enterprise-grade rate limiting:

### Default Limits

- **Window:** 60 seconds
- **Max Requests:** 100 per window per client
- **Burst Limit:** 20 requests per second

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
X-RateLimit-Retry-After: 30
```

### Rate Limit Response

When rate limited, the server returns:

```json
{
  "error": {
    "code": 4002,
    "message": "Rate limit exceeded. Please try again in 30 seconds.",
    "data": {
      "retryAfter": 30,
      "limit": 100,
      "window": 60
    }
  }
}
```

## Security

### Input Validation

All inputs are validated and sanitized:

- **SQL Injection Protection:** Parameterized queries and input sanitization
- **XSS Protection:** HTML sanitization and output encoding
- **Path Traversal Protection:** Path validation and normalization
- **Command Injection Protection:** Command validation and allowlisting

### Data Protection

- **Encryption:** All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- **Key Management:** Secure key rotation and management
- **Data Minimization:** Only necessary data is collected and stored
- **Retention Policies:** Automatic data cleanup based on configured policies

### Audit Logging

All security events are logged with correlation IDs:

```json
{
  "timestamp": "2025-01-04T18:00:00.000Z",
  "level": "WARN",
  "correlationId": "corr_1234567890_abc123",
  "message": "SECURITY_VALIDATION_FAILED",
  "context": {
    "event": "SQL_INJECTION_ATTEMPT",
    "input": "SELECT * FROM users WHERE '1'='1'",
    "severity": "HIGH"
  }
}
```

## Examples

### Example 1: Code Review Workflow

```javascript
// 1. Analyze code
const analysis = await mcpClient.callTool({
  name: "analyze_code",
  arguments: {
    code: `
      var user = {name: 'John'};
      let config = {debug: true};
      function getData() {
        return fetch('/api');
      }
    `,
    language: "javascript",
    auto_fix: true
  }
});

// 2. Get specific guidelines for issues found
const namingGuidelines = await mcpClient.callTool({
  name: "get_guideline",
  arguments: {
    language: "javascript",
    topic: "naming"
  }
});

// 3. Add custom guideline for team standards
await mcpClient.callTool({
  name: "add_custom_guideline",
  arguments: {
    language: "javascript",
    title: "Variable Declaration",
    content: "Always use const for variables that are not reassigned",
    category: "best-practices"
  }
});
```

### Example 2: Security Review

```javascript
// 1. Check for common vulnerabilities
const sqlInjection = await mcpClient.callTool({
  name: "check_security",
  arguments: {
    vulnerability_type: "SQL injection"
  }
});

// 2. Get language-specific security guidelines
const nodeSecurity = await mcpClient.callTool({
  name: "check_security",
  arguments: {
    language: "javascript"
  }
});

// 3. Search for specific security topics
const authGuidelines = await mcpClient.callTool({
  name: "search_guidelines",
  arguments: {
    query: "authentication best practices",
    language: "typescript"
  }
});
```

### Example 3: Team Documentation Export

```javascript
// 1. Export complete style guide
const htmlExport = await mcpClient.callTool({
  name: "export_guidelines",
  arguments: {
    language: "typescript",
    format: "html"
  }
});

// 2. Export best practices
const markdownExport = await mcpClient.callTool({
  name: "export_guidelines",
  arguments: {
    language: "python",
    format: "markdown"
  }
});

// 3. Export for API documentation
const jsonExport = await mcpClient.callTool({
  name: "export_guidelines",
  arguments: {
    language: "javascript",
    format: "json"
  }
});
```

## Monitoring and Health

### Health Check Endpoint

```http
GET /health
```

**Response:**
```json
{
  "status": "HEALTHY",
  "timestamp": "2025-01-04T18:00:00.000Z",
  "version": "2.0.0",
  "checks": [
    {
      "name": "database",
      "status": "HEALTHY",
      "duration": 15,
      "message": "Database connection successful"
    },
    {
      "name": "memory",
      "status": "HEALTHY",
      "duration": 5,
      "message": "Memory usage normal: 45.2%"
    }
  ],
  "metrics": {
    "uptime": 86400000,
    "requests": 1250,
    "errors": 3,
    "avgResponseTime": 125
  }
}
```

### Metrics Endpoint

```http
GET /metrics
```

Provides Prometheus-compatible metrics for monitoring.

## Support

For support and questions:

- **Documentation:** [Full Documentation](https://github.com/cbunting99/style-guide-mcp-server)
- **Issues:** [GitHub Issues](https://github.com/cbuntingde/style-guide-mcp-server/issues)
- **Security:** Report security issues to security@example.com

## License

Copyright 2025 Chris Bunting <cbunting99@gmail.com>
All rights reserved.