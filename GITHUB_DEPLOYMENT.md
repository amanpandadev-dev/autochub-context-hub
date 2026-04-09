# GitHub Deployment Guide for Auto-CHUB

## Overview

This guide covers deploying Auto-CHUB (with Memgraph integration and CLI) to GitHub.

## 📋 Pre-Deployment Checklist

- [ ] GitHub account created
- [ ] Repository created
- [ ] Git installed locally
- [ ] All code committed
- [ ] Tests passing
- [ ] Documentation complete

## 🚀 Step 1: Create GitHub Repository

### Option A: Using GitHub Web UI

1. Go to [github.com/new](https://github.com/new)
2. Fill in repository details:
   - **Repository name**: `autochub-context-hub`
   - **Description**: `Context-first coding assistant with Memgraph analysis and CLI`
   - **Visibility**: Public (for open source) or Private
   - **Initialize with**: None (we'll push existing code)
3. Click "Create repository"

### Option B: Using GitHub CLI

```bash
gh repo create autochub-context-hub \
  --description "Context-first coding assistant with Memgraph analysis and CLI" \
  --public \
  --source=. \
  --remote=origin \
  --push
```

## 🔧 Step 2: Initialize Git Locally

```bash
# Navigate to project directory
cd /path/to/autochub-context-hub

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Memgraph integration and CLI tool"

# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/autochub-context-hub.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

## 📁 Step 3: Repository Structure

Ensure your repository has this structure:

```
autochub-context-hub/
├── .github/
│   ├── workflows/
│   │   ├── test.yml
│   │   ├── build.yml
│   │   └── deploy.yml
│   └── ISSUE_TEMPLATE/
│       └── bug_report.md
├── src/
│   ├── cli/
│   │   ├── index.ts
│   │   └── commands/
│   ├── lib/
│   │   └── memgraph/
│   └── App.tsx
├── scripts/
│   └── setup-memgraph.js
├── examples/
│   └── memgraph-example.ts
├── .gitignore
├── .env.example
├── package.json
├── tsconfig.json
├── README.md
├── DEPLOYMENT.md
└── LICENSE
```

## 📝 Step 4: Create Essential Files

### .gitignore

```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json
yarn.lock

# Build outputs
dist/
out/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# Memgraph
.backup-*
memgraph_data/

# Temporary
tmp/
temp/
EOF
```

### .env.example

```bash
cat > .env.example << 'EOF'
# OpenRouter Configuration
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_MODEL=openrouter/auto

# Memgraph Configuration
MEMGRAPH_HOST=localhost
MEMGRAPH_PORT=7687
MEMGRAPH_USERNAME=memgraph
MEMGRAPH_PASSWORD=memgraph

# Application
NODE_ENV=development
PORT=3000
EOF
```

### LICENSE

```bash
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2024 Auto-CHUB Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
EOF
```

## 📖 Step 5: Create/Update README.md

```bash
cat > README.md << 'EOF'
# Auto-CHUB Context Hub

Context-first coding assistant with Memgraph analysis and CLI tool for detecting and fixing deprecated API calls.

## Features

- 🔍 **Deep Code Analysis** - Memgraph-powered dependency mapping
- 🛠️ **Automatic Fixes** - Apply fixes with dry-run and backup support
- 📊 **Comprehensive Reports** - HTML, JSON, Markdown, CSV formats
- 💻 **CLI Tool** - Command-line interface for automation
- 🚀 **CI/CD Ready** - GitHub Actions integration
- 📚 **Well Documented** - Complete guides and examples

## Quick Start

### Installation

```bash
npm run setup
```

### Usage

```bash
# Analyze with Memgraph
autochub analyze src/ --with-graph

# Fix with preview
autochub fix src/ --dry-run

# Generate report
autochub report src/ --format html --output report.html
```

## Documentation

- [Setup Guide](SETUP_GUIDE.md) - Installation and configuration
- [CLI Guide](CLI_GUIDE.md) - Command-line interface reference
- [Memgraph Guide](MEMGRAPH_IMPLEMENTATION.md) - Deep analysis guide
- [Complete Implementation](COMPLETE_IMPLEMENTATION.md) - Full overview

## Requirements

- Node.js 16+
- Docker (for Memgraph)
- npm or yarn

## Installation

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/autochub-context-hub.git
cd autochub-context-hub

# Setup
npm run setup

# Try example
npx ts-node examples/memgraph-example.ts
```

## Commands

### Analyze
```bash
autochub analyze [path] --with-graph
```

### Fix
```bash
autochub fix [path] --dry-run --backup
```

### Report
```bash
autochub report [path] --format html --output report.html
```

### Config
```bash
autochub config list
autochub config set memgraph.host localhost
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build extension
npm run build:extension

# Run tests
npm test

# Lint
npm run lint
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](./docs)
- 🐛 [Report Issues](https://github.com/YOUR_USERNAME/autochub-context-hub/issues)
- 💬 [Discussions](https://github.com/YOUR_USERNAME/autochub-context-hub/discussions)

## Acknowledgments

- [Memgraph](https://memgraph.com) - Graph database
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [OpenRouter](https://openrouter.ai) - LLM API
EOF
```

## 🔄 Step 6: GitHub Actions Workflows

### .github/workflows/test.yml

```bash
mkdir -p .github/workflows

cat > .github/workflows/test.yml << 'EOF'
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]

    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm install
    
    - name: Run linter
      run: npm run lint
    
    - name: Build
      run: npm run build
    
    - name: Build extension
      run: npm run build:extension
EOF
```

### .github/workflows/build.yml

```bash
cat > .github/workflows/build.yml << 'EOF'
name: Build

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm install
    
    - name: Build
      run: npm run build
    
    - name: Build extension
      run: npm run build:extension
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: build-artifacts
        path: |
          dist/
          out/
EOF
```

### .github/workflows/deploy.yml

```bash
cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm install
    
    - name: Build
      run: npm run build
    
    - name: Build extension
      run: npm run build:extension
    
    - name: Create Release
      if: startsWith(github.ref, 'refs/tags/')
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref }}
        release_name: Release ${{ github.ref }}
        draft: false
        prerelease: false
    
    - name: Upload to npm
      if: startsWith(github.ref, 'refs/tags/')
      run: |
        npm config set //registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}
        npm publish
EOF
```

## 📦 Step 7: Publish to npm (Optional)

### Update package.json

```json
{
  "name": "@autochub/context-hub",
  "version": "1.0.0",
  "description": "Context-first coding assistant with Memgraph analysis",
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/autochub-context-hub.git"
  },
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/autochub-context-hub/issues"
  },
  "homepage": "https://github.com/YOUR_USERNAME/autochub-context-hub#readme",
  "keywords": [
    "deprecated-api",
    "code-analysis",
    "memgraph",
    "cli",
    "refactoring"
  ],
  "bin": {
    "autochub": "./dist/cli/index.js"
  }
}
```

### Create .npmrc

```bash
cat > .npmrc << 'EOF'
registry=https://registry.npmjs.org/
@autochub:registry=https://registry.npmjs.org/
EOF
```

### Publish

```bash
# Login to npm
npm login

# Publish
npm publish

# Or with GitHub Actions (add NPM_TOKEN secret)
```

## 🔐 Step 8: GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to Settings → Secrets and variables → Actions
2. Add secrets:

```
NPM_TOKEN=your_npm_token
GITHUB_TOKEN=automatically_provided
```

## 📋 Step 9: GitHub Issues & Discussions

### Create Issue Templates

```bash
mkdir -p .github/ISSUE_TEMPLATE

cat > .github/ISSUE_TEMPLATE/bug_report.md << 'EOF'
---
name: Bug report
about: Create a report to help us improve
---

**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Run command...
2. See error...

**Expected behavior**
What you expected to happen.

**Environment**
- OS: [e.g. macOS, Linux, Windows]
- Node version: [e.g. 18.0.0]
- npm version: [e.g. 8.0.0]

**Additional context**
Add any other context about the problem here.
EOF

cat > .github/ISSUE_TEMPLATE/feature_request.md << 'EOF'
---
name: Feature request
about: Suggest an idea for this project
---

**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
A clear description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
EOF
```

## 🚀 Step 10: Push to GitHub

```bash
# Add all files
git add .

# Commit
git commit -m "Add GitHub deployment configuration"

# Push
git push origin main
```

## 📊 Step 11: GitHub Pages (Optional)

### Enable GitHub Pages

1. Go to Settings → Pages
2. Select "Deploy from a branch"
3. Select "main" branch and "/docs" folder
4. Save

### Create docs/index.md

```bash
mkdir -p docs

cat > docs/index.md << 'EOF'
# Auto-CHUB Documentation

## Getting Started

- [Setup Guide](../SETUP_GUIDE.md)
- [CLI Guide](../CLI_GUIDE.md)
- [Memgraph Guide](../MEMGRAPH_IMPLEMENTATION.md)

## Commands

### Analyze
```bash
autochub analyze src/ --with-graph
```

### Fix
```bash
autochub fix src/ --dry-run --backup
```

### Report
```bash
autochub report src/ --format html --output report.html
```

## Support

- [Issues](https://github.com/YOUR_USERNAME/autochub-context-hub/issues)
- [Discussions](https://github.com/YOUR_USERNAME/autochub-context-hub/discussions)
EOF
```

## 📈 Step 12: Repository Settings

### Branch Protection

1. Go to Settings → Branches
2. Add rule for "main" branch:
   - Require pull request reviews
   - Require status checks to pass
   - Require branches to be up to date

### Code Security

1. Go to Settings → Code security and analysis
2. Enable:
   - Dependabot alerts
   - Dependabot security updates
   - Secret scanning

## 🔄 Step 13: Continuous Integration

### Pre-commit Hooks (Optional)

```bash
npm install -D husky lint-staged

npx husky install

cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
EOF

cat > .lintstagedrc.json << 'EOF'
{
  "*.ts": ["npm run lint", "npm run build:extension"],
  "*.tsx": ["npm run lint"],
  "*.json": ["prettier --write"]
}
EOF
```

## 📝 Step 14: Release Process

### Create Release

```bash
# Tag version
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push tag
git push origin v1.0.0

# GitHub Actions will automatically:
# 1. Build the project
# 2. Create a release
# 3. Publish to npm
```

## ✅ Deployment Checklist

- [ ] Repository created on GitHub
- [ ] Code pushed to main branch
- [ ] .gitignore configured
- [ ] .env.example created
- [ ] README.md updated
- [ ] LICENSE added
- [ ] GitHub Actions workflows created
- [ ] Branch protection enabled
- [ ] Code security enabled
- [ ] npm secrets configured (if publishing)
- [ ] GitHub Pages enabled (optional)
- [ ] First release tagged

## 🎯 Summary

Your Auto-CHUB repository is now:

✅ **On GitHub** - Publicly available  
✅ **Automated** - CI/CD pipelines running  
✅ **Documented** - Complete guides included  
✅ **Secure** - Branch protection enabled  
✅ **Publishable** - Ready for npm (optional)  
✅ **Maintainable** - Issue templates and discussions  

## 📚 Additional Resources

- [GitHub Docs](https://docs.github.com)
- [GitHub Actions](https://github.com/features/actions)
- [npm Publishing](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org)

