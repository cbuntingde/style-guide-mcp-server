#!/bin/bash

# Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
# All rights reserved.
#
# File: setup-github.sh
# Description: Setup script for GitHub repository creation
#
# Created: 2025-01-04
# Last Modified: 2025-01-04
#
# Change Log:
#-----------
# 2025-01-04 - Chris Bunting - Initial creation

# GitHub Repository Setup Script for Style Guide MCP Server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PRINT_SEPARATOR() {
    echo -e "${BLUE}====================================================${NC}"
}

PRINT_SUCCESS() {
    echo -e "${GREEN}✓ $1${NC}"
}

PRINT_WARNING() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

PRINT_ERROR() {
    echo -e "${RED}✗ $1${NC}"
}

PRINT_INFO() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Repository configuration
REPO_NAME="style-guide-mcp-server"
REPO_DESCRIPTION="A comprehensive Model Context Protocol (MCP) server that provides access to programming style guides, best practices, and security guidelines for multiple programming languages."
GITHUB_USERNAME="cbuntingde"

PRINT_SEPARATOR
PRINT_INFO "GitHub Repository Setup for Style Guide MCP Server"
PRINT_SEPARATOR

# Check if git is installed
if ! command -v git &> /dev/null; then
    PRINT_ERROR "Git is not installed. Please install Git first."
    exit 1
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    PRINT_WARNING "GitHub CLI (gh) is not installed."
    PRINT_INFO "Please install GitHub CLI from: https://cli.github.com/"
    PRINT_INFO "Or follow manual setup instructions below."
fi

# Check current directory
if [ ! -f "package.json" ]; then
    PRINT_ERROR "This script must be run from the project root directory."
    exit 1
fi

PRINT_SUCCESS "Project validation completed."

# Stage all files
PRINT_INFO "Staging all files..."
git add .

# Check if there are any staged changes
if git diff --staged --quiet; then
    PRINT_WARNING "No files to commit. Please check your git status."
    exit 1
fi

# Create initial commit
PRINT_INFO "Creating initial commit..."
COMMIT_MESSAGE="feat: initial release of Style Guide MCP Server

Features:
- Comprehensive style guides for 15+ programming languages
- Security guidelines with 28+ vulnerability types
- Code analysis with auto-fix capabilities
- Multi-format export (Markdown, HTML, JSON)
- SQLite database with smart caching
- Enterprise-grade security and error handling
- Complete CI/CD pipeline with GitHub Actions
- Professional documentation and examples"

git commit -m "$COMMIT_MESSAGE"
PRINT_SUCCESS "Initial commit created."

# Create GitHub repository using CLI if available
if command -v gh &> /dev/null; then
    PRINT_INFO "Creating GitHub repository using CLI..."

    # Check if user is authenticated
    if ! gh auth status &> /dev/null; then
        PRINT_ERROR "GitHub CLI is not authenticated. Please run 'gh auth login' first."
        exit 1
    fi

    # Create repository
    if gh repo create "$GITHUB_USERNAME/$REPO_NAME" \
        --description "$REPO_DESCRIPTION" \
        --public \
        --source=. \
        --push \
        --remote=origin; then
        PRINT_SUCCESS "GitHub repository created successfully!"
    else
        PRINT_WARNING "Failed to create repository with CLI. Please follow manual setup."
    fi
else
    PRINT_WARNING "GitHub CLI not found. Please follow manual setup instructions:"
    echo
    PRINT_INFO "Manual Setup Steps:"
    echo "1. Go to https://github.com/new"
    echo "2. Repository name: $REPO_NAME"
    echo "3. Description: $REPO_DESCRIPTION"
    echo "4. Choose 'Public' repository"
    echo "5. Do NOT initialize with README (we already have one)"
    echo "6. Click 'Create repository'"
    echo
    PRINT_INFO "After creating the repository, run these commands:"
    echo "git remote add origin https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
    echo "git branch -M main"
    echo "git push -u origin main"
    echo
fi

# Create GitHub labels for better issue management
PRINT_INFO "Creating GitHub labels (if CLI available)..."

if command -v gh &> /dev/null; then
    # Create custom labels
    gh label create "bug" --color "d73a4a" --description "Something isn't working" 2>/dev/null || true
    gh label create "documentation" --color "0075ca" --description "Improvements or additions to documentation" 2>/dev/null || true
    gh label create "duplicate" --color "cfd3d7" --description "This issue or pull request already exists" 2>/dev/null || true
    gh label create "enhancement" --color "a2eeef" --description "New feature or request" 2>/dev/null || true
    gh label create "good first issue" --color "7057ff" --description "Good for newcomers" 2>/dev/null || true
    gh label create "help wanted" --color "008672" --description "Extra attention is needed" 2>/dev/null || true
    gh label create "invalid" --color "e4e669" --description "This doesn't seem right" 2>/dev/null || true
    gh label create "question" --color "d876e3" --description "Further information is requested" 2>/dev/null || true
    gh label create "wontfix" --color "ffffff" --description "This will not be worked on" 2>/dev/null || true
    gh label create "security" --color "b60205" --description "Security related issues" 2>/dev/null || true

    PRINT_SUCCESS "GitHub labels created (or already exist)."
fi

# Create GitHub releases
PRINT_INFO "Creating initial release (if CLI available)..."

if command -v gh &> /dev/null; then
    # Generate release notes
    RELEASE_NOTES="# Style Guide MCP Server v1.0.0

## 🚀 Initial Release

The Style Guide MCP Server is now publicly available! This comprehensive MCP server provides access to programming style guides, best practices, and security guidelines for multiple programming languages.

## ✨ Features

- **15+ Programming Languages**: Comprehensive style guides for TypeScript, JavaScript, Python, Java, C++, Go, Rust, C#, and more
- **28+ Security Vulnerability Types**: Complete security database with CWE references
- **Code Analysis**: Pattern-based analysis with auto-fix capabilities
- **Smart Caching**: SQLite database with intelligent caching
- **Multi-format Export**: Export guidelines in Markdown, HTML, or JSON
- **Enterprise-grade Security**: Input validation, timeout protection, and comprehensive error handling
- **Professional Documentation**: Complete API documentation and examples
- **CI/CD Pipeline**: Automated testing, security scanning, and deployment

## 🛠️ Installation

\`\`\`bash
npm install style-guide-mcp-server
\`\`\`

## 📖 Documentation

- [README](https://github.com/$GITHUB_USERNAME/$REPO_NAME/blob/main/README.md)
- [API Documentation](https://github.com/$GITHUB_USERNAME/$REPO_NAME/blob/main/docs/API.md)
- [Example Usage](https://github.com/$GITHUB_USERNAME/$REPO_NAME/blob/main/example-usage.md)
- [Contributing Guidelines](https://github.com/$GITHUB_USERNAME/$REPO_NAME/blob/main/CONTRIBUTING.md)

## 🔧 Configuration

See the README for detailed configuration options including:

- Claude Desktop configuration
- Environment variables
- Security settings
- Database configuration

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](https://github.com/$GITHUB_USERNAME/$REPO_NAME/blob/main/CONTRIBUTING.md).

## 🔒 Security

For security vulnerabilities, please email security@cbuntingde.com or see our [Security Policy](https://github.com/$GITHUB_USERNAME/$REPO_NAME/blob/main/SECURITY.md).

---

Made with ❤️ by Chris Bunting"

    # Create release
    if gh release create v1.0.0 \
        --title "Initial Release v1.0.0" \
        --notes "$RELEASE_NOTES" \
        --latest; then
        PRINT_SUCCESS "Initial release v1.0.0 created!"
    else
        PRINT_WARNING "Failed to create release. You can create it manually on GitHub."
    fi
fi

# Enable GitHub features
PRINT_INFO "Suggested GitHub repository settings:"
echo
PRINT_INFO "1. Enable GitHub Pages for documentation:"
echo "   - Go to Settings > Pages"
echo "   - Source: Deploy from a branch"
echo "   - Branch: main"
echo "   - Folder: /docs"
echo
PRINT_INFO "2. Enable dependabot alerts:"
echo "   - Go to Settings > Security & analysis"
echo "   - Enable Dependabot alerts and security updates"
echo
PRINT_INFO "3. Set up branch protection:"
echo "   - Go to Settings > Branches > Add rule"
echo "   - Branch name pattern: main"
echo "   - Require status checks to pass before merging"
echo "   - Require pull request reviews before merging"
echo
PRINT_INFO "4. Enable security advisories:"
echo "   - Go to Settings > Security & analysis"
echo "   - Enable GitHub security advisories"

PRINT_SEPARATOR
PRINT_SUCCESS "🎉 GitHub repository setup completed!"
PRINT_SEPARATOR

# Next steps
PRINT_INFO "Next Steps:"
echo "1. Visit your new repository: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
echo "2. Configure repository settings as suggested above"
echo "3. Add topics/tags to improve discoverability"
echo "4. Set up GitHub Actions secrets if needed (for deployment)"
echo "5. Consider setting up GitHub Sponsors"
echo "6. Create a project board for issue management"

echo
PRINT_INFO "Repository URL: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
PRINT_INFO "Issues: https://github.com/$GITHUB_USERNAME/$REPO_NAME/issues"
PRINT_INFO "Discussions: https://github.com/$GITHUB_USERNAME/$REPO_NAME/discussions"
PRINT_INFO "Security: https://github.com/$GITHUB_USERNAME/$REPO_NAME/security"

echo
PRINT_SUCCESS "Happy coding! 🚀"
