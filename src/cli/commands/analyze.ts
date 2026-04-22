#!/usr/bin/env node
import * as path from 'path';
import * as fs from 'fs';
import { MemgraphService } from '../../lib/memgraph/service';
import { AnalysisReport, Finding, Severity } from '../../lib/memgraph/types';
import { spawn } from 'child_process';
import { GithubCache } from '../../lib/github/cache';

interface AnalyzeOptions {
  withGraph?: boolean;
  lang?: string;
  output?: string;
  severity?: string;
  exclude?: string;
  maxResults?: string;
  rules?: string;
  useChub?: boolean;
}

const SEVERITY_ICON: Record<Severity, string> = {
  critical: '🔴',
  high:     '🟠',
  medium:   '🟡',
  low:      '🔵',
};

export async function analyzeCommand(projectPath: string = '.', options: AnalyzeOptions) {
  const resolvedPath = path.resolve(projectPath);
  const fmt = options.output ?? 'table';

  if (fmt !== 'json') {
    console.log('\n📊  Auto-CHUB Analyzer\n');
    console.log(`📁  Scanning: ${resolvedPath}`);
    if (options.withGraph) console.log('🔗  Graph propagation: enabled');
    if (options.severity)  console.log(`🎯  Severity filter: ${options.severity}`);
    console.log();
  }

  // Background sync check
  try {
    const cache = new GithubCache();
    if (cache.isCacheExpired()) {
      const child = spawn(process.argv[0], [process.argv[1], 'sync', '--github', '--bg'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      // Only notify if not outputting json
      if (options.output !== 'json') {
         console.log('🔄  [Background] Refreshing offline GitHub docs cache natively...');
      }
    }
  } catch (e) {
    // Ignore cache errors in background trigger
  }

  // Load custom rules from file if provided
  const configRules = MemgraphService.loadConfigRules(resolvedPath);
  let extraRules = configRules;
  if (options.rules) {
    try {
      const raw = fs.readFileSync(path.resolve(options.rules), 'utf-8');
      const parsed = JSON.parse(raw);
      extraRules = [...configRules, ...(Array.isArray(parsed) ? parsed : parsed.rules ?? [])];
    } catch (e) {
      console.warn(`⚠️  Could not load rules file: ${options.rules}`);
    }
  }

  const service = new MemgraphService(extraRules);

  try {
    const report = await service.analyze(resolvedPath, {
      withGraph: options.withGraph,
      lang: options.lang,
      severity: options.severity,
      exclude: options.exclude?.split(','),
      maxResults: options.maxResults ? parseInt(options.maxResults, 10) : undefined,
      useChub: options.useChub,
    });

    // ── Output ──────────────────────────────────────────────────────────────
    if (fmt === 'json') {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    if (fmt === 'markdown') {
      printMarkdown(report, resolvedPath);
      return;
    }

    // Default: pretty table
    printTable(report);

  } catch (err: any) {
    console.error('❌  Analysis failed:', err?.message ?? err);
    process.exit(1);
  }
}

// ── Pretty table output ───────────────────────────────────────────────────────

function printTable(report: AnalysisReport) {
  if (report.totalFindings === 0) {
    console.log('✅  No deprecated APIs found! Your codebase looks clean.\n');
    printSummaryLine(report);
    return;
  }

  for (const file of report.files) {
    const rel = file.filePath;
    console.log(`\n── ${rel}  (risk: ${file.riskScore}%)`);
    console.log('─'.repeat(72));

    for (const f of file.findings) {
      const icon = SEVERITY_ICON[f.severity] ?? '⚪';
      const depth = f.propagationDepth > 0 ? ` [indirect +${f.propagationDepth}]` : '';
      console.log(`  ${icon} [${f.severity.toUpperCase()}] ${f.title}${depth}`);
      console.log(`     Line ${f.line}:${f.col}  ${f.snippet}`);
      console.log(`     💡 ${f.guidance}`);
      console.log(`     ✨ Replace with: ${f.replacement}`);
      if (f.docsUrl) console.log(`     📖 ${f.docsUrl}`);
      if (f.localDocPath) console.log(`     💾 Local doc: ${f.localDocPath}`);
      if (f.propagationChain.length > 0) {
        console.log(`     🔗 Chain: ${f.propagationChain.join(' → ')}`);
      }
      console.log();
    }
  }

  printSummaryLine(report);
}

function printSummaryLine(report: AnalysisReport) {
  console.log('─'.repeat(72));
  console.log(
    `📊  Summary  |  Files scanned: ${report.scannedFiles}` +
    `  |  Findings: ${report.totalFindings}` +
    `  |  🔴 ${report.criticalCount}  🟠 ${report.highCount}` +
    `  🟡 ${report.mediumCount}  🔵 ${report.lowCount}` +
    `  |  ⏱ ${report.durationMs}ms`
  );
  console.log();
}

// ── Markdown report ───────────────────────────────────────────────────────────

function printMarkdown(report: AnalysisReport, scanPath: string) {
  const lines: string[] = [];
  lines.push(`# Deprecated API Report`);
  lines.push(`\n> Scanned: \`${scanPath}\`  |  Files: ${report.scannedFiles}  |  Total findings: ${report.totalFindings}`);
  lines.push(`\n## Summary\n`);
  lines.push(`| Severity | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| 🔴 Critical | ${report.criticalCount} |`);
  lines.push(`| 🟠 High     | ${report.highCount} |`);
  lines.push(`| 🟡 Medium   | ${report.mediumCount} |`);
  lines.push(`| 🔵 Low      | ${report.lowCount} |`);

  for (const file of report.files) {
    lines.push(`\n---\n`);
    lines.push(`## \`${file.filePath}\`  — Risk score: ${file.riskScore}%\n`);
    lines.push(`| # | Severity | Rule | Line | Snippet | Fix |`);
    lines.push(`|---|----------|------|------|---------|-----|`);
    file.findings.forEach((f, i) => {
      const depth = f.propagationDepth > 0 ? ` *(indirect)*` : '';
      lines.push(`| ${i + 1} | ${SEVERITY_ICON[f.severity]} ${f.severity} | ${f.title}${depth} | ${f.line} | \`${f.snippet.slice(0, 60)}\` | ${f.replacement} |`);
    });
  }

  lines.push(`\n---\n_Generated by autochub in ${report.durationMs}ms_\n`);
  console.log(lines.join('\n'));
}
