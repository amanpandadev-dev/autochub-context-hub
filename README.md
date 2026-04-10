# 🎯 Auto-CHUB - Context-First Coding Assistant

A powerful CLI tool for detecting and fixing deprecated API calls in your codebase using Memgraph analysis.

[![GitHub](https://img.shields.io/badge/GitHub-amanpandadev--dev%2Fautochub--context--hub-blue)](https://github.com/amanpandadev-dev/autochub-context-hub)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-16%2B-brightgreen)](https://nodejs.org)

---

## 🚀 Quick Start

### Installation
```bash
npm install -g autochub-context-hub
```

### Basic Usage
```bash
# Analyze your project
autochub analyze src/

# Generate report
autochub report src/ --format html --output report.html

# Fix deprecated APIs
autochub fix src/ --dry-run
autochub fix src/ --backup
```

---

## ✨ Features

✅ **Detect Deprecated APIs** - Find all deprecated API calls in your codebase  
✅ **Deep Analysis** - Use Memgraph for impact analysis and risk scoring  
✅ **Automatic Fixes** - Apply fixes automatically with backup support  
✅ **Multiple Reports** - Generate HTML, JSON, Markdown, or CSV reports  
✅ **CI/CD Ready** - Integrate with GitHub Actions and other CI systems  
✅ **Type-Safe** - Full TypeScript implementation  
✅ **Configurable** - Customize analysis and output  

---

## 📋 Commands

### 1. Analyze
Find deprecated APIs in your codebase.

```bash
autochub analyze [path] [options]

Options:
  --with-graph              Use Memgraph for deep analysis
  --lang <language>         Filter by language (js, ts, py, go, java, cs)
  --output <format>         Output format (json, html, markdown)
  --severity <level>        Filter by severity (critical, warning, info)
  --exclude <patterns>      Exclude file patterns
  --max-results <number>    Limit results
  --github-links            Include GitHub documentation links
```

**Examples:**
```bash
autochub analyze src/
autochub analyze src/ --with-graph
autochub analyze src/ --severity critical
autochub analyze src/ --output json
```

### 2. Fix
Apply fixes to deprecated APIs.

```bash
autochub fix [path] [options]

Options:
  --dry-run                 Preview changes without applying
  --auto-approve            Apply all fixes without confirmation
  --use-llm                 Use LLM for intelligent migrations
  --backup                  Create backup before fixing
  --severity <level>        Only fix issues of this severity
```

**Examples:**
```bash
autochub fix src/ --dry-run
autochub fix src/ --backup
autochub fix src/ --auto-approve
```

### 3. Report
Generate comprehensive deprecation reports.

```bash
autochub report [path] [options]

Options:
  --format <format>         Output format (html, json, markdown, csv)
  --include-timeline        Show deprecation timeline
  --include-metrics         Show migration metrics
  --output <file>           Save to file
```

**Examples:**
```bash
autochub report src/ --format html --output report.html
autochub report src/ --format json
autochub report src/ --format csv --output report.csv
```

### 4. Config
Manage CLI configuration.

```bash
autochub config [action] [key] [value]

Actions:
  get <key>                 Get configuration value
  set <key> <value>         Set configuration value
  list                      List all settings
  reset                     Reset to defaults
```

**Examples:**
```bash
autochub config list
autochub config get memgraph.host
autochub config set memgraph.port 7687
```

---

## 📚 Documentation

### Getting Started
- **[START_HERE_FINAL.md](START_HERE_FINAL.md)** - Quick start guide (5 min read)
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - One-page quick reference
- **[COMMAND_INSTRUCTIONS.md](COMMAND_INSTRUCTIONS.md)** - Complete command guide

### Configuration
- **[GITHUB_CONFIGURATION_DETAILED.md](GITHUB_CONFIGURATION_DETAILED.md)** - GitHub setup guide
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Installation and setup

### Usage
- **[CLI_GUIDE.md](CLI_GUIDE.md)** - Detailed CLI reference
- **[MEMGRAPH_IMPLEMENTATION.md](MEMGRAPH_IMPLEMENTATION.md)** - Memgraph integration guide

### Reference
- **[STATUS_REPORT.md](STATUS_REPORT.md)** - Project status
- **[COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md)** - Project completion summary
- **[FINAL_SUMMARY.md](FINAL_SUMMARY.md)** - Project overview

---

## 🔄 Workflow Examples

### Quick Analysis (5 minutes)
```bash
autochub analyze src/
```

### Deep Analysis (15 minutes)
```bash
npm run setup
autochub analyze src/ --with-graph
```

### Generate Report (10 minutes)
```bash
autochub report src/ --format html --output report.html
open report.html
```

### Fix Issues (20 minutes)
```bash
autochub fix src/ --dry-run
autochub fix src/ --backup
git diff
git commit -m "fix: Update deprecated APIs"
```

### CI/CD Integration
```bash
autochub analyze src/ --with-graph --output json > analysis.json
if grep -q '"riskScore": [7-9][0-9]' analysis.json; then
  echo "Critical deprecations found!"
  exit 1
fi
```

---

## 🛠️ Installation Options

### Option 1: Global Installation
```bash
npm install -g autochub-context-hub
autochub analyze src/
```

### Option 2: Local Installation
```bash
npm install autochub-context-hub
npx autochub analyze src/
```

### Option 3: From Repository
```bash
git clone https://github.com/amanpandadev-dev/autochub-context-hub.git
cd autochub-context-hub
npm install
npm run setup
npm install -g .
autochub analyze src/
```

---

## 🔧 Configuration

### Configuration File
Create `.autochubrc.json` in your project root:

```json
{
  "memgraph": {
    "host": "localhost",
    "port": 7687,
    "username": "memgraph",
    "password": "memgraph"
  },
  "analysis": {
    "excludeDirs": ["node_modules", ".git", "dist", "build"],
    "extensions": [".ts", ".tsx", ".js", ".jsx"]
  },
  "output": {
    "format": "html",
    "directory": "./reports"
  }
}
```

### Using Config Commands
```bash
autochub config list
autochub config get memgraph.host
autochub config set memgraph.port 7687
autochub config reset
```

---

## 📊 Output Examples

### Analyze Output
```
📊 Auto-CHUB Analyzer

📁 Analyzing: /path/to/project

🔗 Initializing Memgraph...
✓ Memgraph connected

📁 Indexing project...
✓ Project indexed

🔍 Analyzing with Memgraph...

📋 Deprecated APIs Found:

1. ChatCompletion.create
   🔴 Risk Score: 75%
   📊 Usages: 12 | Files: 5
   ⏱️  Effort: Medium
   ✨ Replacement: client.chat.completions.create

2. ReactDOM.render
   🟡 Risk Score: 45%
   📊 Usages: 8 | Files: 3
   ⏱️  Effort: Medium
   ✨ Replacement: createRoot().render

📊 Summary:
   Total Files: 150
   Total Deprecations: 20
   Files with Issues: 8
```

### Report Formats
- **HTML** - Interactive, browser-friendly
- **JSON** - Machine-readable
- **Markdown** - Documentation-friendly
- **CSV** - Excel/Sheets-compatible

---

## 🚀 Advanced Usage

### Combine with Other Tools
```bash
# Pipe to jq for JSON processing
autochub analyze src/ --output json | jq '.[] | select(.riskScore > 70)'

# Generate report and open
autochub report src/ --format html --output report.html && open report.html

# Save analysis with timestamp
autochub analyze src/ --output json > analysis-$(date +%Y%m%d).json
```

### Automate with Scripts
```bash
#!/bin/bash
autochub analyze src/ --with-graph --output json > analysis.json
autochub report src/ --format html --output report.html
echo "Analysis complete!"
```

### CI/CD Integration
```yaml
# GitHub Actions
- name: Analyze with Auto-CHUB
  run: |
    npm run setup
    autochub analyze src/ --with-graph --output json > analysis.json
    
- name: Check for critical issues
  run: |
    if grep -q '"riskScore": [7-9][0-9]' analysis.json; then
      exit 1
    fi
```

---

## 🆘 Troubleshooting

### Command not found
```bash
npm install -g .
# or
npx autochub analyze src/
```

### Memgraph connection failed
```bash
npm run setup
# or
docker run -d -p 7687:7687 memgraph/memgraph
```

### Permission denied
```bash
chmod +x src/cli/index.ts
# or
npx autochub analyze src/
```

---

## 📦 What's Included

### Core Implementation
- ✅ Memgraph integration (10 files)
- ✅ CLI tool (5 files)
- ✅ VS Code extension
- ✅ React UI
- ✅ Express server

### Configuration
- ✅ GitHub Actions workflows (2)
- ✅ Issue templates (2)
- ✅ .gitignore
- ✅ .env.example
- ✅ LICENSE

### Documentation
- ✅ 30+ comprehensive guides
- ✅ Command reference
- ✅ Setup guides
- ✅ Configuration guides
- ✅ Quick references

---

## 🎯 Key Features

### Memgraph Integration
✅ Deep code analysis  
✅ Dependency mapping  
✅ Impact analysis  
✅ Risk scoring  
✅ Refactoring guidance  
✅ Docker support  

### CLI Tool
✅ Analyze command  
✅ Fix command  
✅ Report command  
✅ Config command  
✅ Multiple output formats  
✅ Dry-run mode  
✅ Backup support  

### GitHub Actions
✅ Automated testing  
✅ Automated building  
✅ Artifact upload  
✅ Multiple Node versions  

### Security
✅ Branch protection  
✅ Code scanning  
✅ Secret scanning  
✅ Dependabot alerts  

---

## 📊 Project Statistics

| Metric | Value |
|--------|-------|
| Total Files | 95 |
| Lines of Code | ~1500 |
| Documentation | 30+ files |
| Dependencies | 2 (memgraph, commander) |
| GitHub Actions | 2 workflows |
| Issue Templates | 2 |

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

## 📞 Support

- **Documentation**: See [CLI_GUIDE.md](CLI_GUIDE.md)
- **Issues**: Report on [GitHub Issues](https://github.com/amanpandadev-dev/autochub-context-hub/issues)
- **Questions**: Check [COMMAND_INSTRUCTIONS.md](COMMAND_INSTRUCTIONS.md)

---

## 🎉 Getting Started

### 1. Install
```bash
npm install -g autochub-context-hub
```

### 2. Analyze
```bash
autochub analyze src/
```

### 3. Review Results
```bash
# See deprecated APIs found
```

### 4. Generate Report
```bash
autochub report src/ --format html --output report.html
```

### 5. Fix Issues
```bash
autochub fix src/ --dry-run
autochub fix src/ --backup
```

---

## 📚 Documentation Index

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **START_HERE_FINAL.md** | Quick start guide | 5 min |
| **QUICK_REFERENCE.md** | One-page reference | 2 min |
| **COMMAND_INSTRUCTIONS.md** | Complete command guide | 15 min |
| **CLI_GUIDE.md** | Detailed CLI reference | 20 min |
| **MEMGRAPH_IMPLEMENTATION.md** | Memgraph guide | 15 min |
| **SETUP_GUIDE.md** | Installation guide | 10 min |
| **GITHUB_CONFIGURATION_DETAILED.md** | GitHub setup | 10 min |
| **STATUS_REPORT.md** | Project status | 10 min |
| **COMPLETION_SUMMARY.md** | Project summary | 10 min |

---

## 🚀 Ready to Use?

Start with **[START_HERE_FINAL.md](START_HERE_FINAL.md)** for a quick 5-minute guide.

Or jump straight to **[COMMAND_INSTRUCTIONS.md](COMMAND_INSTRUCTIONS.md)** for complete command reference.

---

**Auto-CHUB - Making deprecated API detection easy!** 🎯
