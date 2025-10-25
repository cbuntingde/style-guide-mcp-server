# Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
# All rights reserved.
#
# File: SECURITY.md
# Description: Security policy for Style Guide MCP Server
#
# Created: 2025-01-04
# Last Modified: 2025-01-04
#
# Change Log:
#-----------
# 2025-01-04 - Chris Bunting - Initial creation

# Security Policy

This document outlines the security practices and reporting procedures for the Style Guide MCP Server project.

## 🛡️ Security Commitment

We take security seriously and are committed to maintaining a secure and reliable MCP server. This includes:

- **Regular security audits** of dependencies and code
- **Vulnerability scanning** in CI/CD pipelines
- **Secure coding practices** throughout development
- **Timely response** to security reports
- **Transparent disclosure** of security issues

## 🔐 Supported Versions

| Version | Security Support | End of Life |
|---------|------------------|-------------|
| 1.0.x | ✅ Supported | TBD |
| 0.x | ⚠️ Limited support | 2025-06-30 |

## 🚨 Reporting Vulnerabilities

### How to Report

**Do NOT** open a public issue for security vulnerabilities. Instead, report them privately:

**Primary Contact:**
- **Email**: security@cbuntingde.com
- **PGP Key**: Available on request
- **Response Time**: Within 48 hours

**Alternative Contacts:**
- **GitHub Private Advisory**: Use GitHub's private vulnerability reporting
- **Direct Message**: @cbuntingde on GitHub (for urgent matters)

### What to Include

Please provide as much information as possible:

1. **Vulnerability Type** (e.g., SQL Injection, XSS, etc.)
2. **Affected Versions**
3. **Steps to Reproduce**
4. **Impact Assessment**
5. **Proof of Concept** (if applicable)
6. **Environmental Details** (OS, Node.js version, etc.)

### Responsible Disclosure Process

1. **Receipt & Acknowledgment** (within 48 hours)
2. **Initial Assessment** (within 5 business days)
3. **Investigation & Validation** (within 14 days)
4. **Patch Development** (based on severity)
5. **Coordinated Disclosure** (with reporter)
6. **Public Disclosure** (after patch is available)

### Timeline

- **Critical**: 90 days max disclosure period
- **High**: 120 days max disclosure period
- **Medium**: 180 days max disclosure period  
- **Low**: 180 days max disclosure period

## 🎯 Security Features

### Built-in Protections

- **Input Validation**: Comprehensive validation and sanitization
- **SQL Injection Protection**: Parameterized queries
- **XSS Prevention**: Output encoding and CSP headers
- **CSRF Protection**: Token-based protection
- **Rate Limiting**: Configurable rate limits
- **Timeout Protection**: Network request timeouts
- **Secure Headers**: Security headers for HTTP responses
- **Content Security Policy**: CSP headers for web interfaces

### Data Protection

```typescript
// Example security configurations
const securityConfig = {
  // Input validation
  maxInputLength: 10000,
  allowedChars: /^[a-zA-Z0-9\s\-_.,!?@#%&*()+=\[\]{}|\\;:'"<>/]+$/,
  
  // Rate limiting
  rateLimitWindowMs: 60000,
  rateLimitMaxRequests: 100,
  
  // Timeouts
  networkTimeout: 30000,
  queryTimeout: 10000,
  
  // Encryption
  databaseEncryption: false,
  encryptionAlgorithm: 'aes-256-gcm'
};
```

### Database Security

- **SQL Injection Protection**: All queries use parameter binding
- **Database Encryption**: Optional at-rest encryption
- **Access Control**: Principle of least privilege
- **Audit Logging**: All database operations logged
- **Backup Encryption**: Encrypted backups

### Network Security

- **HTTPS Only**: Production servers use HTTPS
- **Certificate Validation**: Proper certificate verification
- **Timeout Protection**: Configurable timeouts for all requests
- **User-Agent Headers**: Custom user-agent for requests
- **Proxy Support**: Secure proxy configuration

## 🔍 Security Assessments

### Automated Security Checks

Our CI/CD pipeline includes:

- **Snyk**: Dependency vulnerability scanning
- **npm audit**: Node.js package security audit
- **SonarQube**: Static code analysis
- **Bandit/Semgrep**: Security-focused static analysis
- **OWASP ZAP**: Dynamic application security testing

### Manual Security Reviews

- **Code Reviews**: Security-focused code reviews
- **Architecture Reviews**: Security architecture assessment
- **Penetration Testing**: Regular security testing
- **Threat Modeling**: Regular threat modeling exercises

## 📊 Vulnerability Classification

### Severity Levels

| Severity | Definition | Response Time |
|----------|------------|---------------|
| Critical | Immediate risk to data/system | 24 hours |
| High | Significant impact | 72 hours |
| Medium | Limited impact | 7 days |
| Low | Minimal impact | 30 days |

### Common Vulnerability Types

We pay special attention to:

- **OWASP Top 10**: All OWASP vulnerabilities
- **CWE-20**: Input Validation
- **CWE-79**: XSS
- **CWE-89**: SQL Injection
- **CWE-352**: CSRF
- **CWE-22**: Path Traversal
- **CWE-78**: OS Command Injection
- **CWE-200**: Information Exposure
- **CWE-400**: Resource Exhaustion

## 🛠️ Security Best Practices

### For Developers

1. **Input Validation**: Always validate user input
2. **Output Encoding**: Encode all outputs
3. **Error Handling**: Don't leak sensitive information
4. **Logging**: Log security events appropriately
5. **Dependencies**: Keep dependencies updated
6. **Reviews**: Security-focused code reviews

### For Deployments

1. **Environment Variables**: Sensitive data in env vars
2. **File Permissions**: Restrict file access
3. **Network Access**: Limit network exposure
4. **HTTPS**: Enforce HTTPS in production
5. **Monitoring**: Implement security monitoring
6. **Backups**: Secure, encrypted backups

### Code Example

```typescript
// Secure input validation
import validator from 'validator';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateInput(input: string, options: {
  maxLength?: number;
  allowHTML?: boolean;
  pattern?: RegExp;
}): ValidationResult {
  const errors: string[] = [];
  
  if (!input || typeof input !== 'string') {
    return { isValid: false, errors: ['Input is required'] };
  }
  
  if (options.maxLength && input.length > options.maxLength) {
    errors.push(`Input exceeds maximum length of ${options.maxLength}`);
  }
  
  if (!options.allowHTML && validator.contains(input, '<')) {
    errors.push('HTML content not allowed');
  }
  
  if (options.pattern && !options.pattern.test(input)) {
    errors.push('Input does not match required pattern');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

## 🚨 Incident Response

### Incident Categories

1. **Data Breach**: Unauthorized access to sensitive data
2. **Service Disruption**: Security-related service downtime
3. **Vulnerability**: New security vulnerability discovered
4. **Compromise**: System compromise or intrusion

### Response Team

- **Security Lead**: Coordinates response
- **Engineering Lead**: Technical implementation of fixes
- **Communications Lead**: External communications
- **Legal**: Legal compliance and requirements

### Response Process

1. **Detection**: Automated or manual detection
2. **Assessment**: Determine impact and affected systems
3. **Containment**: Immediate containment actions
4. **Eradication**: Remove threat from systems
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Post-incident analysis

## 📋 Security Checklist

### Before Deployment

- [ ] All dependencies audited
- [ ] Security tests passing
- [ ] Environment variables configured
- [ ] SSL/TLS certificates valid
- [ ] Access controls implemented
- [ ] Logging and monitoring enabled
- [ ] Security headers configured
- [ ] Rate limiting enabled

### Code Review Security Checklist

- [ ] Input validation implemented
- [ ] Output encoding used
- [ ] SQL queries parameterized
- [ ] Error messages sanitized
- [ ] Authentication/authorization checked
- [ ] Logging appropriate (no sensitive data)
- [ ] Dependencies secure and up-to-date
- [ ] No hardcoded secrets or credentials

## 🌐 External Security Resources

### Security Standards

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Mitre](https://cwe.mitre.org/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001](https://www.iso.org/isoiec-27001-information-security.html)

### Security Tools

- [Snyk](https://snyk.io/) - Dependency scanning
- [OWASP ZAP](https://www.zaproxy.org/) - Web app security testing
- [SonarQube](https://www.sonarqube.org/) - Code quality and security
- [Semgrep](https://semgrep.dev/) - Static analysis

### Learning Resources

- [OWASP Cheatsheets](https://cheatsheetseries.owasp.org/)
- [Node.js Security Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [TypeScript Security Guidelines](https://typescript-eslint.io/rules/)

## 📞 Contact

For security-related matters:

- **Security Issues**: security@cbuntingde.com
- **General Questions**: Use GitHub Discussions
- **Critical Vulnerabilities**: Direct message @cbuntingde

## 📄 Acknowledgments

We thank all security researchers who help us maintain secure software. Contributors to our security efforts are recognized in our Hall of Fame.

---

**Last Updated**: January 4, 2025  
**Next Review**: April 4, 2025  
**Version**: 1.0.0