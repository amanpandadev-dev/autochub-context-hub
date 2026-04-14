import { GraphEngine } from './client';
import { Finding, AnalysisReport, FileReport, Severity } from './types';

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 40,
  high: 20,
  medium: 10,
  low: 5,
};

/**
 * Graph-powered analysis engine.
 *
 * After the CodeParser has populated the in-memory graph, this class runs
 * graph traversal queries to:
 *  1. Identify all direct deprecated API usages
 *  2. Propagate findings to indirect callers (functions that transitively
 *     depend on deprecated code — impossible with a plain regex scan)
 *  3. Score each file by risk
 *  4. Build the final AnalysisReport
 */
export class CodeAnalyzer {
  constructor(private graph: GraphEngine) {}

  /**
   * Enrich direct findings with propagation data.
   * For each directly-found deprecated API node, BFS backwards through
   * CALLS edges to find all indirect callers up to `maxDepth` hops.
   */
  propagate(directFindings: Finding[], maxDepth = 5): Finding[] {
    const enriched = [...directFindings];

    // For every deprecated API node in the graph…
    const deprNodes = this.graph.nodesOfType('deprecatedapi');

    for (const deprKey of deprNodes) {
      // Who directly USES this API?
      const directCallers = this.graph.predecessorsViaEdge(deprKey, 'USES');

      for (const callerKey of directCallers) {
        // BFS backwards through CALLS edges to find indirect callers
        const indirectCallers = this.graph.bfs(callerKey, 'CALLS', maxDepth);

        for (const { key: indirectKey, depth, chain } of indirectCallers) {
          const attrs = this.graph.getNodeAttr(indirectKey);
          if (attrs.type !== 'function') continue;

          // Find the original finding for this depr node
          const original = directFindings.find(f =>
            f.ruleId === this.graph.getNodeAttr(deprKey).metadata?.rule?.id
          );
          if (!original) continue;

          // Don't double-add if same file+rule+line already exists
          const alreadyAdded = enriched.some(
            f =>
              f.filePath === (attrs.path ?? '') &&
              f.ruleId === original.ruleId &&
              f.propagationDepth > 0
          );
          if (alreadyAdded) continue;

          const chainNames = chain
            .map(k => {
              try { return this.graph.getNodeAttr(k).name; } catch { return k; }
            });

          enriched.push({
            ...original,
            filePath: attrs.path ?? original.filePath,
            line: attrs.line ?? original.line,
            col: 1,
            snippet: `[indirect via ${chainNames.slice(0, -1).join(' → ')}]`,
            propagationDepth: depth,
            propagationChain: chainNames,
          });
        }
      }
    }

    return enriched;
  }

  /**
   * Build the final AnalysisReport from a list of findings.
   */
  buildReport(findings: Finding[], scannedFiles: number, durationMs: number): AnalysisReport {
    // Group by file
    const byFile = new Map<string, Finding[]>();
    for (const f of findings) {
      if (!byFile.has(f.filePath)) byFile.set(f.filePath, []);
      byFile.get(f.filePath)!.push(f);
    }

    const files: FileReport[] = [];
    for (const [filePath, ff] of byFile) {
      const riskScore = Math.min(
        100,
        ff.reduce((acc, f) => {
          const w = SEVERITY_WEIGHT[f.severity] ?? 5;
          // Direct findings contribute full weight; indirect ones half
          return acc + (f.propagationDepth === 0 ? w : w * 0.5);
        }, 0)
      );
      files.push({ filePath, findings: ff, riskScore: Math.round(riskScore) });
    }

    // Sort files by risk score descending
    files.sort((a, b) => b.riskScore - a.riskScore);

    return {
      scannedFiles,
      totalFindings: findings.length,
      criticalCount: findings.filter(f => f.severity === 'critical').length,
      highCount: findings.filter(f => f.severity === 'high').length,
      mediumCount: findings.filter(f => f.severity === 'medium').length,
      lowCount: findings.filter(f => f.severity === 'low').length,
      files,
      durationMs,
    };
  }
}
