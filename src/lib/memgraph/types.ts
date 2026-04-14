// ─── Node / Edge types for the in-memory graph ───────────────────────────────

export type NodeType = 'file' | 'function' | 'class' | 'deprecatedapi' | 'api';

export interface NodeAttributes {
  type: NodeType;
  name: string;
  path?: string;
  line?: number;
  col?: number;
  snippet?: string;
  metadata?: Record<string, any>;
}

export type EdgeType = 'DEFINES' | 'CALLS' | 'USES' | 'IMPORTS' | 'DEPENDS_ON' | 'REPLACED_BY';

export interface EdgeAttributes {
  type: EdgeType;
  line?: number;
  snippet?: string;
}

// ─── Deprecation Rules ───────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Language = 'ts' | 'js' | 'py' | 'java' | 'go' | 'cs' | 'any';

export interface DeprecationRule {
  id: string;
  /** Display name */
  title: string;
  /** Regex string to match against source code */
  pattern: string;
  /** Regex flags (default: 'g') */
  flags?: string;
  /** Human-readable fix guidance */
  guidance: string;
  /** Replacement API name */
  replacement: string;
  severity: Severity;
  /** Applicable ecosystems / languages */
  languages: Language[];
  /** Documentation URL */
  docsUrl?: string;
}

// ─── Analysis Results ─────────────────────────────────────────────────────────

export interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  filePath: string;
  line: number;
  col: number;
  snippet: string;
  guidance: string;
  replacement: string;
  docsUrl?: string;
  /** How many call-graph hops away from a direct usage (0 = direct) */
  propagationDepth: number;
  /** Functions in the propagation chain */
  propagationChain: string[];
}

export interface FileReport {
  filePath: string;
  findings: Finding[];
  riskScore: number;
}

export interface AnalysisReport {
  scannedFiles: number;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  files: FileReport[];
  durationMs: number;
}

export interface UsageInfo {
  functionName: string;
  filePath: string;
  lineNumber: number;
  snippet?: string;
}

export interface DeprecationContext {
  apiName: string;
  totalUsages: number;
  impactedFiles: number;
  riskScore: number;
  usages: UsageInfo[];
}

export interface ImpactReport {
  apiName: string;
  totalUsages: number;
  impactedFiles: string[];
  riskScore: number;
  usagesByFile: Record<string, number>;
}
