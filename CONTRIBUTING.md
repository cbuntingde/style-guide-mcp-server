# Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
# All rights reserved.
#
# File: CONTRIBUTING.md
# Description: Contribution guidelines for Style Guide MCP Server
#
# Created: 2025-01-04
# Last Modified: 2025-01-04
#
# Change Log:
#-----------
# 2025-01-04 - Chris Bunting - Initial creation

# Contributing to Style Guide MCP Server

We welcome contributions to the Style Guide MCP Server! This document provides guidelines for contributors to ensure a smooth and collaborative development process.

## 🤝 How to Contribute

### Getting Started

1. **Fork the Repository**
   ```bash
   # Fork the repository on GitHub
   # Clone your fork locally
   git clone https://github.com/YOUR_USERNAME/style-guide-mcp-server.git
   cd style-guide-mcp-server
   ```

2. **Set Up Development Environment**
   ```bash
   # Install dependencies
   npm install
   
   # Create development branch
   git checkout -b feature/your-feature-name
   
   # Build the project
   npm run build
   
   # Run tests to ensure everything works
   npm test
   
   # Run performance tests (optional but recommended)
   npm run test:performance
   ```

3. **Configure Your Environment**
   - Copy environment variables from `.env.example` (create if needed)
   - Set up your local database (SQLite with WAL mode recommended)
   - Configure your IDE for TypeScript development
   - Ensure you have 4GB+ RAM available for optimal caching performance
   - Set up cache directories (they will be created automatically)

## 📋 Types of Contributions

### 🐛 Bug Reports

When reporting bugs, please provide:
- **Clear description** of the issue
- **Steps to reproduce** the problem
- **Expected vs. actual behavior**
- **Environment details** (Node.js version, OS, etc.)
- **Error logs** if applicable
- **Minimal reproduction case** if possible

Use the provided bug report template:
```markdown
## Bug Description
Brief description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., Windows 10, macOS Ventura]
- Node.js: [e.g., 18.17.0]
- Package version: [e.g., 1.0.0]

## Additional Context
Any other relevant information
```

### ✨ Feature Requests

For new features:
- **Describe the feature** and its purpose
- **Explain the use case** clearly
- **Provide examples** if possible
- **Consider implementation complexity**

### 📝 Documentation Contributions

We appreciate documentation improvements:
- Fix typos and grammatical errors
- Improve code examples
- Add missing documentation
- Translate documentation
- Update outdated information

### 🔧 Code Contributions

#### Development Workflow

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make Your Changes**
   - Follow the existing code style and patterns
   - Add comprehensive tests for new functionality
   - Update documentation as needed
   - Include proper error handling

3. **Commit Guidelines**
   ```bash
   # Good commit messages:
   feat: add TypeScript interface validation
   fix: resolve memory leak in database connection
   docs: update installation instructions
   test: add unit tests for code analyzer
   refactor: optimize SQLite query performance
   ```

   Commit message format:
   - `type: description` (max 72 chars)
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
   - Add detailed body if needed

4. **Local Testing**
   ```bash
   # Run all tests
   npm test
   
   # Run type checking
   npm run type-check
   
   # Run linting
   npm run lint
   
   # Build project
   npm run build
   ```

5. **Push and Create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   # Then create PR on GitHub
   ```

## 🏗️ Code Standards

### General Guidelines

- **Enterprise-grade code**: All contributions must meet production quality standards
- **TypeScript**: Use TypeScript for all new code
- **Error handling**: Implement comprehensive error handling
- **Logging**: Use the established logging patterns
- **Testing**: Maintain high test coverage (>90%)
- **Documentation**: Document all public APIs and complex logic

### Code Style

- Follow existing code formatting (use the provided `.prettierrc` if available)
- Use meaningful variable and function names
- Add JSDoc comments for all public functions
- Include type annotations for all parameters and return values
- Use async/await for all asynchronous operations
- Implement proper error handling with try-catch blocks
- Follow the modular architecture pattern (database/, http/, fetching/, memory/)

### Performance Guidelines

- **Startup Time**: Target <50ms startup time (current: 22ms)
- **Memory Usage**: Monitor memory usage and implement proper cleanup
- **Caching**: Use the provided caching layers for HTTP requests and database queries
- **Batch Processing**: Use batch operations for improved performance
- **Connection Pooling**: Leverage database connection pooling
- **Lazy Loading**: Implement lazy loading where appropriate

### Architecture Guidelines

- **Modular Design**: Keep modules focused and loosely coupled
- **Dependency Injection**: Use dependency injection for testability
- **Error Boundaries**: Implement proper error boundaries
- **Configuration**: Use environment variables for configuration
- **Monitoring**: Add performance monitoring for new features
- **Security**: Follow security best practices in all modules

### File Headers

All new files must include the copyright header:
```typescript
/*
 * Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
 * All rights reserved.
 *
 * File: [filename]
 * Description: [brief description]
 *
 * Created: [YYYY-MM-DD]
 * Last Modified: [YYYY-MM-DD]
 *
 * Change Log:
 *-----------
 * [YYYY-MM-DD] - [Name] - [Change description]
 */
```

## 🧪 Testing Guidelines

### Test Requirements

- **Unit Tests**: Test all functions in isolation
- **Integration Tests**: Test component interactions
- **Database Tests**: Test all database operations
- **Error Scenarios**: Test error handling and edge cases

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('YourModule', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should do something', () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.test.ts

# Run tests in watch mode
npm test -- --watch
```

## 🔒 Security Considerations

- Never commit passwords, API keys, or sensitive data
- Validate all inputs properly
- Follow security best practices
- Update dependencies regularly
- Use provided security scanning tools

## 📋 Pull Request Process

### Before Submitting

1. **Ensure all tests pass**
2. **Update documentation**
3. **Add changelog entry**
4. **Check code coverage**
5. **Run security audit**
6. **Test on multiple Node.js versions**

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Testing
- [ ] All tests pass
- [ ] New tests added
- [ ] Coverage maintained

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] No breaking changes (or documented)
- [ ] Security considerations addressed

## Additional Notes
Any additional context or considerations
```

### Review Process

1. **Automated Checks**: CI/CD will run tests, linting, and security scans
2. **Code Review**: At least one maintainer must review
3. **Approvals**: Required based on change complexity
4. **Merge**: Squash and merge for clean history

## 🏷️ Release Process

### Version Management

- Follow [Semantic Versioning](https://semver.org/)
- Update `package.json` version
- Update CHANGELOG.md
- Create Git tag

### Release Checklist

1. All tests passing in CI/CD
2. Documentation updated
3. CHANGELOG.md updated
4. Security audit passed
5. Performance benchmarks met
6. Compatibility tested

## 🆘 Getting Help

- **Issues**: Use GitHub Issues for bugs and feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Security**: For security issues, email chris@cbuntingde.com privately
- **Documentation**: Check existing documentation first

## 🌟 Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- Special contributor badges (for significant contributions)

## 📜 Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to providing a welcoming and inclusive environment.

---

Thank you for contributing to the Style Guide MCP Server! Your efforts help make this project better for everyone.

## 📞 Contact

For questions about contributing:
- **GitHub Issues**: For technical questions
- **GitHub Discussions**: For general questions
- **Email**: chris@cbuntingde.com (for critical issues only)

---

**Happy coding! 🚀**