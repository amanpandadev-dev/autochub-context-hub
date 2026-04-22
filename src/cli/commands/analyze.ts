#!/usr/bin/env node
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import { MemgraphService } from '../../lib/memgraph/service';
import { AnalysisReport, Severity } from '../../lib/memgraph/types';
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
  report?: boolean;
  reportFile?: string;
  openReport?: boolean;
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

    const htmlReportPath = maybeWriteHtmlReport(report, resolvedPath, fmt, options);
    const openedReport = maybeOpenHtmlReport(htmlReportPath, fmt, options);

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
    printHtmlReportLine(htmlReportPath, openedReport);

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

function maybeWriteHtmlReport(
  report: AnalysisReport,
  scanPath: string,
  fmt: string,
  options: AnalyzeOptions
): string | undefined {
  const shouldWrite = options.report === true || Boolean(options.reportFile) || fmt === 'table';
  if (!shouldWrite || options.report === false) return undefined;

  try {
    const reportPath = resolveHtmlReportPath(scanPath, options.reportFile);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, renderHtmlReport(report, scanPath), 'utf8');
    return reportPath;
  } catch (error: any) {
    if (fmt === 'table') {
      console.warn(`Warning: could not write HTML report: ${error?.message ?? error}`);
    }
    return undefined;
  }
}

function maybeOpenHtmlReport(
  reportPath: string | undefined,
  fmt: string,
  options: AnalyzeOptions
): boolean {
  if (!reportPath) return false;
  if (options.openReport === false) return false;

  const shouldOpen = (fmt === 'table' || options.report === true) && Boolean(process.stdout.isTTY);
  if (!shouldOpen) return false;

  return openFile(reportPath);
}

function printHtmlReportLine(reportPath: string | undefined, opened: boolean): void {
  if (!reportPath) return;

  console.log(`Report saved: ${reportPath}`);
  if (opened) {
    console.log('Report opened in your default browser.\n');
  } else {
    console.log('Open the report file above to view the findings.\n');
  }
}

function resolveHtmlReportPath(scanPath: string, reportFile?: string): string {
  if (reportFile) return path.resolve(reportFile);

  const reportRoot = fs.statSync(scanPath).isDirectory()
    ? scanPath
    : path.dirname(scanPath);

  return path.join(reportRoot, '.autochub', 'reports', 'latest-findings.html');
}

function openFile(filePath: string): boolean {
  try {
    const command = process.platform === 'win32'
      ? 'cmd'
      : process.platform === 'darwin'
        ? 'open'
        : 'xdg-open';
    const args = process.platform === 'win32'
      ? ['/c', 'start', '', filePath]
      : [filePath];

    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function renderHtmlReport(report: AnalysisReport, scanPath: string): string {
  const generatedAt = new Date().toLocaleString();
  const fileSections = report.files.length > 0
    ? report.files.map((file, index) => renderHtmlFileSection(file, index)).join('\n')
    : `<section class="empty">
        <h2>No deprecated APIs found</h2>
        <p>The latest scan did not return any findings for this target.</p>
      </section>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Auto-CHUB Findings</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #f8fafc;
        --panel: #ffffff;
        --text: #111827;
        --muted: #64748b;
        --border: #dbe3ef;
        --code: #eef2f7;
        --link: #2563eb;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0f172a;
          --panel: #111827;
          --text: #e5e7eb;
          --muted: #94a3b8;
          --border: #243244;
          --code: #1f2937;
          --link: #60a5fa;
        }
      }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        max-width: 1180px;
        margin: 0 auto;
        padding: 28px 24px 44px;
      }
      header {
        border-bottom: 1px solid var(--border);
        padding-bottom: 18px;
        margin-bottom: 18px;
      }
      h1 {
        font-size: 28px;
        line-height: 1.2;
        margin: 0 0 8px;
      }
      h2 {
        font-size: 17px;
        margin: 0;
        overflow-wrap: anywhere;
      }
      a {
        color: var(--link);
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      .muted {
        color: var(--muted);
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 10px;
        margin-top: 18px;
      }
      .metric,
      .empty {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
      }
      .metric strong {
        display: block;
        font-size: 24px;
        line-height: 1.2;
      }
      .metric span {
        color: var(--muted);
        font-size: 12px;
      }
      .file {
        margin-top: 18px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
      }
      .file-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: baseline;
        margin-bottom: 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
      }
      th,
      td {
        border-bottom: 1px solid var(--border);
        padding: 10px;
        text-align: left;
        vertical-align: top;
      }
      tr:last-child td {
        border-bottom: 0;
      }
      th {
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
      }
      code {
        display: inline-block;
        max-width: 100%;
        background: var(--code);
        border-radius: 4px;
        padding: 2px 5px;
        overflow-wrap: anywhere;
      }
      .badge {
        display: inline-block;
        border-radius: 999px;
        padding: 2px 8px;
        color: white;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .critical { background: #dc2626; }
      .high { background: #ea580c; }
      .medium { background: #ca8a04; }
      .low { background: #2563eb; }
      .finding-title {
        font-weight: 700;
        margin-bottom: 4px;
      }
      .detail {
        color: var(--muted);
        margin-top: 5px;
      }
      .doc-links {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Auto-CHUB Findings</h1>
        <div class="muted">Scanned ${escapeHtml(scanPath)} on ${escapeHtml(generatedAt)}</div>
        <div class="summary">
          ${renderMetric(report.totalFindings, 'Findings')}
          ${renderMetric(report.scannedFiles, 'Files scanned')}
          ${renderMetric(report.criticalCount, 'Critical')}
          ${renderMetric(report.highCount, 'High')}
          ${renderMetric(report.mediumCount, 'Medium')}
          ${renderMetric(report.lowCount, 'Low')}
          ${renderMetric(`${report.durationMs}ms`, 'Scan time')}
        </div>
      </header>
      ${fileSections}
    </main>
  </body>
</html>`;
}

function renderMetric(value: string | number, label: string): string {
  return `<div class="metric"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderHtmlFileSection(file: AnalysisReport['files'][number], fileIndex: number): string {
  const rows = file.findings.map((finding, findingIndex) =>
    renderHtmlFindingRow(finding, file.filePath, fileIndex, findingIndex)
  ).join('\n');

  return `<section class="file">
    <div class="file-head">
      <h2>${escapeHtml(file.filePath)}</h2>
      <div class="muted">Risk ${file.riskScore}%</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Severity</th>
          <th>Location</th>
          <th>Finding</th>
          <th>Replacement</th>
          <th>Docs</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function renderHtmlFindingRow(
  finding: AnalysisReport['files'][number]['findings'][number],
  filePath: string,
  fileIndex: number,
  findingIndex: number
): string {
  const sourceHref = renderSourceHref(filePath, finding.line, finding.col);
  const chain = finding.propagationChain.length > 0
    ? `<div class="detail">Chain: ${escapeHtml(finding.propagationChain.join(' -> '))}</div>`
    : '';
  const depth = finding.propagationDepth > 0
    ? `<div class="detail">Indirect usage, depth ${finding.propagationDepth}</div>`
    : '';

  return `<tr id="finding-${fileIndex}-${findingIndex}">
    <td><span class="badge ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span></td>
    <td><a href="${escapeHtml(sourceHref)}">Line ${finding.line}:${finding.col}</a></td>
    <td>
      <div class="finding-title">${escapeHtml(finding.title)}</div>
      <code>${escapeHtml(finding.snippet || '')}</code>
      <div class="detail">${escapeHtml(finding.guidance || '')}</div>
      ${depth}
      ${chain}
    </td>
    <td>${escapeHtml(finding.replacement || 'Manual review')}</td>
    <td><div class="doc-links">${renderHtmlDocLinks(finding)}</div></td>
  </tr>`;
}

function renderHtmlDocLinks(finding: AnalysisReport['files'][number]['findings'][number]): string {
  const links: string[] = [];

  if (finding.localDocPath) {
    links.push(`<a href="${escapeHtml(pathToFileURL(finding.localDocPath).href)}">Offline docs</a>`);
  }

  if (finding.docsUrl) {
    links.push(`<a href="${escapeHtml(finding.docsUrl)}">Source docs</a>`);
  }

  return links.length > 0 ? links.join('') : '<span class="muted">No docs</span>';
}

function renderSourceHref(filePath: string, line: number, col: number): string {
  const normalized = path.resolve(filePath).replace(/\\/g, '/');
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `vscode://file${withLeadingSlash}:${line}:${col}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
