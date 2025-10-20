# Style Guide MCP Server - Example Usage

This document provides practical examples of how to use the Style Guide MCP server with Claude Desktop and other MCP-compatible tools.

## 🚀 Quick Start

### 1. Setup Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
```json
{
  "mcpServers": {
    "style-guide": {
      "command": "node",
      "args": ["/absolute/path/to/style-guide-mcp-server/build/index.js"]
    }
  }
}
```

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
```json
{
  "mcpServers": {
    "style-guide": {
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\style-guide-mcp-server\\build\\index.js"]
    }
  }
}
```

Restart Claude Desktop to load the server.

## 📚 Accessing Style Guides

### Get Complete Style Guide

```
Show me the TypeScript style guide
```

### Get Best Practices

```
What are the Python best practices?
```

### Get Security Guidelines

```
Show me all security guidelines
```

## 🔍 Searching for Specific Topics

### Search by Topic

```
Search for naming conventions in TypeScript
```

### Search by Language

```
Find error handling patterns in JavaScript
```

### General Search

```
Look up async/await best practices
```

## 🛡️ Security Checks

### Specific Vulnerabilities

```
What are SQL injection vulnerabilities?
```

```
Show me XSS prevention techniques
```

```
Check for SSRF vulnerabilities
```

### Language-Specific Security

```
What are React security best practices?
```

```
Show me Node.js security guidelines
```

```
Check security guidelines for Python
```

### Framework Security

```
What are the OWASP API Security Top 10?
```

```
Show me Docker security best practices
```

```
What are container security issues?
```

## 🔧 Code Analysis

### Analyze Code with Issues

```
Analyze this JavaScript code:
var user = {name: 'John'};
let config = {debug: true};
function getData() {
  return fetch('/api');
}
```

### Analyze Code with Auto-Fix

```
Check my Python code and auto-fix issues:
def get_user_data(user_id):
    query = "SELECT * FROM users WHERE id = " + user_id
    return execute_query(query)
```

### Style Violation Detection

```
Analyze this TypeScript code for style issues:
interface User {
    name: string;
    age: any;
    id: number;
}
```

## 📊 Comparing Different Approaches

### Compare Style Guide Recommendations

```
Compare naming conventions in TypeScript across different sources
```

```
What do different guides say about error handling in Python?
```

```
Compare import statement best practices in JavaScript
```

## ✨ Adding Custom Guidelines

### Add Team-Specific Rules

```
Add a custom TypeScript guideline titled "API Response Types" 
with content: All API responses must have explicit return types
```

### Add Language-Specific Guidelines

```
Add a custom JavaScript guideline titled "Error Handling"
with content: Always use try-catch blocks for async operations and provide meaningful error messages
category: error-handling
```

### Add Security Guidelines

```
Add a custom security guideline for Python
title: "Input Validation"
content: Always validate and sanitize user input at application boundaries
category: security
```

## 📤 Exporting Guidelines

### Export to HTML

```
Export TypeScript style guide as HTML
```

```
Save Python guidelines to HTML format
```

### Export to Markdown

```
Export JavaScript best practices as markdown
```

```
Save Rust style guide to markdown
```

### Export to JSON

```
Export Go guidelines as JSON for programmatic access
```

```
Export C++ best practices as JSON
```

## 🎯 Real-World Examples

### Code Review Workflow

```
I'm reviewing this TypeScript code, can you analyze it and suggest improvements?

const data = fetch('/api/users').then(res => res.json());
```

### Learning New Language

```
I'm new to Rust, what are the naming conventions I should follow?
```

### Security Review

```
Can you check this code for security vulnerabilities?

const sql = "DELETE FROM users WHERE id = " + req.params.id;
db.query(sql, (err, result) => {
  if (err) throw err;
  res.json(result);
});
```

### Team Standards

```
Add a custom guideline for our team:
Language: TypeScript
Title: "Component Props"
Content: All React component props must be defined as interfaces, not type aliases
Category: types
```

### Documentation Generation

```
Export our team's JavaScript coding standards as HTML for the onboarding wiki
```

## 🔧 Advanced Usage

### Complex Code Analysis

```
Analyze this complex Python code for both style and security issues:

import os
import subprocess
from flask import Flask, request

app = Flask(__name__)

@app.route('/upload', methods=['POST'])
def upload_file():
    filename = request.files['file'].filename
    filepath = os.path.join('/uploads', filename)
    request.files['file'].save(filepath)
    
    command = f'ls -la {filepath}'
    result = subprocess.run(command, shell=True, capture_output=True)
    
    return {'file': filename, 'info': result.stdout.decode()}
```

### Comparative Analysis

```
Compare how different style guides handle async/await patterns in JavaScript
```

### Security Assessment

```
Check this code for OWASP Top 10 vulnerabilities:

const express = require('express');
const app = express();

app.get('/user/:id', (req, res) => {
  const userId = req.params.id;
  const query = `SELECT * FROM users WHERE id = ${userId}`;
  
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send('Error');
      return;
    }
    res.json(results[0]);
  });
});
```

## 💡 Tips for Effective Usage

### Be Specific in Your Requests

Instead of: "Help me with code"
Try: "Analyze this TypeScript function for naming conventions and type safety"

### Provide Context

Instead of: "Is this code good?"
Try: "Review this React component for performance and accessibility issues"

### Use Auto-Fix for Quick Improvements

Add "auto-fix" to your analysis requests to get corrected code automatically.

### Export for Team Sharing

Export guidelines when you want to share them with your team or include in documentation.

### Combine Multiple Operations

```
Analyze this Python code, check for security issues, and then export the Python security guidelines as HTML
```

---

## 🆘 Need Help?

For more examples or specific use cases, refer to the [complete API documentation](docs/API.md) or [security guidelines](docs/SECURITY.md).