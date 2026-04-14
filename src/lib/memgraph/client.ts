import Graph from 'graphology';
import { NodeAttributes, EdgeAttributes, EdgeType, NodeType } from './types';

/**
 * In-memory graph engine powered by graphology.
 * Replaces the Memgraph/neo4j-driver dependency — no server or Docker required.
 * API is intentionally kept close to what the Memgraph client exposed so the
 * rest of the layer needs minimal changes.
 */
export class GraphEngine {
  public graph: Graph<NodeAttributes, EdgeAttributes>;
  private nodeIndex = 0;

  constructor() {
    this.graph = new Graph({ multi: true, type: 'directed' });
  }

  /** Reset the graph (e.g. before re-indexing a project) */
  clear(): void {
    this.graph.clear();
    this.nodeIndex = 0;
  }

  // ── Node helpers ───────────────────────────────────────────────────────────

  /** Returns a stable node key from type + name + path */
  private nodeKey(type: NodeType, name: string, path?: string): string {
    return `${type}::${path ?? ''}::${name}`;
  }

  /** Add or retrieve a node; returns the node key */
  addNode(type: NodeType, name: string, extra: Partial<NodeAttributes> = {}): string {
    const key = this.nodeKey(type, name, extra.path);
    if (!this.graph.hasNode(key)) {
      this.graph.addNode(key, { type, name, ...extra });
    }
    return key;
  }

  /** Add a directed edge between two node keys (skips duplicates) */
  addEdge(fromKey: string, toKey: string, type: EdgeType, extra: Partial<EdgeAttributes> = {}): void {
    // Avoid duplicate edges of the same type between the same pair
    const existing = this.graph.edges(fromKey, toKey).find(e => this.graph.getEdgeAttribute(e, 'type') === type);
    if (!existing) {
      this.graph.addDirectedEdge(fromKey, toKey, { type, ...extra });
    }
  }

  hasNode(key: string): boolean {
    return this.graph.hasNode(key);
  }

  getNodeAttr(key: string): NodeAttributes {
    return this.graph.getNodeAttributes(key);
  }

  /** Get all nodes of a specific type */
  nodesOfType(type: NodeType): string[] {
    const result: string[] = [];
    this.graph.forEachNode((key, attrs) => {
      if (attrs.type === type) result.push(key);
    });
    return result;
  }

  /** Get all nodes that have an outgoing edge of `edgeType` to `targetKey` */
  predecessorsViaEdge(targetKey: string, edgeType: EdgeType): string[] {
    const result: string[] = [];
    this.graph.forEachInEdge(targetKey, (edge, attrs, source) => {
      if (attrs.type === edgeType) result.push(source);
    });
    return result;
  }

  /** Get all nodes that `sourceKey` points to via `edgeType` */
  successorsViaEdge(sourceKey: string, edgeType: EdgeType): string[] {
    const result: string[] = [];
    this.graph.forEachOutEdge(sourceKey, (edge, attrs, _src, target) => {
      if (attrs.type === edgeType) result.push(target);
    });
    return result;
  }

  /**
   * BFS from `startKey` following `edgeType` edges.
   * Returns an array of { key, depth, path } for each reachable node.
   */
  bfs(
    startKey: string,
    edgeType: EdgeType,
    maxDepth = 5
  ): Array<{ key: string; depth: number; chain: string[] }> {
    const visited = new Set<string>();
    const queue: Array<{ key: string; depth: number; chain: string[] }> = [
      { key: startKey, depth: 0, chain: [startKey] },
    ];
    const results: Array<{ key: string; depth: number; chain: string[] }> = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.key)) continue;
      visited.add(current.key);

      if (current.depth > 0) results.push(current);
      if (current.depth >= maxDepth) continue;

      // Traverse in reverse (callers of current node)
      this.graph.forEachInEdge(current.key, (edge, attrs, source) => {
        if (attrs.type === edgeType && !visited.has(source)) {
          queue.push({
            key: source,
            depth: current.depth + 1,
            chain: [...current.chain, source],
          });
        }
      });
    }

    return results;
  }
}
