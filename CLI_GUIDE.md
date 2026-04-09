# Auto-CHUB CLI Guide

## Installation

The CLI is included in the package. After setup, you can use it globally:

```bash
npm run setup
npm install -g .
```

Or use directly:

```bash
npx autochub <command>
```

## Commands

### 1. Analyze Command

Analyze your codebase for deprecated APIs.

#### Basic Usage
```bash
autochub analyze [path]
```

#### Options
```bash
--with-graph              # Use Memgraph for deep analysis
--lang <language>         # Filter by language (js, ts, py, go, java, cs)
--output <format>         # Output format (json, html, markdown)
--severity <level>        # Filter by severity (critical, warning, info)
--exclude <patterns>      # Exclude file patterns
--max-results <number>    # Limit results
--github-links            # Include GitHub documentation links
```

#### Examples
```bash
# Basic analysis
autochub analyze src/

# Deep analysis with Memgraph
autochub analyze src/ --with-graph

# Output as JSON
autochub analyze src/ --output json

# Filter by language
autochub analyze src/ --lang typescript

# Only critical issues
autochub analyze src/ --severity critical

# Exclude node_modules
autochub analyze src/ --exclude "node_modules/**"
```

#### Output
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

### 2. Fix Command

Apply fixes to deprecated APIs.

#### Basic Usage
```bash
autochub fix [path]
```

#### Options
```bash
--dry-run                 # Preview changes without applying
--auto-approve            # Apply all fixes without confirmation
--use-llm                 # Use LLM for intelligent migrations
--backup                  # Create backup before fixing
--severity <level>        # Only fix issues of this severity
```

#### Examples
```bash
# Preview fixes
autochub fix src/ --dry-run

# Apply fixes with backup
autochub fix src/ --backup

# Auto-approve all fixes
autochub fix src/ --auto-approve

# Only fix critical issues
autochub fix src/ --severity critical
```

#### Output
```
🔧 Auto-CHUB Fixer

📁 Fixing: /path/to/project

Found 20 deprecated API usages

💾 Creating backup...
✓ Backup created

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
```

### 3. Report Command

Generate comprehensive deprecation reports.

#### Basic Usage
```bash
autochub report [path]
```

#### Options
```bash
--format <format>         # Output format (html, json, markdown, csv)
--include-timeline        # Show deprecation timeline
--include-metrics         # Show migration metrics
--output <file>           # Save to file
```

#### Examples
```bash
# Generate HTML report
autochub report src/ --format html --output report.html

# Generate JSON report
autochub report src/ --format json

# Generate Markdown report
autochub report src/ --format markdown --output report.md

# Generate CSV report
autochub report src/ --format csv --output report.csv
```

#### Output Formats

**HTML Report:**
- Interactive table with all findings
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

### 4. Config Command

Manage CLI configuration.

#### Basic Usage
```bash
autochub config [action] [key] [value]
```

#### Actions
```bash
get <key>                 # Get configuration value
set <key> <value>         # Set configuration value
list                      # List all settings
reset                     # Reset to defaults
```

#### Available Keys
```
memgraph.host             # Memgraph host (default: localhost)
memgraph.port             # Memgraph port (default: 7687)
memgraph.username         # Memgraph username
memgraph.password         # Memgraph password
analysis.excludeDirs      # Directories to exclude
analysis.extensions       # File extensions to analyze
output.format             # Default output format
output.directory          # Default output directory
```

#### Examples
```bash
# List all configuration
autochub config list

# Get a value
autochub config get memgraph.host

# Set a value
autochub config set memgraph.host localhost
autochub config set memgraph.port 7687

# Set array value
autochub config set analysis.extensions '["ts","tsx","js","jsx"]'

# Reset to defaults
autochub config reset
```

#### Output
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

## Workflow Examples

### Example 1: Quick Analysis
```bash
# Analyze current project
autochub analyze .

# View results
# Check the output for deprecated APIs
```

### Example 2: Deep Analysis with Memgraph
```bash
# Setup Memgraph first
npm run setup

# Run deep analysis
autochub analyze src/ --with-graph

# Get detailed impact analysis
# See risk scores and refactoring paths
```

### Example 3: Generate Report
```bash
# Generate HTML report
autochub report src/ --format html --output deprecation-report.html

# Open in browser
open deprecation-report.html
```

### Example 4: Fix with Backup
```bash
# Preview fixes
autochub fix src/ --dry-run

# Create backup and apply fixes
autochub fix src/ --backup

# Verify changes
git diff
```

### Example 5: CI/CD Integration
```bash
# In your CI pipeline
autochub analyze src/ --with-graph --output json > analysis.json

# Check for critical issues
if grep -q '"riskScore": [7-9][0-9]' analysis.json; then
  echo "Critical deprecations found!"
  exit 1
fi
```

## Configuration File

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

## Global Installation

To use `autochub` globally:

```bash
# Install globally
npm install -g .

# Now use from anywhere
autochub analyze /path/to/project
autochub fix /path/to/project
autochub report /path/to/project
```

## Troubleshooting

### Command not found
```bash
# Make sure you're in the project directory
cd /path/to/autochub

# Or install globally
npm install -g .
```

### Memgraph connection failed
```bash
# Make sure Memgraph is running
npm run setup

# Or start manually
docker run -d -p 7687:7687 memgraph/memgraph
```

### Permission denied
```bash
# Make CLI executable
chmod +x src/cli/index.ts

# Or use npx
npx autochub analyze src/
```

## Tips & Tricks

### Combine with other tools
```bash
# Pipe to jq for JSON processing
autochub analyze src/ --output json | jq '.[] | select(.riskScore > 70)'

# Generate report and open
autochub report src/ --format html --output report.html && open report.html

# Save analysis for later
autochub analyze src/ --output json > analysis-$(date +%Y%m%d).json
```

### Automate with scripts
```bash
#!/bin/bash
# analyze-and-report.sh

autochub analyze src/ --with-graph --output json > analysis.json
autochub report src/ --format html --output report.html

echo "Analysis complete!"
echo "Report: report.html"
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
      echo "Critical deprecations found!"
      exit 1
    fi
```

## Summary

The CLI provides:
- ✅ **Analyze** - Find deprecated APIs
- ✅ **Fix** - Apply fixes automatically
- ✅ **Report** - Generate comprehensive reports
- ✅ **Config** - Manage settings

All with Memgraph integration for deep analysis!

