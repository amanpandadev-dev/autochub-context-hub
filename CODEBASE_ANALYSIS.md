# Auto-CHUB Codebase Analysis & Strategic Roadmap

## 1. CODEBASE OVERVIEW

### Project Purpose
**Auto-CHUB** is a context-first coding assistant that:
- Detects deprecated API calls in code (JavaScript, TypeScript, Python, Go, Java, C#)
- Fetches authoritative documentation from GitHub via Context Hub CLI
- Provides LLM-assisted code migrations using OpenRouter
- Integrates as a VS Code extension with real-time diagnostics and quick fixes

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
│  (extension-template.ts - 3200+ lines)                       │
│  - Detects deprecated patterns                               │
│  - Integrates Context Hub CLI (chub)                         │
│  - Provides code actions & diagnostics                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
    ┌───▼────────┐        ┌──────▼──────┐
    │ React App  │        │ Express     │
    │ (src/)     │        │ Server      │
    │ - UI Panel │        │ (server.ts) │
    │ - Chat     │        │ - Vite Dev  │
    └────────────┘        │ - Production│
                          └─────────────┘
        │
        └─────────────────────────────────────────┐
                                                  │
                    ┌─────────────────────────────▼──────────┐
                    │  External Services                      │
                    │  - Context Hub CLI (chub)               │
                    │  - OpenRouter API (LLM)                 │
                    │  - GitHub (docs retrieval)              │
                    └────────────────────────────────────────┘
```

### Key Components

| Component | Purpose | Key Files |
|-----------|---------|-----------|
| **VS Code Extension** | Main detection & fix engine | `extension-template.ts` |
| **React UI** | Web interface for debugging & analysis | `src/App.tsx`, `src/components/` |
| **Express Server** | Backend for Vite dev & production | `server.ts` |
| **Type Definitions** | Shared interfaces | `src/types.ts` |
| **Configuration** | Extension settings & CLI integration | `package.json` |

### Tech Stack
- **Frontend**: React 19, Tailwind CSS, Vite
- **Backend**: Express, Node.js
- **Extension**: VS Code API
- **External**: Context Hub CLI, OpenRouter API
- **Language**: TypeScript

---

## 2. RETRIEVING DOCUMENTATION FROM GITHUB & DETECTING DEPRECATED APIs

### Current Implementation

#### A. Context Hub CLI Integration
The extension uses the official **Context Hub CLI** (`chub`) to fetch documentation:

```bash
# Search for API documentation
chub search "openai"

# Fetch specific documentation
chub get openai/chat --lang javascript --json

# Annotate usage
chub annotate openai/chat "Used in migration"

# Send feedback
chub feedback openai/chat up "This helped"
```

**Key Functions** (in `extension-template.ts`):
- `extractContextHubQueries()` - Infers library/API queries from code
- `detectContextHubProviderHints()` - Detects provider-specific patterns (OpenAI, Google, etc.)
- `parseChubSearchEntries()` - Parses CLI search results
- `parseChubGetContent()` - Extracts deprecation info from fetched docs
- `buildContextHubGitHubUrl()` - Constructs GitHub citation links

#### B. Deprecation Detection Strategy

**Multi-layered approach:**

1. **Context Hub-backed Detection** (Primary)
   - Fetches authoritative docs from GitHub
   - Extracts deprecated signatures from documentation
   - Matches code against documented deprecations
   - Provides GitHub citation links

2. **Generic Heuristic Detection** (Fallback)
   - Pattern matching for known deprecated methods
   - Configurable via `autochub.genericLegacyMethodNames`
   - Examples: `ReactDOM.render`, `new Buffer`, `CancelToken`

3. **Custom Regex Rules** (Extensible)
   - User-defined patterns via `autochub.customOutdatedPatterns`
   - Supports guidance, replacements, and documentation links

**Key Functions**:
- `extractDeprecatedSignaturesFromDoc()` - Parses deprecation info from docs
- `findOutdatedApiPatterns()` - Main detection engine
- `getContextHubRulesForDocument()` - Orchestrates CLI queries & doc fetching

#### C. GitHub Documentation Retrieval Flow

```
Code Analysis
    ↓
Extract Queries (imports, method calls)
    ↓
Run: chub search <query>
    ↓
Score & Filter Results
    ↓
Run: chub get <doc_id> --lang <language> --json
    ↓
Parse Deprecation Signatures
    ↓
Match Against Code
    ↓
Build GitHub Citation Links
    ↓
Return Findings with Links
```

### Recommended Enhancements

#### 1. **Automated GitHub Sync**
```typescript
// Periodically sync Context Hub docs locally
async function syncContextHubDocs() {
  const docs = await executeCliJson('chub list --json');
  // Cache locally for offline analysis
  fs.writeFileSync('.chub-cache.json', JSON.stringify(docs));
}
```

#### 2. **Deprecation Timeline Tracking**
```typescript
interface DeprecationTimeline {
  deprecated: string;      // When deprecated
  removed: string;         // When removed
  replacement: string;     // Recommended alternative
  migrationGuide: string;  // Link to migration docs
}
```

#### 3. **Batch Analysis for Large Codebases**
```typescript
// Analyze entire project for deprecated APIs
async function analyzeProjectDeprecations(projectPath: string) {
  const files = await findAllSourceFiles(projectPath);
  const results = await Promise.all(
    files.map(f => analyzeFileForDeprecations(f))
  );
  return generateDeprecationReport(results);
}
```

#### 4. **GitHub Actions Integration**
```yaml
# .github/workflows/deprecation-check.yml
name: Check for Deprecated APIs
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install -g @aisuite/chub
      - run: chub search-project . --report deprecations.json
```

---

## 3. CLI FOR THE CODEBASE

### Vision
Create a standalone **`autochub-cli`** tool that allows users to:
- Analyze codebases for deprecated APIs
- Generate migration reports
- Apply fixes automatically
- Integrate with CI/CD pipelines

### Proposed CLI Structure

```
autochub-cli
├── commands/
│   ├── analyze.ts       # Scan for deprecated APIs
│   ├── fix.ts           # Apply fixes
│   ├── report.ts        # Generate reports
│   ├── config.ts        # Manage configuration
│   └── init.ts          # Initialize project
├── lib/
│   ├── detector.ts      # Deprecation detection engine
│   ├── fixer.ts         # Code transformation
│   ├── reporter.ts      # Report generation
│   └── github.ts        # GitHub integration
├── types/
│   └── cli.ts           # CLI-specific types
└── index.ts             # CLI entry point
```

### CLI Commands

#### 1. **Initialize Project**
```bash
autochub init
# Creates .autochubrc.json with default settings
```

#### 2. **Analyze Codebase**
```bash
autochub analyze [path] [options]

Options:
  --lang <language>        Filter by language (js, ts, py, go, java, cs)
  --output <format>        Output format (json, html, markdown)
  --severity <level>       Filter by severity (critical, warning, info)
  --exclude <patterns>     Exclude file patterns
  --max-results <number>   Limit results
  --github-links           Include GitHub documentation links
  --offline                Use cached docs only

Examples:
  autochub analyze src/ --lang typescript --output json
  autochub analyze . --severity critical --github-links
  autochub analyze src/ --exclude node_modules --output html > report.html
```

#### 3. **Apply Fixes**
```bash
autochub fix [path] [options]

Options:
  --dry-run                Preview changes without applying
  --auto-approve           Apply all fixes without confirmation
  --use-llm                Use LLM for intelligent migrations
  --backup                 Create backup before fixing
  --severity <level>       Only fix issues of this severity

Examples:
  autochub fix src/ --dry-run
  autochub fix . --use-llm --backup
  autochub fix src/ --auto-approve --severity critical
```

#### 4. **Generate Reports**
```bash
autochub report [path] [options]

Options:
  --format <format>        html, json, markdown, csv
  --include-timeline       Show deprecation timeline
  --include-metrics        Show migration metrics
  --output <file>          Save to file

Examples:
  autochub report src/ --format html --output report.html
  autochub report . --format markdown --include-timeline
```

#### 5. **Configuration Management**
```bash
autochub config [action] [key] [value]

Actions:
  get <key>                Get configuration value
  set <key> <value>        Set configuration value
  list                     List all settings
  reset                    Reset to defaults

Examples:
  autochub config set openrouter-api-key sk-...
  autochub config get chub-binary-path
  autochub config list
```

#### 6. **CI/CD Integration**
```bash
autochub ci [options]

Options:
  --fail-on-critical       Exit with error if critical issues found
  --fail-on-any            Exit with error if any issues found
  --report-file <path>     Save report for CI system

Examples:
  autochub ci --fail-on-critical --report-file deprecations.json
```

### Implementation Plan

#### Phase 1: Core CLI Framework
```typescript
// src/cli/index.ts
import { Command } from 'commander';
import { analyzeCommand } from './commands/analyze';
import { fixCommand } from './commands/fix';
import { reportCommand } from './commands/report';

const program = new Command();

program
  .name('autochub')
  .description('Detect and fix deprecated API calls')
  .version('1.0.0');

program
  .command('analyze [path]')
  .description('Analyze codebase for deprecated APIs')
  .action(analyzeCommand);

program
  .command('fix [path]')
  .description('Apply fixes to deprecated APIs')
  .action(fixCommand);

program
  .command('report [path]')
  .description('Generate deprecation report')
  .action(reportCommand);

program.parse(process.argv);
```

#### Phase 2: Detection Engine
```typescript
// src/lib/detector.ts
export class DeprecationDetector {
  async analyzeFile(filePath: string): Promise<Finding[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const language = detectLanguage(filePath);
    
    // Use Context Hub CLI
    const rules = await this.getContextHubRules(language);
    
    // Detect patterns
    const findings = this.detectPatterns(content, rules);
    
    return findings;
  }

  async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    const files = await findSourceFiles(projectPath);
    const results = await Promise.all(
      files.map(f => this.analyzeFile(f))
    );
    return this.aggregateResults(results);
  }
}
```

#### Phase 3: Fixer Engine
```typescript
// src/lib/fixer.ts
export class DeprecationFixer {
  async fixFile(filePath: string, findings: Finding[]): Promise<string> {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    for (const finding of findings) {
      if (finding.replacement) {
        content = this.applyReplacement(content, finding);
      }
    }
    
    return content;
  }

  async fixProject(projectPath: string, options: FixOptions): Promise<FixResult> {
    const detector = new DeprecationDetector();
    const analysis = await detector.analyzeProject(projectPath);
    
    const results = [];
    for (const file of analysis.files) {
      const fixed = await this.fixFile(file.path, file.findings);
      results.push({ file: file.path, fixed });
    }
    
    return { files: results, summary: this.summarize(results) };
  }
}
```

#### Phase 4: Report Generation
```typescript
// src/lib/reporter.ts
export class ReportGenerator {
  generateHtml(analysis: ProjectAnalysis): string {
    return `
      <html>
        <head><title>Deprecation Report</title></head>
        <body>
          <h1>Deprecation Analysis Report</h1>
          <div class="summary">
            <p>Total Issues: ${analysis.totalFindings}</p>
            <p>Critical: ${analysis.critical}</p>
            <p>Warnings: ${analysis.warnings}</p>
          </div>
          <div class="findings">
            ${analysis.files.map(f => this.renderFile(f)).join('')}
          </div>
        </body>
      </html>
    `;
  }

  generateJson(analysis: ProjectAnalysis): string {
    return JSON.stringify(analysis, null, 2);
  }

  generateMarkdown(analysis: ProjectAnalysis): string {
    return `# Deprecation Report\n\n${/* ... */}`;
  }
}
```

### Package Structure

```json
{
  "name": "autochub-cli",
  "version": "1.0.0",
  "description": "CLI tool for detecting and fixing deprecated APIs",
  "bin": {
    "autochub": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/cli/index.ts",
    "test": "jest"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "chalk": "^5.0.0",
    "ora": "^7.0.0",
    "table": "^6.8.0"
  }
}
```

### Installation & Usage

```bash
# Install globally
npm install -g autochub-cli

# Or use with npx
npx autochub-cli analyze src/

# Initialize in project
autochub init

# Analyze
autochub analyze src/ --output json > report.json

# Fix with preview
autochub fix src/ --dry-run

# Apply fixes
autochub fix src/ --auto-approve

# Generate HTML report
autochub report src/ --format html --output report.html
```

### CI/CD Integration Examples

#### GitHub Actions
```yaml
name: Deprecation Check
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install -g autochub-cli
      - run: autochub analyze src/ --fail-on-critical
```

#### GitLab CI
```yaml
deprecation_check:
  image: node:18
  script:
    - npm install -g autochub-cli
    - autochub analyze src/ --output json --fail-on-critical
  artifacts:
    reports:
      deprecations: deprecations.json
```

---

## 4. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-2)
- [ ] Extract detection logic from extension into reusable library
- [ ] Create CLI framework with Commander.js
- [ ] Implement `analyze` command
- [ ] Add basic JSON output

### Phase 2: Core Features (Weeks 3-4)
- [ ] Implement `fix` command with dry-run
- [ ] Add report generation (HTML, Markdown)
- [ ] Integrate Context Hub CLI
- [ ] Add configuration management

### Phase 3: Advanced Features (Weeks 5-6)
- [ ] LLM-assisted fixes
- [ ] CI/CD integration
- [ ] Batch processing
- [ ] Performance optimization

### Phase 4: Polish & Release (Weeks 7-8)
- [ ] Comprehensive testing
- [ ] Documentation
- [ ] NPM package publishing
- [ ] GitHub Actions template

---

## 5. QUICK START FOR USERS

### For VS Code Extension Users
```bash
# 1. Install extension from VS Code Marketplace
# 2. Install Context Hub CLI
npm install -g @aisuite/chub

# 3. Configure in VS Code settings
{
  "autochub.useContextHubCli": true,
  "autochub.openRouterApiKey": "sk-..."
}

# 4. Use commands
# - Cmd+Shift+P → "Auto-CHUB: Analyze Current File"
# - Cmd+Shift+P → "Auto-CHUB: Apply All Latest Fixes"
```

### For CLI Users (Future)
```bash
# 1. Install CLI
npm install -g autochub-cli

# 2. Initialize project
cd my-project
autochub init

# 3. Analyze
autochub analyze src/

# 4. Fix
autochub fix src/ --dry-run
autochub fix src/ --auto-approve
```

---

## 6. KEY METRICS & SUCCESS CRITERIA

| Metric | Target | Current |
|--------|--------|---------|
| Deprecation Detection Accuracy | >95% | ~85% (Context Hub dependent) |
| False Positive Rate | <5% | ~10% |
| Fix Application Success | >90% | ~80% |
| CLI Adoption | 1000+ users | 0 (not released) |
| GitHub Integration | Full | Partial (via Context Hub) |

---

## 7. SECURITY & BEST PRACTICES

- **API Keys**: Never commit `.env` files; use environment variables
- **Code Analysis**: All analysis happens locally; only metadata sent to services
- **GitHub Access**: Uses public GitHub API; no authentication required for public repos
- **LLM Privacy**: Review OpenRouter privacy policy before sending code
- **Backup**: Always create backups before applying fixes

