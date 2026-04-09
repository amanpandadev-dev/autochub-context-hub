import { CodeNode, CodeRelationship, UsageInfo } from './types';

export class MemgraphClient {
  private connected = false;
  private client: any;

  constructor(
    private host: string = 'localhost',
    private port: number = 7687
  ) {}

  async connect(): Promise<void> {
    try {
      // Lazy load memgraph client
      const { Client } = await import('memgraph');
      this.client = new Client({
        host: this.host,
        port: this.port,
        username: 'memgraph',
        password: 'memgraph',
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
    if (!this.connected) return false;
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
    ];

    for (const query of queries) {
      try {
        await this.client.execute(query);
      } catch {
        // Index might already exist
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
      console.error('[Memgraph] Query failed:', error);
      throw error;
    }
  }

  async addNode(node: CodeNode): Promise<void> {
    const query = `
      CREATE (n:${node.type.toUpperCase()} {
        name: $name,
        path: $path,
        line: $line,
        metadata: $metadata
      })
    `;

    await this.execute(query, {
      name: node.name,
      path: node.path || '',
      line: node.line || 0,
      metadata: JSON.stringify(node.metadata || {}),
    });
  }

  async addRelationship(rel: CodeRelationship): Promise<void> {
    const query = `
      MATCH (from {name: $fromName}), (to {name: $toName})
      CREATE (from)-[:${rel.type}]->(to)
    `;

    try {
      await this.execute(query, {
        fromName: rel.from.name,
        toName: rel.to.name,
      });
    } catch {
      // Relationship might already exist
    }
  }

  async findDeprecatedUsages(apiName: string): Promise<UsageInfo[]> {
    const query = `
      MATCH (api:DEPRECATEDAPI {name: $apiName})<-[:USES]-(func:FUNCTION)<-[:DEFINES]-(file:FILE)
      RETURN func.name as functionName, file.path as filePath, func.line as lineNumber
    `;

    try {
      const results = await this.execute(query, { apiName });
      return results.map(r => ({
        functionName: r.functionName,
        filePath: r.filePath,
        lineNumber: r.lineNumber,
      }));
    } catch {
      return [];
    }
  }

  async findImpactedFiles(apiName: string): Promise<string[]> {
    const query = `
      MATCH (api:DEPRECATEDAPI {name: $apiName})<-[:USES]-(func:FUNCTION)<-[:DEFINES]-(file:FILE)
      RETURN DISTINCT file.path as filePath
    `;

    try {
      const results = await this.execute(query, { apiName });
      return results.map(r => r.filePath);
    } catch {
      return [];
    }
  }

  async findDependencyChain(fromFile: string, toFile: string): Promise<string[][]> {
    const query = `
      MATCH path = (from:FILE {path: $fromFile})-[:DEPENDS_ON*]->(to:FILE {path: $toFile})
      RETURN [node IN nodes(path) | node.path] as chain
    `;

    try {
      const results = await this.execute(query, { fromFile, toFile });
      return results.map(r => r.chain);
    } catch {
      return [];
    }
  }
}
