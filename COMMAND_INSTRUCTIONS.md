# 🎯 Auto-CHUB CLI - Complete Command Instructions

A comprehensive guide for all Auto-CHUB CLI commands with examples and use cases.

---

## 📦 Installation

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

## 🚀 Quick Start (5 Minutes)

### 1. Analyze Your Project
```bash
autochub analyze src/
```

### 2. See Deep Analysis
```bash
npm run setup
autochub analyze src/ --with-graph
```

### 3. Generate Report
```bash
autochub report src/ --format html --output report.html
```

### 4. Preview Fixes
```bash
autochub fix src/ --dry-run
```

### 5. Apply Fixes
```bash
autochub fix src/ --backup
```

---

## 📋 Command Reference

### Command 1: ANALYZE

**Purpose**: Find deprecated APIs in your codebase

#### Basic Syntax
```bash
autochub analyze [path] [options]
```

#### Required Arguments
- `[path]` - Path to analyze (e.g., `src/`, `.`, `src/components/`)

#### Optional Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--with-graph` | Use Memgraph for deep analysis | `autochub analyze src/ --with-graph` |
| `--lang` | Filter by language | `autochub analyze src/ --lang typescript` |
| `--output` | Output format (json, html, markdown) | `autochub analyze src/ --output json` |
| `--severity` | Filter by severity (critical, warning, info) | `autochub analyze src/ --severity critical` |
| `--exclude` | Exclude file patterns | `autochub analyze src/ --exclude "node_modules/**"` |
| `--max-results` | Limit number of results | `autochub analyze src/ --max-results 50` |
| `--github-links` | Include GitHub documentation links | `autochub analyze src/ --github-links` |

#### Examples

**Example 1: Basic Analysis**
```bash
autochub analyze src/
```
Output: Lists all deprecated APIs found in src/

**Example 2: Deep Analysis with Memgraph**
```bash
autochub analyze src/ --with-graph
```
Output: Includes risk scores and impact analysis

**Example 3: TypeScript Only**
```bash
autochub analyze src/ --lang typescript
```
Output: Only analyzes .ts and .tsx files

**Example 4: Critical Issues Only**
```bash
autochub analyze src/ --severity critical
```
Output: Only shows high-risk deprecations

**Example 5: JSON Output**
```bash
autochub analyze src/ --output json
```
Output: Machine-readable JSON format

**Example 6: Exclude Directories**
```bash
autochub analyze src/ --exclude "node_modules/**,dist/**,build/**"
```
Output: Skips specified directories

**Example 7: Limit Results**
```bash
autochub analyze src/ --max-results 20
```
Output: Shows only first 20 results

**Example 8: With GitHub Links**
```bash
autochub analyze src/ --github-links
```
Output: Includes links to GitHub documentation

**Example 9: Combined Options**
```bash
autochub analyze src/ --with-graph --lang typescript --severity critical --output json
```
Output: Deep analysis of critical TypeScript issues in JSON format

#### Output Example
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

---

### Command 2: FIX

**Purpose**: Apply fixes to deprecated APIs

#### Basic Syntax
```bash
autochub fix [path] [options]
```

#### Required Arguments
- `[path]` - Path to fix (e.g., `src/`, `.`, `src/components/`)

#### Optional Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--dry-run` | Preview changes without applying | `autochub fix src/ --dry-run` |
| `--auto-approve` | Apply all fixes without confirmation | `autochub fix src/ --auto-approve` |
| `--use-llm` | Use LLM for intelligent migrations | `autochub fix src/ --use-llm` |
| `--backup` | Create backup before fixing | `autochub fix src/ --backup` |
| `--severity` | Only fix issues of this severity | `autochub fix src/ --severity critical` |

#### Examples

**Example 1: Preview Changes**
```bash
autochub fix src/ --dry-run
```
Output: Shows what will be changed without applying

**Example 2: Apply with Backup**
```bash
autochub fix src/ --backup
```
Output: Creates backup, then applies fixes

**Example 3: Auto-Approve All**
```bash
autochub fix src/ --auto-approve
```
Output: Applies all fixes without asking

**Example 4: Only Critical**
```bash
autochub fix src/ --severity critical
```
Output: Only fixes critical issues

**Example 5: LLM-Assisted**
```bash
autochub fix src/ --use-llm
```
Output: Uses AI for intelligent migrations

**Example 6: Preview + Backup**
```bash
autochub fix src/ --dry-run --backup
```
Output: Shows changes and creates backup (doesn't apply)

**Example 7: Full Workflow**
```bash
autochub fix src/ --dry-run
# Review output
autochub fix src/ --backup --auto-approve
# Verify changes
git diff
```
Output: Safe workflow with preview and backup

#### Output Example
```
🔧 Auto-CHUB Fixer

📁 Fixing: /path/to/project

Found 20 deprecated API usages

💾 Creating backup...
✓ Backup created at: .autochub-backup-2024-04-09

🔄 Fixing: ChatCompletion.create
   → client.chat.completions.create
   📝 OpenAI API migration
   📊 Found in 12 locations

   ✓ Fixed: src/chat.ts:42
   ✓ Fixed: src/api.ts:15
   ✓ Fixed: src/utils.ts:8
   ...

📊 Summary:
   Fixed: 20 issues
   Status: ✓ Complete
   Backup: .autochub-backup-2024-04-09
```

---

### Command 3: REPORT

**Purpose**: Generate comprehensive deprecation reports

#### Basic Syntax
```bash
autochub report [path] [options]
```

#### Required Arguments
- `[path]` - Path to analyze (e.g., `src/`, `.`, `src/components/`)

#### Optional Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--format` | Output format (html, json, markdown, csv) | `autochub report src/ --format html` |
| `--include-timeline` | Show deprecation timeline | `autochub report src/ --include-timeline` |
| `--include-metrics` | Show migration metrics | `autochub report src/ --include-metrics` |
| `--output` | Save to file | `autochub report src/ --output report.html` |

#### Examples

**Example 1: HTML Report**
```bash
autochub report src/ --format html --output report.html
```
Output: Creates interactive HTML report

**Example 2: JSON Report**
```bash
autochub report src/ --format json
```
Output: Machine-readable JSON

**Example 3: Markdown Report**
```bash
autochub report src/ --format markdown --output report.md
```
Output: Documentation-friendly format

**Example 4: CSV Report**
```bash
autochub report src/ --format csv --output report.csv
```
Output: Excel/Sheets-compatible format

**Example 5: With Timeline**
```bash
autochub report src/ --format html --include-timeline --output report.html
```
Output: Shows when APIs were deprecated

**Example 6: With Metrics**
```bash
autochub report src/ --format html --include-metrics --output report.html
```
Output: Shows migration effort metrics

**Example 7: Full Report**
```bash
autochub report src/ --format html --include-timeline --include-metrics --output report.html
```
Output: Complete report with all details

**Example 8: Generate and Open**
```bash
autochub report src/ --format html --output report.html && open report.html
```
Output: Generates and opens in browser

#### Output Formats

**HTML Report:**
- Interactive table
- Summary statistics
- Styled for easy reading
- Can be opened in browser

**JSON Report:**
```json
{
  "timestamp": "2024-04-09T10:30:00Z",
  "projectPath": "/path/to/project",
  "totalFindings": 20,
  "totalFiles": 8,
  "findings": [
    {
      "file": "src/chat.ts",
      "line": 42,
      "pattern": "ChatCompletion.create",
      "code": "const response = await ChatCompletion.create({"
    }
  ],
  "summary": {
    "ChatCompletion.create": 12,
    "ReactDOM.render": 8
  }
}
```

**Markdown Report:**
- Formatted for documentation
- Can be included in README
- Easy to share

**CSV Report:**
- Importable to Excel/Sheets
- Easy to analyze
- Good for tracking

---

### Command 4: CONFIG

**Purpose**: Manage CLI configuration

#### Basic Syntax
```bash
autochub config [action] [key] [value]
```

#### Actions

| Action | Description | Example |
|--------|-------------|---------|
| `get` | Get configuration value | `autochub config get memgraph.host` |
| `set` | Set configuration value | `autochub config set memgraph.host localhost` |
| `list` | List all settings | `autochub config list` |
| `reset` | Reset to defaults | `autochub config reset` |

#### Available Configuration Keys

| Key | Description | Default |
|-----|-------------|---------|
| `memgraph.host` | Memgraph server host | localhost |
| `memgraph.port` | Memgraph server port | 7687 |
| `memgraph.username` | Memgraph username | memgraph |
| `memgraph.password` | Memgraph password | memgraph |
| `analysis.excludeDirs` | Directories to exclude | node_modules, .git, dist |
| `analysis.extensions` | File extensions to analyze | .ts, .tsx, .js, .jsx |
| `output.format` | Default output format | html |
| `output.directory` | Default output directory | ./reports |

#### Examples

**Example 1: List All Configuration**
```bash
autochub config list
```
Output: Shows all current settings

**Example 2: Get a Value**
```bash
autochub config get memgraph.host
```
Output: `localhost`

**Example 3: Set a Value**
```bash
autochub config set memgraph.host 192.168.1.100
```
Output: Configuration updated

**Example 4: Set Array Value**
```bash
autochub config set analysis.extensions '["ts","tsx","js","jsx","py"]'
```
Output: Configuration updated

**Example 5: Reset to Defaults**
```bash
autochub config reset
```
Output: All settings reset to defaults

**Example 6: Configure Remote Memgraph**
```bash
autochub config set memgraph.host 192.168.1.100
autochub config set memgraph.port 7687
autochub config set memgraph.username admin
autochub config set memgraph.password secure-password
```
Output: Memgraph configured for remote server

**Example 7: Configure Exclusions**
```bash
autochub config set analysis.excludeDirs '["node_modules",".git","dist","build","coverage"]'
```
Output: Exclusion patterns updated

#### Output Example
```
📋 Current Configuration:

{
  "memgraph": {
    "host": "localhost",
    "port": 7687,
    "username": "memgraph",
    "password": "memgraph"
  },
  "analysis": {
    "excludeDirs": ["node_modules", ".git", "dist"],
    "extensions": [".ts", ".tsx", ".js", ".jsx"]
  },
  "output": {
    "format": "html",
    "directory": "./reports"
  }
}
```

---

## 🔄 Workflow Examples

### Workflow 1: Quick Check (5 minutes)
```bash
# 1. Analyze project
autochub analyze src/

# 2. Review output
# 3. Done!
```

### Workflow 2: Deep Analysis (15 minutes)
```bash
# 1. Setup Memgraph
npm run setup

# 2. Run deep analysis
autochub analyze src/ --with-graph

# 3. Review risk scores
# 4. Done!
```

### Workflow 3: Generate Report (10 minutes)
```bash
# 1. Generate HTML report
autochub report src/ --format html --output report.html

# 2. Open in browser
open report.html

# 3. Share with team
# 4. Done!
```

### Workflow 4: Fix Issues (20 minutes)
```bash
# 1. Preview fixes
autochub fix src/ --dry-run

# 2. Review changes
# 3. Apply fixes with backup
autochub fix src/ --backup

# 4. Verify changes
git diff

# 5. Commit changes
git add .
git commit -m "fix: Update deprecated APIs"

# 6. Done!
```

### Workflow 5: CI/CD Integration (Automated)
```bash
# In your CI pipeline
autochub analyze src/ --with-graph --output json > analysis.json

# Check for critical issues
if grep -q '"riskScore": [7-9][0-9]' analysis.json; then
  echo "Critical deprecations found!"
  exit 1
fi

# If no critical issues, continue
echo "All checks passed!"
```

### Workflow 6: Team Reporting (30 minutes)
```bash
# 1. Generate comprehensive report
autochub report src/ --format html --include-timeline --include-metrics --output report.html

# 2. Generate JSON for tracking
autochub report src/ --format json --output analysis.json

# 3. Generate CSV for spreadsheet
autochub report src/ --format csv --output analysis.csv

# 4. Share all reports with team
# 5. Done!
```

---

## 💡 Advanced Usage

### Combine with Other Tools

**Pipe to jq for JSON processing:**
```bash
autochub analyze src/ --output json | jq '.[] | select(.riskScore > 70)'
```

**Generate report and open:**
```bash
autochub report src/ --format html --output report.html && open report.html
```

**Save analysis with timestamp:**
```bash
autochub analyze src/ --output json > analysis-$(date +%Y%m%d).json
```

**Check for critical issues:**
```bash
autochub analyze src/ --output json | jq '.[] | select(.severity == "critical")'
```

---

### Automate with Scripts

**Create analyze-and-report.sh:**
```bash
#!/bin/bash
# analyze-and-report.sh

echo "🔍 Analyzing codebase..."
autochub analyze src/ --with-graph --output json > analysis.json

echo "📊 Generating reports..."
autochub report src/ --format html --output report.html
autochub report src/ --format json --output report.json
autochub report src/ --format csv --output report.csv

echo "✅ Analysis complete!"
echo "📁 Reports:"
echo "   - report.html"
echo "   - report.json"
echo "   - report.csv"
```

**Run the script:**
```bash
chmod +x analyze-and-report.sh
./analyze-and-report.sh
```

---

### CI/CD Integration

**GitHub Actions:**
```yaml
name: Auto-CHUB Analysis

on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Setup Memgraph
        run: npm run setup
      
      - name: Analyze with Auto-CHUB
        run: |
          autochub analyze src/ --with-graph --output json > analysis.json
      
      - name: Check for critical issues
        run: |
          if grep -q '"riskScore": [7-9][0-9]' analysis.json; then
            echo "❌ Critical deprecations found!"
            exit 1
          fi
          echo "✅ All checks passed!"
      
      - name: Generate report
        run: |
          autochub report src/ --format html --output report.html
      
      - name: Upload report
        uses: actions/upload-artifact@v2
        with:
          name: deprecation-report
          path: report.html
```

---

## 🆘 Troubleshooting

### Issue: Command not found
```bash
# Solution 1: Make sure you're in the project directory
cd /path/to/autochub

# Solution 2: Install globally
npm install -g .

# Solution 3: Use npx
npx autochub analyze src/
```

### Issue: Memgraph connection failed
```bash
# Solution 1: Make sure Memgraph is running
npm run setup

# Solution 2: Check Memgraph status
docker ps | grep memgraph

# Solution 3: Start manually
docker run -d -p 7687:7687 memgraph/memgraph
```

### Issue: Permission denied
```bash
# Solution 1: Make CLI executable
chmod +x src/cli/index.ts

# Solution 2: Use npx
npx autochub analyze src/

# Solution 3: Use npm
npm exec autochub analyze src/
```

### Issue: No results found
```bash
# Solution 1: Check path exists
ls -la src/

# Solution 2: Check file extensions
autochub analyze src/ --lang typescript

# Solution 3: Check exclusions
autochub config list
```

---

## 📚 Configuration File

The CLI uses `.autochubrc.json` for configuration:

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

---

## 🎯 Tips & Tricks

✅ **Use --dry-run before applying fixes**
```bash
autochub fix src/ --dry-run
```

✅ **Always create backup before fixing**
```bash
autochub fix src/ --backup
```

✅ **Use --with-graph for better analysis**
```bash
autochub analyze src/ --with-graph
```

✅ **Generate multiple report formats**
```bash
autochub report src/ --format html --output report.html
autochub report src/ --format json --output report.json
```

✅ **Combine with git for version control**
```bash
autochub fix src/ --backup
git diff
git add .
git commit -m "fix: Update deprecated APIs"
```

---

## 📞 Support

- **Documentation**: See `CLI_GUIDE.md`
- **Issues**: Report on GitHub
- **Questions**: Check troubleshooting section

---

## 🎉 Summary

Auto-CHUB CLI provides:

✅ **Analyze** - Find deprecated APIs  
✅ **Fix** - Apply fixes automatically  
✅ **Report** - Generate comprehensive reports  
✅ **Config** - Manage settings  

All with Memgraph integration for deep analysis!

---

**Ready to use Auto-CHUB?** Start with `autochub analyze src/` 🚀
