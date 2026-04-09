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
  private initialized = false;

  constructor(host?: string, port?: number) {
    this.memgraph = new MemgraphClient(host, port);
    this.parser = new CodeParser();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.memgraph.connect();
      await this.memgraph.createSchema();
      this.analyzer = new CodeAnalyzer(this.memgraph);
      this.initialized = true;
      console.log('[MemgraphService] Initialized successfully');
    } catch (error) {
      console.error('[MemgraphService] Initialization failed:', error);
      throw error;
    }
  }

  async indexProject(projectPath: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    const files = this.findSourceFiles(projectPath);
    console.log(`[MemgraphService] Indexing ${files.length} files...`);

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
        console.error(`[MemgraphService] Error indexing ${file}:`, error);
      }
    }

    console.log('[MemgraphService] Indexing complete');
  }

  async getDeprecationContext(apiName: string): Promise<DeprecationContext> {
    if (!this.initialized) await this.initialize();
    return await this.analyzer.getDeprecationContext(apiName);
  }

  async findAllDeprecatedApis(): Promise<any[]> {
    if (!this.initialized) await this.initialize();

    const query = `
      MATCH (api:DEPRECATEDAPI)
      RETURN api.name, COUNT(*) as usageCount
      ORDER BY usageCount DESC
    `;

    try {
      return await this.memgraph.execute(query);
    } catch {
      return [];
    }
  }

  async generateReport(): Promise<any> {
    if (!this.initialized) await this.initialize();

    const query = `
      MATCH (api:DEPRECATEDAPI)<-[:USES]-(func:FUNCTION)<-[:DEFINES]-(file:FILE)
      RETURN 
        file.path,
        COUNT(DISTINCT api) as apiCount,
        COUNT(func) as functionCount
      ORDER BY functionCount DESC
    `;

    try {
      const results = await this.memgraph.execute(query);
      return {
        totalFiles: results.length,
        totalDeprecations: results.reduce((sum: number, r: any) => sum + r.apiCount, 0),
        files: results,
      };
    } catch {
      return { totalFiles: 0, totalDeprecations: 0, files: [] };
    }
  }

  async shutdown(): Promise<void> {
    await this.memgraph.disconnect();
    this.initialized = false;
  }

  private findSourceFiles(projectPath: string): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'out'];

    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name.startsWith('.') || excludeDirs.includes(entry.name)) continue;

          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.error(`[MemgraphService] Error reading directory ${dir}:`, error);
      }
    };

    walk(projectPath);
    return files;
  }
}
