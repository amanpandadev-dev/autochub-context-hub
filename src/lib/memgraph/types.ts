export interface CodeNode {
  id?: string;
  type: 'file' | 'function' | 'class' | 'import' | 'deprecatedapi';
  name: string;
  path?: string;
  line?: number;
  metadata?: Record<string, any>;
}

export interface CodeRelationship {
  from: CodeNode;
  to: CodeNode;
  type: 'DEFINES' | 'CALLS' | 'USES' | 'IMPORTS' | 'DEPENDS_ON';
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
