import { MemgraphService } from '../../lib/memgraph';
import * as fs from 'fs';
import * as path from 'path';

interface AnalyzeOptions {
  withGraph?: boolean;
  lang?: string;
  output?: string;
  severity?: string;
  exclude?: string;
  maxResults?: string;
  githubLinks?: boolean;
}

export async function analyzeCommand(projectPath: string = '.', options: AnalyzeOptions) {
  try {
    console.log('\n📊 Auto-CHUB Analyzer\n');
    console.log(`📁 Analyzing: ${path.resolve(projectPath)}\n`);

    if (options.withGraph) {
      await analyzeWithMemgraph(projectPath, options);
    } else {
      await analyzeWithoutMemgraph(projectPath, options);
    }
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

async function analyzeWithMemgraph(projectPath: string, options: AnalyzeOptions) {
  const service = new MemgraphService();

  try {
    console.log('🔗 Initializing Memgraph...');
    await service.initialize();
    console.log('✓ Memgraph connected\n');

    console.log('📁 Indexing project...');
    await service.indexProject(projectPath);
    console.log('✓ Project indexed\n');

    console.log('🔍 Analyzing with Memgraph...\n');

    // Get all deprecated APIs
    const deprecatedApis = await service.findAllDeprecatedApis();

    if (deprecatedApis.length === 0) {
      console.log('✓ No deprecated APIs found!\n');
      return;
    }

    // Analyze each API
    const results = [];
    for (const api of deprecatedApis) {
      const context = await service.getDeprecationContext(api.name);
      results.push({
        api: api.name,
        usages: context.totalUsages,
        files: context.impactedFiles,
        riskScore: context.riskScore,
        effort: context.refactoringPath.estimatedEffort,
        replacement: context.refactoringPath.to,
      });
    }

    // Sort by risk score
    results.sort((a, b) => b.riskScore - a.riskScore);

    // Display results
    console.log('📋 Deprecated APIs Found:\n');
    results.forEach((result, i) => {
      const riskColor = result.riskScore > 70 ? '🔴' : result.riskScore > 40 ? '🟡' : '🟢';
      console.log(`${i + 1}. ${result.api}`);
      console.log(`   ${riskColor} Risk Score: ${result.riskScore}%`);
      console.log(`   📊 Usages: ${result.usages} | Files: ${result.files}`);
      console.log(`   ⏱️  Effort: ${result.effort}`);
      console.log(`   ✨ Replacement: ${result.replacement}`);
      console.log();
    });

    // Generate report
    const report = await service.generateReport();
    console.log('📊 Summary:');
    console.log(`   Total Files: ${report.totalFiles}`);
    console.log(`   Total Deprecations: ${report.totalDeprecations}`);
    console.log(`   Files with Issues: ${report.files.length}\n`);

    // Output format
    if (options.output === 'json') {
      console.log(JSON.stringify(results, null, 2));
    }

    await service.shutdown();
  } catch (error) {
    console.error('❌ Memgraph analysis failed:', error);
    await service.shutdown();
    process.exit(1);
  }
}

async function analyzeWithoutMemgraph(projectPath: string, options: AnalyzeOptions) {
  console.log('📝 Basic analysis (without Memgraph)\n');
  console.log('💡 Tip: Use --with-graph for deep analysis with Memgraph\n');

  // Simple file scanning
  const files = findSourceFiles(projectPath);
  console.log(`Found ${files.length} source files\n`);

  const deprecatedPatterns = [
    'ChatCompletion.create',
    'ReactDOM.render',
    'new Buffer',
    'CancelToken',
  ];

  const findings: any[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of deprecatedPatterns) {
        if (content.includes(pattern)) {
          const lines = content.split('\n');
          lines.forEach((line, i) => {
            if (line.includes(pattern)) {
              findings.push({
                file,
                line: i + 1,
                pattern,
                code: line.trim(),
              });
            }
          });
        }
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }

  if (findings.length === 0) {
    console.log('✓ No deprecated APIs found!\n');
    return;
  }

  console.log('📋 Deprecated APIs Found:\n');
  findings.forEach((finding, i) => {
    console.log(`${i + 1}. ${finding.pattern}`);
    console.log(`   📄 File: ${finding.file}:${finding.line}`);
    console.log(`   📝 Code: ${finding.code}`);
    console.log();
  });

  if (options.output === 'json') {
    console.log(JSON.stringify(findings, null, 2));
  }
}

function findSourceFiles(projectPath: string): string[] {
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
      // Skip directories that can't be read
    }
  };

  walk(projectPath);
  return files;
}
