# Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
# All rights reserved.
#
# File: readme.md
# Description: README for Style Guide MCP Server
#
# Created: 2025-01-04
# Last Modified: 2025-01-04
#
# Change Log:
#-----------
# 2025-01-04 - Chris Bunting - Initial creation

# Style Guide MCP Server

A comprehensive Model Context Protocol (MCP) server that provides access to programming style guides, best practices, and security guidelines for multiple programming languages.

## 🚀 Features

### 📚 Comprehensive Style Guides
- **15+ Languages Supported**: TypeScript, JavaScript, Python, C++, Java, Go, Rust, C#, PHP, Ruby, Swift, Kotlin, and more
- **Multiple Sources**: Google Style Guides, official documentation, community best practices
- **Smart Caching**: Reduces network calls while keeping content fresh
- **SQLite Storage**: Local database for persistent storage of guidelines

### 🔍 Powerful Search & Discovery
- **Full-Text Search**: Search across all guidelines and best practices
- **Category Filtering**: Find guidelines by topic (naming, formatting, security, etc.)
- **Source Comparison**: Compare recommendations from different style guides
- **Context-Aware**: Get relevant guidelines based on your needs

### 🛡️ Security Guidelines
- **28+ Vulnerability Types**: Comprehensive security vulnerability database
- **CWE References**: Linked to Common Weakness Enumeration
- **Language-Specific**: Tailored security advice per language
- **Framework Coverage**: React, Node.js, Docker, Kubernetes security

### 🔧 Code Analysis
- **Pattern Matching**: Detects common style violations
- **Severity Levels**: Errors, warnings, and info-level suggestions
- **Auto-Fix**: Automatically fix common issues
- **Detailed Reports**: Line numbers, suggestions, and explanations

### 📤 Export Capabilities
- **Multiple Formats**: Markdown, HTML, JSON
- **Professional Styling**: Clean document generation
- **Timestamped Files**: Version-controlled exports

## 🏗️ Architecture

### Core Components
- **MCP Server**: Standard MCP protocol implementation
- **Content Fetcher**: Fetches and parses content from various sources
- **SQLite Database**: Local storage for guidelines and security data
- **Code Analyzer**: Pattern-based code analysis with auto-fix capabilities
- **Export Manager**: Multi-format document generation

### Security Features
- **Input Validation**: Comprehensive validation and sanitization
- **Timeout Protection**: 30-second timeouts for network requests
- **Error Handling**: Graceful error handling with proper logging
- **Data Encryption**: Optional database encryption support

## 🛠️ Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Quick Start

1. **Clone the repository:**
```bash
git clone https://github.com/cbuntingde/style-guide-mcp-server.git
cd style-guide-mcp-server
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the server:**
```bash
npm run build
```

4. **Start the server:**
```bash
npm start
```

## ⚙️ Configuration

### Environment Variables

```bash
# Server Configuration
SERVER_NAME=style-guide-server
SERVER_VERSION=1.0.0
LOG_LEVEL=info

# Database Configuration
DATABASE_PATH=./data/styleguides.db
DATABASE_BACKUP_ENABLED=true
DATABASE_ENCRYPTION_ENABLED=false

# Security Configuration
RATE_LIMITING_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
MAX_QUERY_LENGTH=1000
MAX_CODE_LENGTH=10000

# Monitoring Configuration
MONITORING_ENABLED=true
METRICS_INTERVAL=60000
HEALTH_CHECK_INTERVAL=30000

# Caching Configuration
CACHING_ENABLED=true
CACHE_TTL=604800000
CACHE_MAX_SIZE=1000
```

### Claude Desktop Configuration

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

## 📖 Usage

### MCP Resources

Access style guides directly through URI schemes:

- **`style-guide://{language}`** - Complete style guide for a language
- **`best-practices://{language}`** - Best practices organized by category
- **`security://all`** - All security guidelines and vulnerabilities

### MCP Tools

#### Search Guidelines
```javascript
{
  "name": "search_guidelines",
  "arguments": {
    "query": "naming conventions",
    "language": "typescript"
  }
}
```

#### Analyze Code
```javascript
{
  "name": "analyze_code",
  "arguments": {
    "code": "var name = 'John';\nlet age = 30;",
    "language": "javascript",
    "auto_fix": true
  }
}
```

#### Check Security
```javascript
{
  "name": "check_security",
  "arguments": {
    "vulnerability_type": "SQL injection"
  }
}
```

#### Export Guidelines
```javascript
{
  "name": "export_guidelines",
  "arguments": {
    "language": "python",
    "format": "html"
  }
}
```

#### Add Custom Guidelines
```javascript
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

## 🧪 Development

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Generate coverage report
npm run test:coverage
```

### Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Formatting
npm run format:check

# Security audit
npm audit
```

### Building

```bash
# Development build
npm run dev

# Production build
npm run build
```

## 📊 Supported Languages

### Core Languages
- **TypeScript** - Google Style Guide, Microsoft Guidelines, Best Practices
- **JavaScript** - Google Style Guide, Airbnb Style Guide, MDN Guide
- **Python** - PEP 8, Google Python Style Guide, Best Practices
- **Java** - Google Java Style Guide, Oracle Conventions
- **C++** - Google C++ Style Guide, C++ Core Guidelines
- **Go** - Effective Go, Go Code Review Comments
- **Rust** - Rust API Guidelines, Rust Book
- **C#** - Microsoft C# Coding Conventions
- **PHP** - PHP-FIG Standards, Best Practices
- **Ruby** - Ruby Style Guide, Best Practices
- **Swift** - Swift API Design Guidelines
- **Kotlin** - Kotlin Coding Conventions

### Frameworks & Technologies
- **React** - Security Best Practices, Performance Optimization
- **Vue.js** - Style Guide, Best Practices
- **Angular** - Style Guide, Security Best Practices
- **Node.js** - Security Best Practices, Performance
- **Express.js** - Best Practices, Security
- **Django** - Best Practices, Security
- **Flask** - Best Practices, Security
- **Docker** - Security Best Practices
- **Kubernetes** - Security Best Practices

### Security Coverage
- **OWASP Top 10** - Comprehensive coverage
- **Injection Attacks** - SQL, Command, LDAP Injection
- **XSS** - Cross-Site Scripting variants
- **CSRF** - Cross-Site Request Forgery
- **Authentication** - Broken Authentication, Session Management
- **Cryptography** - Weak Cryptography, Hardcoded Credentials
- **API Security** - BOLA, Excessive Data Exposure, Rate Limiting
- **Modern Threats** - SSRF, XXE, Container Security

## 🔒 Security

### Security Features
- **Input Validation**: Comprehensive validation and sanitization
- **Network Security**: Timeout protection, user-agent headers
- **Data Protection**: Optional database encryption
- **Error Handling**: Secure error reporting without information leakage
- **Dependency Security**: Regular security audits

### Supported Vulnerability Types
The server includes detailed guidelines for 28+ vulnerability types including:
- SQL Injection, Command Injection, LDAP Injection
- Cross-Site Scripting (XSS), DOM-based XSS
- Cross-Site Request Forgery (CSRF), Clickjacking
- Insecure Deserialization, Path Traversal
- Broken Authentication, Session Fixation
- Weak Cryptography, Hardcoded Credentials
- API Security vulnerabilities
- Server-Side Request Forgery (SSRF)
- XML External Entity (XXE)
- Container Escape, Cloud Misconfigurations

## 📁 Project Structure

```
style-guide-mcp-server/
├── src/
│   ├── index.ts              # Main entry point
│   ├── config/               # Configuration modules
│   ├── errors/               # Error handling
│   ├── logging/              # Logging utilities
│   ├── monitoring/           # Health checks and metrics
│   ├── rate-limiting/        # Rate limiting implementation
│   └── validation/           # Input validation
├── tests/
│   ├── setup.ts              # Test configuration
│   └── unit/                 # Unit tests
├── docs/
│   └── API.md                # API documentation
├── data/                     # Database storage (gitignored)
├── exports/                  # Generated exports (gitignored)
├── build/                    # Compiled output (gitignored)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── mcp.json                  # MCP server configuration
└── README.md                 # This file
```

## 🚀 Deployment

### Production Deployment

1. **Configure environment variables**
2. **Build the application**: `npm run build`
3. **Deploy with your preferred method**:
   - Direct Node.js execution
   - Docker containers
   - Process managers (PM2, systemd)

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY build/ ./build/
EXPOSE 3000
CMD ["node", "build/index.js"]
```

## 📚 API Documentation

Complete API documentation is available at:
- [API Documentation](docs/API.md)
- [Example Usage](example-usage.md)

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for details.

### Development Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Standards

- Follow the enterprise coding standards
- Add headers to all files
- Include comprehensive tests
- Update documentation

## 📄 License

Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
All rights reserved.

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- **Documentation**: [Full Documentation](docs/)
- **Issues**: [GitHub Issues](https://github.com/cbuntingde/style-guide-mcp-server/issues)
- **Examples**: [Example Usage](example-usage.md)

## 🗺️ Roadmap

- [ ] Additional language support (Lua, Dart, Scala)
- [ ] Advanced code analysis with AI suggestions
- [ ] Team collaboration features
- [ ] Plugin system for custom analyzers
- [ ] Performance optimization and caching improvements
- [ ] Multi-tenant support
- [ ] Advanced reporting and analytics

## 🙏 Acknowledgments

- Google Style Guides for comprehensive style guidelines
- OWASP for security best practices
- The MCP community for protocol development
- All contributors and users of this project

---

**Built with ❤️ for the development community**