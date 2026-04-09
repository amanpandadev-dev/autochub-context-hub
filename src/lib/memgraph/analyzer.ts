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

  async suggestRefactoringPath(fromApi: string, toApi: string): Promise<RefactoringPath> {
    const usages = await this.memgraph.findDeprecatedUsages(fromApi);

    const steps = [
      `Update ${usages.length} usages of ${fromApi}`,
      `Replace with ${toApi}`,
      `Run tests to verify functionality`,
      `Update documentation`,
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
