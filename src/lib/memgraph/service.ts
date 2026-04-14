import * as fs from 'fs';
import * as path from 'path';
import { GraphEngine } from './client';
import { CodeParser } from './parser';
import { CodeAnalyzer } from './analyzer';
import { BUILTIN_RULES, langFromExt, rulesForLang } from './rules';
import { DeprecationRule, Finding, AnalysisReport } from './types';
import { ChubWrapper } from '../chub';

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.java', '.go', '.cs',
]);

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '__pycache__',
  '.next', '.nuxt', 'coverage', 'vendor', 'venv', 'env',
]);

export interface ScanOptions {
  withGraph?: boolean;
  lang?: string;
  severity?: string;
  exclude?: string[];
  maxResults?: number;
  customRules?: DeprecationRule[];
  useChub?: boolean;
}

/**
 * Top-level service that orchestrates scanning + graph analysis.
 * No external server required — everything runs in-process.
 */
export class MemgraphService {
  private graph: GraphEngine;
  private rules: DeprecationRule[];
  private chub: ChubWrapper;

  constructor(customRules: DeprecationRule[] = []) {
    this.graph = new GraphEngine();
    this.rules = [...BUILTIN_RULES, ...customRules];
    this.chub = new ChubWrapper();
  }

  /**
   * Scan a project directory (or single file) and return a full AnalysisReport.
   */
  async analyze(projectPath: string, options: ScanOptions = {}): Promise<AnalysisReport> {
    const start = Date.now();
    this.graph.clear();

    // Merge any extra custom rules
    if (options.customRules?.length) {
      this.rules = [...BUILTIN_RULES, ...options.customRules];
    }

    // Find files to scan
    const files = this.collectFiles(projectPath, options);
    const parser = new CodeParser(this.graph, this.rules);
    const analyzer = new CodeAnalyzer(this.graph);

    // Parse each file → direct findings + graph population
    let allDirect: Finding[] = [];
    for (const file of files) {
      const findings = parser.parseFile(file);
      allDirect.push(...findings);
    }

    // Apply severity filter
    if (options.severity) {
      const sev = options.severity.toLowerCase();
      allDirect = allDirect.filter(f => f.severity === sev || this.severityGte(f.severity, sev as any));
    }

    // Propagate through call graph (only when --with-graph)
    let allFindings = allDirect;
    if (options.withGraph) {
      allFindings = analyzer.propagate(allDirect);
    }

    // Enrich with CHUB documentation if enabled and available
    if (options.useChub && this.chub.isAvailable()) {
      console.log('📚  Enriching with Context Hub (chub) docs...');
      for (const finding of allFindings) {
        // Only search for high/critical or unique identifiers
        const docs = await this.chub.search(finding.ruleId.split('/').pop() || finding.title);
        if (docs && docs.length > 0) {
          // Add the first relevant DOC ID as our reference
          finding.docsUrl = finding.docsUrl || `https://aichub.org/v1/docs/${docs[0].id}`;
          finding.guidance = `${finding.guidance} (Ref: ${docs[0].name})`;
        }
      }
    }

    // Apply maxResults
    if (options.maxResults) {
      allFindings = allFindings.slice(0, options.maxResults);
    }

    const durationMs = Date.now() - start;
    return analyzer.buildReport(allFindings, files.length, durationMs);
  }

  // ── File collection ────────────────────────────────────────────────────────

  private collectFiles(target: string, options: ScanOptions): string[] {
    const stat = fs.statSync(target);
    if (stat.isFile()) return [target];

    const files: string[] = [];
    const excludeExtra = new Set(options.exclude ?? []);

    const walk = (dir: string) => {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { return; }

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (EXCLUDE_DIRS.has(entry.name) || excludeExtra.has(entry.name)) continue;

        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!SOURCE_EXTENSIONS.has(ext)) continue;

          // Language filter
          if (options.lang) {
            const lang = langFromExt(ext);
            if (lang !== options.lang && options.lang !== 'any') continue;
          }

          files.push(full);
        }
      }
    };

    walk(target);
    return files;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private severityGte(a: string, b: string): boolean {
    const order = ['low', 'medium', 'high', 'critical'];
    return order.indexOf(a) >= order.indexOf(b);
  }

  /** Load custom rules from a JSON config file if present */
  static loadConfigRules(projectPath: string): DeprecationRule[] {
    const configFile = path.join(projectPath, '.autochub.json');
    if (!fs.existsSync(configFile)) return [];
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      return Array.isArray(config.rules) ? config.rules : [];
    } catch {
      return [];
    }
  }
}
