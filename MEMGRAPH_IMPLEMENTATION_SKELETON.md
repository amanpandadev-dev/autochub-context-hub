# Memgraph Implementation Skeleton

This guide provides ready-to-use code templates for integrating Memgraph into Auto-CHUB.

## File Structure

```
src/lib/memgraph/
├── client.ts           # Memgraph connection & queries
├── parser.ts           # AST parsing for code extraction
├── analyzer.ts         # Graph analysis & queries
├── service.ts          # High-level service API
└── types.ts            # TypeScript interfaces
```

## 1. Types Definition (types.ts)

```typescript
export interface CodeNode {
  id?: string;
  type: 'file' | 'function' | 'class' | 'import' | 'variable' | 'deprecatedapi';
  name: string;
  path?: string;
  line?: number;
  column?: number;
  metadata?: Record<string, any>;
}

export interface CodeRelationship {
  from: CodeNode;
  to: CodeNode;
  type: 'DEFINES' | 'CALLS' | 'USES' | 'IMPORTS' | 'DEPENDS_ON' | 'EXTENDS';
  metadata?: Record<string, any>;
}

export interface DeprecationContext {
  apiName: string;
  totalUsages: number;
  impactedFiles: number;
  riskScore: number;
  usages: UsageInfo[];
  refactoringPath: RefactoringPath;
}

export interface UsageInfo {
  functionName: string;
  filePath: string;
  lineNumber: number;
}

export interface RefactoringPath {
  from: string;
  to: string;
  steps: string[];
  estimatedEffort: 'Low' | 'Medium' | 'High';
}

export interface ImpactReport {
  apiName: string;
  totalUsages: number;
  impactedFiles: string[];
  riskScore: number;
  usagesByFile: Record<string, number>;
}
```

## 2. Memgraph Client (client.ts)

```typescript
import { Client } from 'memgraph';

export class MemgraphClient {
  private client: Client;
  private connected = false;

  constructor(
    private host: string = 'localhost',
    private port: number = 7687,
    private username: string = 'memgraph',
    private password: string = 'memgraph'
  ) {}

  async connect(): Promise<void> {
    try {
      this.client = new Client({
        host: this.host,
        port: this.port,
        username: this.username,
        password: this.password,
      });
      await this.client.connect();
      this.connected = true;
      console.log('[Memgraph] Connected successfully');
    } catch (error) {
      console.error('[Memgraph] Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected && this.client) {
      await this.client.disconnect();
      this.connected = false;
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.client.execute('RETURN 1');
      return true;
    } catch {
      return false;
    }
  }

  async createSchema(): Promise<void> {
    const queries = [
      'CREATE INDEX ON :File(path)',
      'CREATE INDEX ON :Function(name)',
      'CREATE INDEX ON :Class(name)',
      'CREATE INDEX ON :DeprecatedAPI(name)',
      'CREATE INDEX ON :Import(module)',
    ];

    for (const query of queries) {
      try {
        await this.client.execute(query);
      } catch (error) {
        // Index might already exist
        console.log(`[Memgraph] Index creation note: ${error}`);
      }
    }
  }

  async clearDatabase(): Promise<void> {
    await this.client.execute('MATCH (n) DETACH DELETE n');
  }

  async execute(query: string, params?: Record<string, any>): Promise<any[]> {
    try {
      const result = await this.client.execute(query, params);
      return result;
    } catch (error) {
      console.error('[Memgraph] Query execution failed:', error);
      throw error;
    }
  }

  async addNode(node: CodeNode): Promise<void> {
    const query = `
      CREATE (n:${node.type.toUpperCase()} {
        name: $name,
        path: $path,
        line: $line,
        column: $column,
        metadata: $metadata
      })
      RETURN n
    `;

    await this.execute(query, {
      name: node.name,
      path: node.path || '',
      line: node.line || 0,
      column: node.column || 0,
      metadata: JSON.stringify(node.metadata || {}),
    });
  }

  async addRelationship(rel: CodeRelationship): Promise<void> {
    const query = `
      MATCH (from {name: $fromName}), (to {name: $toName})
      CREATE (from)-[:${rel.type}]->(to)
    `;

    await this.execute(query, {
      fromName: rel.from.name,
      toName: rel.to.name,
    });
  }

  async findDeprecatedUsages(apiName: string): Promise<UsageInfo[]> {
    const query = `
      MATCH (api:DEPRECATEDAPI {name: $apiName})<-[:USES]-(func:FUNCTION)<-[:DEFINES]-(file:FILE)
      RETURN func.name as functionName, file.path as filePath, func.line as lineNumber
    `;

    const results = await this.execute(query, { apiName });
    return results.map(r => ({
      functionName: r.functionName,
      filePath: r.filePath,
      lineNumber: r.lineNumber,
    }));
  }

  async findImpactedFiles(apiName: string): Promise<string[]> {
    const query = `
      MATCH (api:DEPRECATEDAPI {name: $apiName})<-[:USES]-(func:FUNCTION)<-[:DEFINES]-(file:FILE)
      RETURN DISTINCT file.path as filePath
    `;

    const results = await this.execute(query, { apiName });
    return results.map(r => r.filePath);
  }

  async findDependencyChain(fromFile: string, toFile: string): Promise<string[][]> {
    const query = `
      MATCH path = (from:FILE {path: $fromFile})-[:DEPENDS_ON*]->(to:FILE {path: $toFile})
      RETURN [node IN nodes(path) | node.path] as chain
    `;

    const results = await this.execute(query, { fromFile, toFile });
    return results.map(r => r.chain);
  }
}
```

## 3. Code Parser (parser.ts)

```typescript
import * as ts from 'typescript';
import * as fs from 'fs';
import { CodeNode, CodeRelationship } from './types';

export class CodeParser {
  parseFile(filePath: string): { nodes: CodeNode[]; relationships: CodeRelationship[] } {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const nodes: CodeNode[] = [];
    const relationships: CodeRelationship[] = [];

    // Add file node
    const fileNode: CodeNode = {
      type: 'file',
      name: filePath.split('/').pop() || filePath,
      path: filePath,
    };
    nodes.push(fileNode);

    // Visit all nodes
    this.visitNode(sourceFile, nodes, relationships, fileNode);

    return { nodes, relationships };
  }

  private visitNode(
    node: ts.Node,
    nodes: CodeNode[],
    relationships: CodeRelationship[],
    parentFile: CodeNode
  ): void {
    // Extract functions
    if (ts.isFunctionDeclaration(node)) {
      const funcNode = this.extractFunction(node, parentFile);
      nodes.push(funcNode);
      relationships.push({
        from: parentFile,
        to: funcNode,
        type: 'DEFINES',
      });
    }

    // Extract classes
    if (ts.isClassDeclaration(node)) {
      const classNode = this.extractClass(node, parentFile);
      nodes.push(classNode);
      relationships.push({
        from: parentFile,
        to: classNode,
        type: 'DEFINES',
      });
    }

    // Extract imports
    if (ts.isImportDeclaration(node)) {
      const importNode = this.extractImport(node, parentFile);
      if (importNode) {
        nodes.push(importNode);
        relationships.push({
          from: parentFile,
          to: importNode,
          type: 'IMPORTS',
        });
      }
    }

    // Extract function calls
    if (ts.isCallExpression(node)) {
      const callInfo = this.extractCall(node);
      if (callInfo) {
        // Create relationship for function calls
        // This would need context about current function
      }
    }

    ts.forEachChild(node, child => this.visitNode(child, nodes, relationships, parentFile));
  }

  private extractFunction(node: ts.FunctionDeclaration, parentFile: CodeNode): CodeNode {
    const sourceFile = node.getSourceFile();
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    return {
      type: 'function',
      name: node.name?.text || 'anonymous',
      path: sourceFile.fileName,
      line: line + 1,
      metadata: {
        isAsync: node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false,
        parameters: node.parameters.map(p => ({
          name: p.name?.getText(),
          type: p.type?.getText(),
        })),
        returnType: node.type?.getText(),
      },
    };
  }

  private extractClass(node: ts.ClassDeclaration, parentFile: CodeNode): CodeNode {
    const sourceFile = node.getSourceFile();
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    return {
      type: 'class',
      name: node.name?.text || 'anonymous',
      path: sourceFile.fileName,
      line: line + 1,
      metadata: {
        methods: node.members
          .filter(ts.isMethodDeclaration)
          .map(m => m.name?.getText()),
        extends: node.heritageClauses
          ?.find(h => h.token === ts.SyntaxKind.ExtendsKeyword)
          ?.types.map(t => t.expression.getText()),
      },
    };
  }

  private extractImport(node: ts.ImportDeclaration, parentFile: CodeNode): CodeNode | null {
    const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
    const sourceFile = node.getSourceFile();
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    return {
      type: 'import',
      name: moduleSpecifier,
      path: sourceFile.fileName,
      line: line + 1,
      metadata: {
        bindings: node.importClause?.namedBindings?.getText(),
        defaultBinding: node.importClause?.name?.text,
      },
    };
  }

  private extractCall(node: ts.CallExpression): any {
    const expression = node.expression.getText();
    return {
      expression,
      arguments: node.arguments.map(arg => arg.getText()),
    };
  }
}
```

## 4. Analyzer (analyzer.ts)

```typescript
import { MemgraphClient } from './client';
import { DeprecationContext, ImpactReport, RefactoringPath } from './types';

export class CodeAnalyzer {
  constructor(private memgraph: MemgraphClient) {}

  async analyzeDeprecationImpact(apiName: string): Promise<ImpactReport> {
    const usages = await this.memgraph.findDeprecatedUsages(apiName);
    const impactedFiles = await this.memgraph.findImpactedFiles(apiName);

    const usagesByFile: Record<string, number> = {};
    usages.forEach(usage => {
      usagesByFile[usage.filePath] = (usagesByFile[usage.filePath] || 0) + 1;
    });

    const riskScore = this.calculateRiskScore(usages.length, impactedFiles.length);

    return {
      apiName,
      totalUsages: usages.length,
      impactedFiles,
      riskScore,
      usagesByFile,
    };
  }

  async findSimilarPatterns(pattern: string): Promise<any[]> {
    const query = `
      MATCH (func:FUNCTION)-[:USES]->(api:DEPRECATEDAPI)
      WHERE api.name CONTAINS $pattern
      RETURN func.name, api.name, COUNT(*) as frequency
      ORDER BY frequency DESC
      LIMIT 10
    `;

    return await this.memgraph.execute(query, { pattern });
  }

  async suggestRefactoringPath(fromApi: string, toApi: string): Promise<RefactoringPath> {
    const usages = await this.memgraph.findDeprecatedUsages(fromApi);

    const steps = [
      `Update ${usages.length} usages of ${fromApi}`,
      `Replace with ${toApi}`,
      `Run tests to verify functionality`,
      `Update documentation and comments`,
    ];

    const effort = this.estimateEffort(usages.length);

    return {
      from: fromApi,
      to: toApi,
      steps,
      estimatedEffort: effort,
    };
  }

  async getDeprecationContext(apiName: string): Promise<DeprecationContext> {
    const impact = await this.analyzeDeprecationImpact(apiName);
    const usages = await this.memgraph.findDeprecatedUsages(apiName);

    return {
      apiName,
      totalUsages: impact.totalUsages,
      impactedFiles: impact.impactedFiles.length,
      riskScore: impact.riskScore,
      usages,
      refactoringPath: await this.suggestRefactoringPath(apiName, 'recommended'),
    };
  }

  private calculateRiskScore(usageCount: number, fileCount: number): number {
    const baseScore = Math.min(100, (usageCount * fileCount) / 10);
    return Math.round(baseScore);
  }

  private estimateEffort(usageCount: number): 'Low' | 'Medium' | 'High' {
    if (usageCount <= 3) return 'Low';
    if (usageCount <= 10) return 'Medium';
    return 'High';
  }
}
```

## 5. Service (service.ts)

```typescript
import { MemgraphClient } from './client';
import { CodeParser } from './parser';
import { CodeAnalyzer } from './analyzer';
import { DeprecationContext } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class MemgraphService {
  private memgraph: MemgraphClient;
  private parser: CodeParser;
  private analyzer: CodeAnalyzer;

  constructor(host?: string, port?: number) {
    this.memgraph = new MemgraphClient(host, port);
    this.parser = new CodeParser();
  }

  async initialize(): Promise<void> {
    await this.memgraph.connect();
    await this.memgraph.createSchema();
    this.analyzer = new CodeAnalyzer(this.memgraph);
  }

  async indexProject(projectPath: string): Promise<void> {
    const files = this.findSourceFiles(projectPath);

    console.log(`[Memgraph] Indexing ${files.length} files...`);

    for (const file of files) {
      try {
        const { nodes, relationships } = this.parser.parseFile(file);

        for (const node of nodes) {
          await this.memgraph.addNode(node);
        }

        for (const rel of relationships) {
          await this.memgraph.addRelationship(rel);
        }
      } catch (error) {
        console.error(`[Memgraph] Error indexing ${file}:`, error);
      }
    }

    console.log('[Memgraph] Indexing complete');
  }

  async getDeprecationContext(apiName: string): Promise<DeprecationContext> {
    return await this.analyzer.getDeprecationContext(apiName);
  }

  async findAllDeprecatedApis(): Promise<any[]> {
    const query = `
      MATCH (api:DEPRECATEDAPI)
      RETURN api.name, COUNT(*) as usageCount
      ORDER BY usageCount DESC
    `;

    return await this.memgraph.execute(query);
  }

  async generateReport(): Promise<any> {
    const query = `
      MATCH (api:DEPRECATEDAPI)<-[:USES]-(func:FUNCTION)<-[:DEFINES]-(file:FILE)
      RETURN 
        file.path,
        COUNT(DISTINCT api) as apiCount,
        COUNT(func) as functionCount
      ORDER BY functionCount DESC
    `;

    const results = await this.memgraph.execute(query);

    return {
      totalFiles: results.length,
      totalDeprecations: results.reduce((sum, r) => sum + r.apiCount, 0),
      files: results,
    };
  }

  async shutdown(): Promise<void> {
    await this.memgraph.disconnect();
  }

  private findSourceFiles(projectPath: string): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };

    walk(projectPath);
    return files;
  }
}
```

## Usage Example

```typescript
// main.ts
import { MemgraphService } from './lib/memgraph/service';

async function main() {
  const service = new MemgraphService();

  try {
    // Initialize
    await service.initialize();

    // Index project
    await service.indexProject('./src');

    // Analyze deprecations
    const deprecatedApis = await service.findAllDeprecatedApis();
    console.log('Deprecated APIs:', deprecatedApis);

    // Get context for specific API
    const context = await service.getDeprecationContext('ChatCompletion.create');
    console.log('Deprecation Context:', context);

    // Generate report
    const report = await service.generateReport();
    console.log('Report:', report);
  } finally {
    await service.shutdown();
  }
}

main().catch(console.error);
```

## Testing

```typescript
// test/memgraph.test.ts
import { MemgraphService } from '../src/lib/memgraph/service';

describe('MemgraphService', () => {
  let service: MemgraphService;

  beforeAll(async () => {
    service = new MemgraphService();
    await service.initialize();
  });

  afterAll(async () => {
    await service.shutdown();
  });

  test('should index project', async () => {
    await service.indexProject('./test-fixtures');
    const apis = await service.findAllDeprecatedApis();
    expect(apis.length).toBeGreaterThan(0);
  });

  test('should get deprecation context', async () => {
    const context = await service.getDeprecationContext('test-api');
    expect(context).toHaveProperty('apiName');
    expect(context).toHaveProperty('totalUsages');
  });
});
```

