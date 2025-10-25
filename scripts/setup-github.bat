@echo off
REM Copyright 2025 Chris Bunting <cbuntingde@gmail.com>
REM All rights reserved.
REM
REM File: setup-github.bat
REM Description: Windows batch script for GitHub repository creation
REM
REM Created: 2025-01-04
REM Last Modified: 2025-01-04
REM
REM Change Log:
REM-----------
REM 2025-01-04 - Chris Bunting - Initial creation

REM GitHub Repository Setup Script for Style Guide MCP Server (Windows)

setlocal enabledelayedexpansion

REM Repository configuration
set "REPO_NAME=style-guide-mcp-server"
set "REPO_DESCRIPTION=A comprehensive Model Context Protocol (MCP) server that provides access to programming style guides, best practices, and security guidelines for multiple programming languages."
set "GITHUB_USERNAME=cbuntingde"

echo ====================================================
echo GitHub Repository Setup for Style Guide MCP Server
echo ====================================================

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed. Please install Git first.
    pause
    exit /b 1
)

REM Check if gh CLI is installed
gh --version >nul 2>&1
if errorlevel 1 (
    echo WARNING: GitHub CLI (gh) is not installed.
    echo Please install GitHub CLI from: https://cli.github.com/
    echo Or follow manual setup instructions below.
    set "GH_AVAILABLE=0"
) else (
    set "GH_AVAILABLE=1"
)

REM Check current directory
if not exist "package.json" (
    echo ERROR: This script must be run from the project root directory.
    pause
    exit /b 1
)

echo SUCCESS: Project validation completed.

REM Stage all files
echo INFO: Staging all files...
git add .

REM Check if there are any staged changes
git diff --staged --quiet >nul 2>&1
if errorlevel 1 (
    REM Files are staged, continue
) else (
    echo WARNING: No files to commit. Please check your git status.
    pause
    exit /b 1
)

REM Create initial commit
echo INFO: Creating initial commit...
git commit -m "feat: initial release of Style Guide MCP Server

Features:
- Comprehensive style guides for 15+ programming languages
- Security guidelines with 28+ vulnerability types
- Code analysis with auto-fix capabilities
- Multi-format export (Markdown, HTML, JSON)
- SQLite database with smart caching
- Enterprise-grade security and error handling
- Complete CI/CD pipeline with GitHub Actions
- Professional documentation and examples"

if errorlevel 1 (
    echo ERROR: Failed to create commit. Please check git status.
    pause
    exit /b 1
)

echo SUCCESS: Initial commit created.

REM Create GitHub repository using CLI if available
if "%GH_AVAILABLE%"=="1" (
    echo INFO: Creating GitHub repository using CLI...

    REM Check if user is authenticated
    gh auth status >nul 2>&1
    if errorlevel 1 (
        echo ERROR: GitHub CLI is not authenticated. Please run 'gh auth login' first.
        pause
        exit /b 1
    )

    REM Create repository
    gh repo create "%GITHUB_USERNAME%/%REPO_NAME%" --description "%REPO_DESCRIPTION%" --public --source=. --push --remote=origin
    if errorlevel 1 (
        echo WARNING: Failed to create repository with CLI. Please follow manual setup.
    ) else (
        echo SUCCESS: GitHub repository created successfully!
    )
) else (
    echo WARNING: GitHub CLI not found. Please follow manual setup instructions:
    echo.
    echo Manual Setup Steps:
    echo 1. Go to https://github.com/new
    echo 2. Repository name: %REPO_NAME%
    echo 3. Description: %REPO_DESCRIPTION%
    echo 4. Choose 'Public' repository
    echo 5. Do NOT initialize with README (we already have one)
    echo 6. Click 'Create repository'
    echo.
    echo After creating the repository, run these commands:
    echo git remote add origin https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
    echo git branch -M main
    echo git push -u origin main
    echo.
)

REM Create GitHub labels for better issue management
if "%GH_AVAILABLE%"=="1" (
    echo INFO: Creating GitHub labels...

    REM Create custom labels (ignore errors if they already exist)
    gh label create "bug" --color "d73a4a" --description "Something isn't working" >nul 2>&1
    gh label create "documentation" --color "0075ca" --description "Improvements or additions to documentation" >nul 2>&1
    gh label create "duplicate" --color "cfd3d7" --description "This issue or pull request already exists" >nul 2>&1
    gh label create "enhancement" --color "a2eeef" --description "New feature or request" >nul 2>&1
    gh label create "good first issue" --color "7057ff" --description "Good for newcomers" >nul 2>&1
    gh label create "help wanted" --color "008672" --description "Extra attention is needed" >nul 2>&1
    gh label create "invalid" --color "e4e669" --description "This doesn't seem right" >nul 2>&1
    gh label create "question" --color "d876e3" --description "Further information is requested" >nul 2>&1
    gh label create "wontfix" --color "ffffff" --description "This will not be worked on" >nul 2>&1
    gh label create "security" --color "b60205" --description "Security related issues" >nul 2>&1

    echo SUCCESS: GitHub labels created (or already exist).
)

REM Create GitHub releases
if "%GH_AVAILABLE%"=="1" (
    echo INFO: Creating initial release...

    REM Create a temporary release notes file
    echo # Style Guide MCP Server v1.0.0 > release_notes.md
    echo. >> release_notes.md
    echo ## 🚀 Initial Release >> release_notes.md
    echo. >> release_notes.md
    echo The Style Guide MCP Server is now publicly available! This comprehensive MCP server provides access to programming style guides, best practices, and security guidelines for multiple programming languages. >> release_notes.md
    echo. >> release_notes.md
    echo ## ✨ Features >> release_notes.md
    echo. >> release_notes.md
    echo - **15+ Programming Languages**: Comprehensive style guides for TypeScript, JavaScript, Python, Java, C++, Go, Rust, C#, and more >> release_notes.md
    echo - **28+ Security Vulnerability Types**: Complete security database with CWE references >> release_notes.md
    echo - **Code Analysis**: Pattern-based analysis with auto-fix capabilities >> release_notes.md
    echo - **Smart Caching**: SQLite database with intelligent caching >> release_notes.md
    echo - **Multi-format Export**: Export guidelines in Markdown, HTML, or JSON >> release_notes.md
    echo - **Enterprise-grade Security**: Input validation, timeout protection, and comprehensive error handling >> release_notes.md
    echo - **Professional Documentation**: Complete API documentation and examples >> release_notes.md
    echo - **CI/CD Pipeline**: Automated testing, security scanning, and deployment >> release_notes.md
    echo. >> release_notes.md
    echo ## 🛠️ Installation >> release_notes.md
    echo. >> release_notes.md
    echo ```bash >> release_notes.md
    echo npm install style-guide-mcp-server >> release_notes.md
    echo ``` >> release_notes.md
    echo. >> release_notes.md
    echo ## 📖 Documentation >> release_notes.md
    echo. >> release_notes.md
    echo - [README](https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/blob/main/README.md) >> release_notes.md
    echo - [API Documentation](https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/blob/main/docs/API.md) >> release_notes.md
    echo - [Example Usage](https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/blob/main/example-usage.md) >> release_notes.md
    echo - [Contributing Guidelines](https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/blob/main/CONTRIBUTING.md) >> release_notes.md
    echo. >> release_notes.md
    echo ## 🔧 Configuration >> release_notes.md
    echo. >> release_notes.md
    echo See the README for detailed configuration options including: >> release_notes.md
    echo. >> release_notes.md
    echo - Claude Desktop configuration >> release_notes.md
    echo - Environment variables >> release_notes.md
    echo - Security settings >> release_notes.md
    echo - Database configuration >> release_notes.md
    echo. >> release_notes.md
    echo ## 🤝 Contributing >> release_notes.md
    echo. >> release_notes.md
    echo We welcome contributions! Please see our [Contributing Guidelines](https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/blob/main/CONTRIBUTING.md). >> release_notes.md
    echo. >> release_notes.md
    echo ## 🔒 Security >> release_notes.md
    echo. >> release_notes.md
    echo For security vulnerabilities, please email security@cbuntingde.com or see our [Security Policy](https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/blob/main/SECURITY.md). >> release_notes.md
    echo. >> release_notes.md
    echo --- >> release_notes.md
    echo. >> release_notes.md
    echo Made with ❤️ by Chris Bunting >> release_notes.md

    REM Create release
    gh release create v1.0.0 --title "Initial Release v1.0.0" --notes-file release_notes.md --latest >nul 2>&1
    if errorlevel 1 (
        echo WARNING: Failed to create release. You can create it manually on GitHub.
    ) else (
        echo SUCCESS: Initial release v1.0.0 created!
    )

    REM Clean up temporary file
    del release_notes.md >nul 2>&1
)

echo ====================================================
echo 🎉 GitHub repository setup completed!
echo ====================================================
echo.
echo INFO: Next Steps:
echo 1. Visit your new repository: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%
echo 2. Configure repository settings as suggested below
echo 3. Add topics/tags to improve discoverability
echo 4. Set up GitHub Actions secrets if needed (for deployment)
echo 5. Consider setting up GitHub Sponsors
echo 6. Create a project board for issue management
echo.
echo INFO: Suggested GitHub repository settings:
echo.
echo 1. Enable GitHub Pages for documentation:
echo    - Go to Settings ^> Pages
echo    - Source: Deploy from a branch
echo    - Branch: main
echo    - Folder: /docs
echo.
echo 2. Enable dependabot alerts:
echo    - Go to Settings ^> Security ^& analysis
echo    - Enable Dependabot alerts and security updates
echo.
echo 3. Set up branch protection:
echo    - Go to Settings ^> Branches ^> Add rule
echo    - Branch name pattern: main
echo    - Require status checks to pass before merging
echo    - Require pull request reviews before merging
echo.
echo 4. Enable security advisories:
echo    - Go to Settings ^> Security ^& analysis
echo    - Enable GitHub security advisories
echo.
echo Repository URL: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%
echo Issues: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/issues
echo Discussions: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/discussions
echo Security: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/security
echo.
echo SUCCESS: Happy coding! 🚀
echo.
pause
