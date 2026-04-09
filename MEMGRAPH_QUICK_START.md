# Memgraph Quick Start Guide for Auto-CHUB

## Why Memgraph for Code Analysis?

Memgraph excels at understanding code relationships:

| Use Case | Benefit |
|----------|---------|
| **Dependency Mapping** | See which modules depend on deprecated APIs |
| **Impact Analysis** | Understand cascading effects of changes |
| **Pattern Detection** | Find similar deprecated patterns |
| **Risk Scoring** | Quantify migration complexity |
| **Refactoring Paths** | Suggest safe migration sequences |

## 5-Minute Setup

### 1. Start Memgraph
```bash
# Docker (easiest)
docker run -p 7687:7687 memgraph/memgraph

# Or local
brew install memgraph && memgraph
```

### 2. Install Client
```bash
npm install memgraph
```

### 3. Test Connection
```typescript
import { Client } from 'memgraph';

const client = new Client();
await client.connect();
console.log('Connected to Memgraph!');
await client.disconnect();
```

## Core Concepts

### Graph Model for Code

```
File (path, language)
  ├── DEFINES → Function (name, signature)
  │              ├── CALLS → Function
  │              └── USES → DeprecatedAPI
  ├── IMPORTS → Module (name)
  └── DEPENDS_ON → File
```

### Example: OpenAI API Migration

```
File: src/chat.ts
  ├── DEFINES: chatWithOpenAI()
  │   └── USES: ChatCompletion.create (DEPRECATED)
  │       └── REPLACEMENT: client.chat.completions.create
  └── IMPORTS: openai
```

## Common Queries

### 1. Find All Deprecated API Usages
```cypher
MATCH (api:DeprecatedAPI)<-[:USES]-(func:Function)<-[:DEFINES]-(file:File)
RETURN file.path, func.name, api.name, api.replacement
ORDER BY file.path
```

### 2. Calculate Impact Score
```cypher
MATCH (api:DeprecatedAPI)<-[:USES]-(func:Function)<-[:DEFINES]-(file:File)
WITH api.name as apiName, COUNT(DISTINCT file) as fileCount, COUNT(func) as funcCount
RETURN apiName, fileCount, funcCount, (fileCount * funcCount) as impactScore
ORDER BY impactScore DESC
```

### 3. Find Dependency Chain
```cypher
MATCH path = (f1:File {path: $startFile})-[:DEPENDS_ON*]->(f2:File {path: $endFile})
RETURN [node IN nodes(path) | node.path] as chain
```

### 4. Identify High-Risk Deprecations
```cypher
MATCH (api:DeprecatedAPI)<-[:USES]-(func:Function)<-[:DEFINES]-(file:File)
WHERE api.removal_version IS NOT NULL
WITH api.name as apiName, COUNT(DISTINCT file) as fileCount
WHERE fileCount > 5
RETURN apiName, fileCount
ORDER BY fileCount DESC
```

## Practical Examples

### Example 1: Analyze React Deprecations

```typescript
async function analyzeReactDeprecations() {
  const client = new Client();
  await client.connect();

  // Find ReactDOM.render usages
  const query = `
    MATCH (api:DeprecatedAPI {name: "ReactDOM.render"})<-[:USES]-(func:Function)
    RETURN func.name, func.path, COUNT(*) as usageCount
  `;

  const results = await client.execute(query);
  
  console.log('ReactDOM.render usages:');
  results.forEach(r => {
    console.log(`  ${r['func.path']}: ${r['func.name']} (${r.usageCount}x)`);
  });

  await client.disconnect();
}
```

### Example 2: Generate Migration Report

```typescript
async function generateMigrationReport(projectPath: string) {
  const client = new Client();
  await client.connect();

  const query = `
    MATCH (api:DeprecatedAPI)<-[:USES]-(func:Function)<-[:DEFINES]-(file:File)
    RETURN 
      file.path,
      COUNT(DISTINCT api) as apiCount,
      COUNT(func) as functionCount,
      COLLECT(DISTINCT api.name) as apis
    ORDER BY functionCount DESC
  `;

  const results = await client.execute(query);

  const report = {
    totalFiles: results.length,
    totalDeprecations: results.reduce((sum, r) => sum + r.apiCount, 0),
    files: results.map(r => ({
      path: r['file.path'],
      deprecationCount: r.apiCount,
      functionCount: r.functionCount,
      apis: r.apis,
    })),
  };

  return report;
}
```

### Example 3: Find Refactoring Candidates

```typescript
async function findRefactoringCandidates() {
  const client = new Client();
  await client.connect();

  // Find deprecated APIs with known replacements
  const query = `
    MATCH (api:DeprecatedAPI)<-[:USES]-(func:Function)
    WHERE api.replacement IS NOT NULL
    RETURN 
      func.name,
      func.path,
      api.name,
      api.replacement,
      api.migration_guide
    LIMIT 20
  `;

  const candidates = await client.execute(query);

  console.log('Refactoring Candidates:');
  candidates.forEach(c => {
    console.log(`\n${c['func.name']} (${c['func.path']})`);
    console.log(`  Old: ${c['api.name']}`);
    console.log(`  New: ${c['api.replacement']}`);
    console.log(`  Guide: ${c['api.migration_guide']}`);
  });

  await client.disconnect();
}
```

## Integration with Auto-CHUB

### Step 1: Add Memgraph Service

```typescript
// src/lib/memgraph/service.ts
export class MemgraphService {
  private client: Client;

  async initialize() {
    this.client = new Client();
    await this.client.connect();
  }

  async indexProject(projectPath: string) {
    // Parse all files and build graph
    const files = await findSourceFiles(projectPath);
    for (const file of files) {
      await this.indexFile(file);
    }
  }

  async getDeprecationContext(apiName: string) {
    const query = `
      MATCH (api:DeprecatedAPI {name: $apiName})<-[:USES]-(func:Function)
      RETURN func.name, func.path, COUNT(*) as usageCount
    `;
    return await this.client.execute(query, { apiName });
  }

  async shutdown() {
    await this.client.disconnect();
  }
}
```

### Step 2: Enhance Extension Commands

```typescript
// In extension-template.ts
async function analyzeCurrentFileWithGraph() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const memgraph = new MemgraphService();
  await memgraph.initialize();

  try {
    // Index workspace
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (workspace) {
      await memgraph.indexProject(workspace.uri.fsPath);
    }

    // Find deprecated APIs in current file
    const deprecatedApis = await findDeprecatedApis(editor.document);

    // Get graph context for each
    for (const api of deprecatedApis) {
      const context = await memgraph.getDeprecationContext(api.name);
      
      // Show impact
      vscode.window.showInformationMessage(
        `${api.name}: Used in ${context.length} locations`
      );
    }
  } finally {
    await memgraph.shutdown();
  }
}
```

### Step 3: Add CLI Command

```bash
# New command
autochub analyze src/ --with-graph --show-impact

# Output
Analyzing with Memgraph...
✓ Indexed 150 files

Deprecated APIs Found:
  1. ChatCompletion.create
     - Used in: 12 files
     - Functions: 8
     - Risk Score: 75%
     - Replacement: client.chat.completions.create

  2. ReactDOM.render
     - Used in: 5 files
     - Functions: 3
     - Risk Score: 45%
     - Replacement: createRoot().render()
```

## Performance Tips

### Optimize for Large Codebases

```typescript
// 1. Create indexes
await client.execute(`
  CREATE INDEX ON :File(path);
  CREATE INDEX ON :Function(name);
  CREATE INDEX ON :DeprecatedAPI(name);
`);

// 2. Batch operations
async function batchIndex(files: string[]) {
  const nodes = files.map(f => parseFile(f));
  const query = `
    UNWIND $nodes as node
    CREATE (n:File {path: node.path, language: node.language})
  `;
  await client.execute(query, { nodes });
}

// 3. Cache results
const cache = new Map();
async function getCachedContext(apiName: string) {
  if (cache.has(apiName)) return cache.get(apiName);
  const result = await getDeprecationContext(apiName);
  cache.set(apiName, result);
  return result;
}
```

## Troubleshooting

### Connection Issues
```bash
# Check if Memgraph is running
docker ps | grep memgraph

# Restart
docker restart memgraph

# Check logs
docker logs memgraph
```

### Query Performance
```cypher
# Analyze query plan
EXPLAIN MATCH (f:File)-[:DEPENDS_ON]->(f2:File) RETURN f.path;

# Check indexes
SHOW INDEX INFO;

# Add missing index
CREATE INDEX ON :File(path);
```

### Memory Issues
```bash
# Increase Docker memory
docker run -m 4g -p 7687:7687 memgraph/memgraph
```

## Next Steps

1. **Start Local**: Run Memgraph in Docker
2. **Parse Code**: Implement AST parser for your language
3. **Build Graph**: Index your project
4. **Query**: Run analysis queries
5. **Integrate**: Add to VS Code extension
6. **Visualize**: Create dependency graphs
7. **Automate**: Add to CI/CD pipeline

## Resources

- [Memgraph Docs](https://memgraph.com/docs)
- [Cypher Query Language](https://memgraph.com/docs/cypher-manual)
- [Memgraph Python Client](https://github.com/memgraph/pymgclient)
- [Memgraph JavaScript Client](https://github.com/memgraph/memgraph-js)

