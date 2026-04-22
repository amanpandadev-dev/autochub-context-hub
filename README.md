# Auto-CHUB CLI 🚀

**Auto-CHUB** is an offline-first, high-performance CLI tool designed to detect and fix deprecated API calls in your codebase. It uses in-memory graph analysis (`graphology`) to perform deep call-graph propagation—finding not just direct calls, but also indirect usages of deprecated methods.

Powered by **Andrew Ng's Context Hub (`chub`)**, it pulls real-time migration documentation to ensure your fixes are always up to date.

---

## Key Features

- **In-Memory Graph Engine**: Zero infrastructure (no Docker/Database needed). Fast, local-only graph analysis.
- **Deep Propagation**: Detects functions that transitively call deprecated APIs.
- **Context Hub Integration**: Automatic searching of `chub` for the latest documentation and migration guides.
- **Multi-Language Support**: Robust parsing for TypeScript/JavaScript (via AST) and regex-based scanning for Python, Go, Java, and C#.
- **Clean Reports**: Output findings in Table, JSON, or Markdown formats.

---

## Quick Start

### Installation

Install globally via npm:

```bash
npm install -g autochub-context-hub
```

### 1. Initialize
Create a `.autochub.json` config in your project root:

```bash
autochub init
```

### 2. Analyze
Scan your project for deprecated APIs. Use `--with-graph` for deep analysis and `--use-chub` for documentation enrichment.
By default, `autochub analyze` also saves an HTML findings report at `.autochub/reports/latest-findings.html` and opens it for interactive terminal runs.

```bash
autochub analyze . --with-graph --use-chub
```

### 3. Sync Rules
Pull the latest migration hints and rules from Andrew Ng's Context Hub:

```bash
autochub sync --chub
```

---

## Commands

| Command | Description |
| :--- | :--- |
| `analyze [path]` | Scan project for deprecated code. |
| `fix [path]` | Apply safe automatic replacements. |
| `report [path]` | Generate a formal migration report (Markdown/JSON/CSV). |
| `rules` | List all 30+ built-in deprecation patterns. |
| `cmd [command]` | Explain available commands, use cases, and examples. |
| `sync` | Update your rules from remote sources or Context Hub. |
| `init` | Setup the project configuration. |

---

## Why Auto-CHUB?

Traditional linters only find direct calls. Auto-CHUB builds a full call-graph of your code, allowing it to see that `function A` is risky because it calls `function B`, which eventually hits a deprecated `openai` or `react` method.

---

## License

MIT © [Auto-CHUB Team]
