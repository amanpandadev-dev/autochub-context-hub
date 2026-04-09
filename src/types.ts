export interface ChubContext {
  api: string;
  endpoint: string;
  deprecated: string[];
  version: string;
  notes: string;
  authoritativeDocs: string;
}

export interface Annotation {
  id: string;
  tag: 'deprecated_fix' | 'note' | 'warning';
  from?: string;
  to?: string;
  content: string;
  confidence: number;
  timestamp: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface MethodComparison {
  generatedCode: string;
  explanation: string;
  qualityScore: number;
  qualitySummary: string;
  tokenUsage: TokenUsage;
}

export interface QualityComparison {
  legacy: MethodComparison;
  latest: MethodComparison;
  winner: 'legacy' | 'latest' | 'tie';
  summary: string;
  qualityDelta: number;
  tokenDelta: number;
}

export interface GenerationResult {
  originalPrompt: string;
  context: ChubContext;
  generatedCode: string;
  explanation: string;
  annotations: Annotation[];
  comparison: QualityComparison;
}
