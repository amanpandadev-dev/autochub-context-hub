import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

let diagnosticCollection: vscode.DiagnosticCollection;
let cacheHealthStatusItem: vscode.StatusBarItem;
let cacheHealthRefreshTimer: NodeJS.Timeout | undefined;
let cacheHealthPanel: vscode.WebviewPanel | undefined;
let findingsReportPanel: vscode.WebviewPanel | undefined;
let runSequence = 0;
const latestRunByKey = new Map<string, number>();
const debounceTimers = new Map<string, NodeJS.Timeout>();

interface AnalyzerReport {
  scannedFiles?: number;
  totalFindings?: number;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  durationMs?: number;
  files?: AnalyzerFileReport[];
}

interface AnalyzerFileReport {
  filePath: string;
  findings: AnalyzerFinding[];
  riskScore?: number;
}

interface AnalyzerFinding {
  ruleId?: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  col: number;
  snippet: string;
  guidance: string;
  replacement: string;
  docsUrl?: string;
  localDocPath?: string;
  propagationDepth?: number;
  propagationChain?: string[];
}

interface CacheHealthReport {
  status: 'healthy' | 'stale' | 'missing' | 'empty';
  cachePath: string;
  docsDir: string;
  docsCount: number;
  lastUpdated?: number;
  ageMs?: number;
  sourceRepo?: string;
  sourceBranch?: string;
  maxAgeHours?: number;
}

interface CommandSpec {
  command: string;
  argsPrefix: string[];
}

interface CliExecResult {
  error: Error | null;
  stdout: string;
  stderr: string;
}

export function activate(context: vscode.ExtensionContext) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('auto-chub');
  context.subscriptions.push(diagnosticCollection);

  cacheHealthStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  cacheHealthStatusItem.command = 'autochub.showCacheHealth';
  cacheHealthStatusItem.text = '$(history) CHUB Cache';
  cacheHealthStatusItem.tooltip = 'Auto-CHUB offline cache health';
  cacheHealthStatusItem.show();
  context.subscriptions.push(cacheHealthStatusItem);

  context.subscriptions.push(
    vscode.commands.registerCommand('autochub.showCacheHealth', async () => {
      await refreshCacheHealth(true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('autochub.refreshCacheHealth', async () => {
      await refreshCacheHealth(false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('autochub.analyzeWorkspace', async () => {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('Auto-CHUB: open a workspace folder first.');
        return;
      }

      vscode.window.setStatusBarMessage('Auto-CHUB: analyzing workspace...', 4000);
      await runAnalyzerForPath(workspaceRoot, {
        clearAllDiagnostics: true,
        openReport: true,
        reportTitle: 'Workspace Findings',
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('autochub.analyzeCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.uri.scheme !== 'file') {
        vscode.window.showErrorMessage('Auto-CHUB: open a local source file first.');
        return;
      }
      await runAnalyzerForPath(editor.document.uri.fsPath, {
        specificUri: editor.document.uri,
        openReport: true,
        reportTitle: path.basename(editor.document.uri.fsPath),
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('autochub.syncDocs', async () => {
      await runDocsSync(true);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      scheduleFileAnalysis(doc);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      scheduleFileAnalysis(doc);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const config = vscode.workspace.getConfiguration('autochub');
      const runOnType = config.get<boolean>('runOnType', false);
      if (!runOnType) return;
      scheduleFileAnalysis(event.document);
    })
  );

  context.subscriptions.push({
    dispose: () => {
      for (const timer of debounceTimers.values()) clearTimeout(timer);
      debounceTimers.clear();
      if (cacheHealthRefreshTimer) {
        clearInterval(cacheHealthRefreshTimer);
        cacheHealthRefreshTimer = undefined;
      }
      cacheHealthPanel?.dispose();
      findingsReportPanel?.dispose();
    },
  });

  const config = vscode.workspace.getConfiguration('autochub');
  if (config.get<boolean>('autoSyncOnStartup', true)) {
    void runDocsSync(false);
  }

  void refreshCacheHealth(false);
  cacheHealthRefreshTimer = setInterval(() => {
    void refreshCacheHealth(false);
  }, 90_000);

  const active = vscode.window.activeTextEditor?.document;
  if (active) {
    scheduleFileAnalysis(active);
  }
}

function scheduleFileAnalysis(doc: vscode.TextDocument): void {
  if (!isSupportedLanguage(doc.languageId) || doc.uri.scheme !== 'file') return;

  const key = doc.uri.fsPath;
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    debounceTimers.delete(key);
    void runAnalyzerForPath(doc.uri.fsPath, { specificUri: doc.uri });
  }, 700);

  debounceTimers.set(key, timer);
}

function isSupportedLanguage(languageId: string): boolean {
  const supported = new Set([
    'typescript',
    'javascript',
    'typescriptreact',
    'javascriptreact',
    'python',
    'java',
    'go',
    'csharp',
  ]);
  return supported.has(languageId);
}

async function runDocsSync(showNotifications: boolean): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;

  const command = resolveCliCommand(workspaceRoot);
  const githubRepo = vscode.workspace
    .getConfiguration('autochub')
    .get<string>('githubRepo', 'andrewyng/context-hub@main');

  const args = [...command.argsPrefix, 'sync', '--github', githubRepo];

  const result = await runCliCommand(command, args, workspaceRoot, 20 * 1024 * 1024);
  if (result.error) {
    if (showNotifications) {
      vscode.window.showWarningMessage(
        'Auto-CHUB: docs sync failed. Existing offline cache will still be used.'
      );
    }
    console.error('Auto-CHUB sync failed', result.stderr.trim() || result.error.message);
    void refreshCacheHealth(false);
    return;
  }

  if (showNotifications) {
    vscode.window.showInformationMessage('Auto-CHUB: docs synced and cached for offline use.');
  }

  if (result.stdout.trim()) console.log(result.stdout);
  void refreshCacheHealth(false);
}

async function refreshCacheHealth(openPanel: boolean): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    cacheHealthStatusItem.text = '$(warning) CHUB Cache: No Workspace';
    cacheHealthStatusItem.tooltip = 'Open a workspace to load Auto-CHUB cache health.';
    return;
  }

  const health = await readCacheHealth(workspaceRoot);
  if (!health) {
    cacheHealthStatusItem.text = '$(warning) CHUB Cache: Unknown';
    cacheHealthStatusItem.tooltip = 'Unable to read cache health from CLI.';
    if (openPanel) {
      vscode.window.showWarningMessage('Auto-CHUB: unable to read cache health.');
    }
    return;
  }

  cacheHealthStatusItem.text = statusText(health.status);
  cacheHealthStatusItem.tooltip = statusTooltip(health);

  if (openPanel) {
    showCacheHealthPanel(health);
  } else if (cacheHealthPanel) {
    cacheHealthPanel.webview.html = renderCacheHealthHtml(health);
  }
}

async function readCacheHealth(workspaceRoot: string): Promise<CacheHealthReport | null> {
  const command = resolveCliCommand(workspaceRoot);
  const args = [...command.argsPrefix, 'cache-health', '--output', 'json'];

  const result = await runCliCommand(command, args, workspaceRoot, 8 * 1024 * 1024);
  if (result.error) {
    console.error(
      'Auto-CHUB cache-health failed:',
      result.stderr.trim() || result.error.message
    );
    return null;
  }

  return parseJsonFromStdout<CacheHealthReport>(result.stdout);
}

function showCacheHealthPanel(health: CacheHealthReport): void {
  if (cacheHealthPanel) {
    cacheHealthPanel.webview.html = renderCacheHealthHtml(health);
    cacheHealthPanel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  cacheHealthPanel = vscode.window.createWebviewPanel(
    'autochubCacheHealth',
    'Auto-CHUB Cache Health',
    vscode.ViewColumn.Beside,
    { enableFindWidget: true }
  );
  cacheHealthPanel.webview.html = renderCacheHealthHtml(health);
  cacheHealthPanel.onDidDispose(() => {
    cacheHealthPanel = undefined;
  });
}

function renderCacheHealthHtml(health: CacheHealthReport): string {
  const statusColor = health.status === 'healthy'
    ? '#16a34a'
    : health.status === 'stale'
      ? '#ca8a04'
      : '#dc2626';
  const updated = formatTimestamp(health.lastUpdated);
  const age = formatAge(health.ageMs);
  const source = health.sourceRepo
    ? `${health.sourceRepo}${health.sourceBranch ? `@${health.sourceBranch}` : ''}`
    : 'unknown';

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; padding: 16px; color: #111827; }
      .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; color: #fff; font-weight: 600; background: ${statusColor}; }
      .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; margin-top: 12px; }
      .row { margin: 8px 0; }
      .k { color: #6b7280; display: inline-block; min-width: 120px; }
      code { background: #f3f4f6; padding: 2px 5px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h2>Offline Cache Health</h2>
    <div class="badge">${health.status.toUpperCase()}</div>
    <div class="card">
      <div class="row"><span class="k">Docs count</span> ${health.docsCount}</div>
      <div class="row"><span class="k">Last updated</span> ${updated}</div>
      <div class="row"><span class="k">Age</span> ${age}</div>
      <div class="row"><span class="k">Source</span> ${source}</div>
      <div class="row"><span class="k">Cache file</span> <code>${escapeHtml(health.cachePath)}</code></div>
      <div class="row"><span class="k">Docs folder</span> <code>${escapeHtml(health.docsDir)}</code></div>
    </div>
  </body>
</html>`;
}

function statusText(status: CacheHealthReport['status']): string {
  switch (status) {
    case 'healthy':
      return '$(check) CHUB Cache: Fresh';
    case 'stale':
      return '$(history) CHUB Cache: Stale';
    case 'empty':
      return '$(warning) CHUB Cache: Empty';
    default:
      return '$(error) CHUB Cache: Missing';
  }
}

function statusTooltip(health: CacheHealthReport): vscode.MarkdownString {
  const md = new vscode.MarkdownString(undefined, true);
  md.appendMarkdown(`**Auto-CHUB Offline Cache**\n\n`);
  md.appendMarkdown(`- Status: \`${health.status}\`\n`);
  md.appendMarkdown(`- Docs: \`${health.docsCount}\`\n`);
  md.appendMarkdown(`- Last updated: \`${formatTimestamp(health.lastUpdated)}\`\n`);
  md.appendMarkdown(`- Age: \`${formatAge(health.ageMs)}\`\n`);
  if (health.sourceRepo) {
    md.appendMarkdown(`- Source: \`${health.sourceRepo}${health.sourceBranch ? `@${health.sourceBranch}` : ''}\`\n`);
  }
  md.isTrusted = false;
  return md;
}

function formatTimestamp(value?: number): string {
  if (!value) return 'never';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'unknown';
  }
}

function formatAge(value?: number): string {
  if (typeof value !== 'number' || value < 0) return 'unknown';
  const mins = Math.floor(value / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 48) return `${hours}h ${remMins}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function runAnalyzerForPath(
  targetPath: string,
  options?: {
    specificUri?: vscode.Uri;
    clearAllDiagnostics?: boolean;
    openReport?: boolean;
    reportTitle?: string;
  }
): Promise<void> {
  const workspaceRoot = getWorkspaceRoot(targetPath);
  if (!workspaceRoot) return;

  const command = resolveCliCommand(workspaceRoot);
  const config = vscode.workspace.getConfiguration('autochub');
  const includeLiveChub = config.get<boolean>('includeLiveChubLookup', false);
  const enableGraph = config.get<boolean>('enableGraphAnalysis', true);
  const minSeverity = config.get<string>('minimumSeverity', 'low');
  const maxResults = config.get<number>('maxResults', 5000);

  const args = [...command.argsPrefix, 'analyze', targetPath, '--output', 'json'];
  if (enableGraph) args.push('--with-graph');
  if (includeLiveChub) args.push('--use-chub');
  if (minSeverity) args.push('--severity', minSeverity);
  if (Number.isFinite(maxResults) && maxResults > 0) args.push('--max-results', `${maxResults}`);

  const key = options?.specificUri?.fsPath ?? workspaceRoot;
  const runId = ++runSequence;
  latestRunByKey.set(key, runId);

  const result = await runCliCommand(command, args, workspaceRoot, 30 * 1024 * 1024);
  const latest = latestRunByKey.get(key);
  if (latest !== runId) return;

  if (result.error) {
    console.error('Auto-CHUB analyze failed:', result.stderr.trim() || result.error.message);
    return;
  }

  const report = parseAnalyzerReport(result.stdout);
  if (!report) {
    if (result.stderr.trim()) console.error('Auto-CHUB analyze failed:', result.stderr);
    return;
  }

  if (options?.clearAllDiagnostics) {
    diagnosticCollection.clear();
  }

  applyDiagnostics(report, workspaceRoot);
  if (options?.openReport) {
    const reportTitle = options.reportTitle ?? path.basename(targetPath);
    const reportPath = writeFindingsMarkdownReport(report, workspaceRoot, reportTitle);
    showFindingsReportPanel(report, workspaceRoot, reportTitle, reportPath);
    vscode.window.setStatusBarMessage('Auto-CHUB: analysis complete. Findings report opened.', 5000);
  }

  if (options?.specificUri) {
    const specificPath = path.normalize(options.specificUri.fsPath);
    const touched = new Set(
      (report.files ?? []).map((f) =>
        path.normalize(resolveReportedPath(f.filePath, workspaceRoot))
      )
    );
    if (!touched.has(specificPath)) {
      diagnosticCollection.set(options.specificUri, []);
    }
  }
}

function showFindingsReportPanel(
  report: AnalyzerReport,
  workspaceRoot: string,
  title: string,
  reportPath?: string
): void {
  if (findingsReportPanel) {
    findingsReportPanel.webview.html = renderFindingsReportHtml(report, workspaceRoot, title, reportPath);
    findingsReportPanel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  findingsReportPanel = vscode.window.createWebviewPanel(
    'autochubFindingsReport',
    'Auto-CHUB Findings',
    vscode.ViewColumn.Beside,
    {
      enableFindWidget: true,
      enableScripts: true,
    }
  );

  findingsReportPanel.webview.html = renderFindingsReportHtml(report, workspaceRoot, title, reportPath);
  findingsReportPanel.webview.onDidReceiveMessage((message: unknown) => {
    void handleFindingsReportMessage(message);
  });
  findingsReportPanel.onDidDispose(() => {
    findingsReportPanel = undefined;
  });
}

async function handleFindingsReportMessage(message: unknown): Promise<void> {
  if (!message || typeof message !== 'object') return;

  const payload = message as {
    command?: string;
    filePath?: string;
    line?: number;
    col?: number;
    target?: string;
  };

  if (payload.command === 'openFile' && payload.filePath) {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(payload.filePath));
    const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    const line = Math.max(0, (payload.line ?? 1) - 1);
    const col = Math.max(0, (payload.col ?? 1) - 1);
    const position = new vscode.Position(line, col);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    return;
  }

  if (payload.command === 'openDoc' && payload.target) {
    if (/^https?:\/\//i.test(payload.target)) {
      await vscode.env.openExternal(vscode.Uri.parse(payload.target));
      return;
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(payload.target));
    await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
  }
}

function writeFindingsMarkdownReport(
  report: AnalyzerReport,
  workspaceRoot: string,
  title: string
): string | undefined {
  try {
    const reportsDir = path.join(workspaceRoot, '.autochub', 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    const reportPath = path.join(reportsDir, 'latest-findings.md');
    fs.writeFileSync(reportPath, renderFindingsMarkdownReport(report, workspaceRoot, title), 'utf8');
    return reportPath;
  } catch (error) {
    console.error('Auto-CHUB report write failed:', error);
    vscode.window.showWarningMessage('Auto-CHUB: analysis completed, but the report file could not be saved.');
    return undefined;
  }
}

function renderFindingsMarkdownReport(report: AnalyzerReport, workspaceRoot: string, title: string): string {
  const files = report.files ?? [];
  const totalFindings = report.totalFindings ?? files.reduce((sum, file) => sum + file.findings.length, 0);
  const lines: string[] = [
    '# Auto-CHUB Findings',
    '',
    `Target: ${title}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Findings: ${totalFindings}`,
    `- Files scanned: ${report.scannedFiles ?? 0}`,
    `- Critical: ${report.criticalCount ?? countSeverity(files, 'critical')}`,
    `- High: ${report.highCount ?? countSeverity(files, 'high')}`,
    `- Medium: ${report.mediumCount ?? countSeverity(files, 'medium')}`,
    `- Low: ${report.lowCount ?? countSeverity(files, 'low')}`,
    `- Scan time: ${report.durationMs ?? 0}ms`,
    '',
  ];

  if (files.length === 0) {
    lines.push('No deprecated APIs found.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## Findings by File', '');

  for (const file of files) {
    const absolutePath = resolveReportedPath(file.filePath, workspaceRoot);
    const relativePath = path.relative(workspaceRoot, absolutePath) || path.basename(absolutePath);
    const risk = typeof file.riskScore === 'number' ? `Risk ${file.riskScore}%` : `${file.findings.length} findings`;
    lines.push(`### ${relativePath}`);
    lines.push('');
    lines.push(`Path: ${absolutePath}`);
    lines.push(`Risk: ${risk}`);
    lines.push('');

    for (const finding of file.findings) {
      lines.push(`#### ${finding.title}`);
      lines.push('');
      lines.push(`- Severity: ${finding.severity}`);
      lines.push(`- Location: ${absolutePath}:${finding.line}:${finding.col}`);
      lines.push(`- Snippet: \`${inlineCode(finding.snippet || '')}\``);
      lines.push(`- Guidance: ${finding.guidance || 'Manual review'}`);
      lines.push(`- Replacement: ${finding.replacement || 'Manual review'}`);
      if (finding.propagationDepth && finding.propagationDepth > 0) {
        lines.push(`- Propagation depth: ${finding.propagationDepth}`);
      }
      if (finding.propagationChain?.length) {
        lines.push(`- Propagation chain: ${finding.propagationChain.join(' -> ')}`);
      }
      if (finding.localDocPath) {
        lines.push(`- Offline docs: ${finding.localDocPath}`);
      }
      if (finding.docsUrl) {
        lines.push(`- Source docs: ${finding.docsUrl}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function inlineCode(value: string): string {
  return value.replace(/`/g, '\\`').replace(/\r?\n/g, ' ');
}

function renderFindingsReportHtml(
  report: AnalyzerReport,
  workspaceRoot: string,
  title: string,
  reportPath?: string
): string {
  const files = report.files ?? [];
  const totalFindings = report.totalFindings ?? files.reduce((sum, file) => sum + file.findings.length, 0);
  const generatedAt = new Date().toLocaleString();
  const savedReport = reportPath
    ? `<div class="subtle report-path">
        Saved report:
        <button data-command="openDoc" data-target="${escapeHtml(reportPath)}">${escapeHtml(path.relative(workspaceRoot, reportPath))}</button>
      </div>`
    : '';
  const fileSections = files.length > 0
    ? files.map((file, fileIndex) => renderFileFindings(file, fileIndex, workspaceRoot)).join('\n')
    : `<section class="empty">
        <div class="empty-title">No deprecated APIs found</div>
        <div class="empty-copy">The latest scan did not return any findings for this target.</div>
      </section>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        padding: 0;
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
      }
      .page {
        max-width: 1180px;
        margin: 0 auto;
        padding: 22px 24px 36px;
      }
      header {
        border-bottom: 1px solid var(--vscode-panel-border);
        padding-bottom: 18px;
        margin-bottom: 18px;
      }
      h1 {
        font-size: 24px;
        font-weight: 650;
        margin: 0 0 6px;
      }
      .subtle {
        color: var(--vscode-descriptionForeground);
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 10px;
        margin: 16px 0 0;
      }
      .metric {
        border: 1px solid var(--vscode-panel-border);
        background: var(--vscode-editorWidget-background);
        border-radius: 6px;
        padding: 10px 12px;
      }
      .metric-value {
        display: block;
        font-size: 22px;
        font-weight: 700;
        line-height: 1.2;
      }
      .metric-label {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
      }
      .file-section {
        border-top: 1px solid var(--vscode-panel-border);
        padding-top: 16px;
        margin-top: 18px;
      }
      .file-heading {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      h2 {
        font-size: 16px;
        margin: 0;
        font-weight: 650;
        overflow-wrap: anywhere;
      }
      .risk {
        color: var(--vscode-descriptionForeground);
        white-space: nowrap;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        border-bottom: 1px solid var(--vscode-panel-border);
        padding: 9px 8px;
        text-align: left;
        vertical-align: top;
      }
      th {
        color: var(--vscode-descriptionForeground);
        font-weight: 600;
        font-size: 12px;
      }
      tr:hover td {
        background: var(--vscode-list-hoverBackground);
      }
      button {
        color: var(--vscode-textLink-foreground);
        background: transparent;
        border: 0;
        padding: 0;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      button:hover {
        text-decoration: underline;
      }
      code {
        font-family: var(--vscode-editor-font-family);
        font-size: var(--vscode-editor-font-size);
        color: var(--vscode-editor-foreground);
        background: var(--vscode-textCodeBlock-background);
        border-radius: 4px;
        padding: 2px 4px;
        overflow-wrap: anywhere;
      }
      .badge {
        display: inline-block;
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0;
        text-transform: uppercase;
      }
      .critical { color: #ffffff; background: #dc2626; }
      .high { color: #ffffff; background: #ea580c; }
      .medium { color: #111827; background: #facc15; }
      .low { color: #ffffff; background: #2563eb; }
      .finding-title {
        font-weight: 650;
        margin-bottom: 4px;
      }
      .finding-detail {
        color: var(--vscode-descriptionForeground);
        margin-top: 5px;
      }
      .doc-actions {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .empty {
        border: 1px solid var(--vscode-panel-border);
        background: var(--vscode-editorWidget-background);
        border-radius: 6px;
        padding: 22px;
      }
      .empty-title {
        font-size: 17px;
        font-weight: 650;
        margin-bottom: 4px;
      }
      .empty-copy {
        color: var(--vscode-descriptionForeground);
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header>
        <h1>Auto-CHUB Findings</h1>
        <div class="subtle">${escapeHtml(title)} - generated ${escapeHtml(generatedAt)}</div>
        ${savedReport}
        <div class="summary">
          ${renderMetric(totalFindings, 'Findings')}
          ${renderMetric(report.scannedFiles ?? 0, 'Files scanned')}
          ${renderMetric(report.criticalCount ?? countSeverity(files, 'critical'), 'Critical')}
          ${renderMetric(report.highCount ?? countSeverity(files, 'high'), 'High')}
          ${renderMetric(report.mediumCount ?? countSeverity(files, 'medium'), 'Medium')}
          ${renderMetric(report.lowCount ?? countSeverity(files, 'low'), 'Low')}
          ${renderMetric(`${report.durationMs ?? 0}ms`, 'Scan time')}
        </div>
      </header>
      ${fileSections}
    </main>
    <script>
      const vscode = acquireVsCodeApi();
      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest('button[data-command]');
        if (!button) return;
        vscode.postMessage({
          command: button.dataset.command,
          filePath: button.dataset.filePath,
          line: Number(button.dataset.line || '1'),
          col: Number(button.dataset.col || '1'),
          target: button.dataset.target
        });
      });
    </script>
  </body>
</html>`;
}

function renderMetric(value: string | number, label: string): string {
  return `<div class="metric">
    <span class="metric-value">${escapeHtml(String(value))}</span>
    <span class="metric-label">${escapeHtml(label)}</span>
  </div>`;
}

function countSeverity(files: AnalyzerFileReport[], severity: AnalyzerFinding['severity']): number {
  return files.reduce(
    (sum, file) => sum + file.findings.filter((finding) => finding.severity === severity).length,
    0
  );
}

function renderFileFindings(file: AnalyzerFileReport, fileIndex: number, workspaceRoot: string): string {
  const absolutePath = resolveReportedPath(file.filePath, workspaceRoot);
  const relativePath = path.relative(workspaceRoot, absolutePath) || path.basename(absolutePath);
  const rows = file.findings.map((finding, findingIndex) =>
    renderFindingRow(finding, absolutePath, fileIndex, findingIndex)
  ).join('\n');
  const risk = typeof file.riskScore === 'number' ? `Risk ${file.riskScore}%` : `${file.findings.length} findings`;

  return `<section class="file-section">
    <div class="file-heading">
      <h2>${escapeHtml(relativePath)}</h2>
      <div class="risk">${escapeHtml(risk)}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Severity</th>
          <th>Location</th>
          <th>Finding</th>
          <th>Fix</th>
          <th>Docs</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function renderFindingRow(
  finding: AnalyzerFinding,
  filePath: string,
  fileIndex: number,
  findingIndex: number
): string {
  const locationId = `finding-${fileIndex}-${findingIndex}`;
  const chain = finding.propagationChain?.length
    ? `<div class="finding-detail">Chain: ${escapeHtml(finding.propagationChain.join(' -> '))}</div>`
    : '';
  const depth = finding.propagationDepth && finding.propagationDepth > 0
    ? `<div class="finding-detail">Indirect usage, depth ${finding.propagationDepth}</div>`
    : '';

  return `<tr id="${locationId}">
    <td><span class="badge ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span></td>
    <td>
      <button
        data-command="openFile"
        data-file-path="${escapeHtml(filePath)}"
        data-line="${finding.line}"
        data-col="${finding.col}"
      >Line ${finding.line}:${finding.col}</button>
    </td>
    <td>
      <div class="finding-title">${escapeHtml(finding.title)}</div>
      <code>${escapeHtml(finding.snippet || '')}</code>
      <div class="finding-detail">${escapeHtml(finding.guidance || '')}</div>
      ${depth}
      ${chain}
    </td>
    <td>${escapeHtml(finding.replacement || 'Manual review')}</td>
    <td><div class="doc-actions">${renderDocActions(finding)}</div></td>
  </tr>`;
}

function renderDocActions(finding: AnalyzerFinding): string {
  const actions: string[] = [];

  if (finding.localDocPath) {
    actions.push(`<button data-command="openDoc" data-target="${escapeHtml(finding.localDocPath)}">Offline docs</button>`);
  }

  if (finding.docsUrl) {
    actions.push(`<button data-command="openDoc" data-target="${escapeHtml(finding.docsUrl)}">Source docs</button>`);
  }

  return actions.length ? actions.join('') : '<span class="subtle">No docs</span>';
}

function applyDiagnostics(report: AnalyzerReport, workspaceRoot: string): void {
  for (const fileReport of report.files ?? []) {
    const filePath = resolveReportedPath(fileReport.filePath, workspaceRoot);
    const uri = vscode.Uri.file(filePath);
    const diagnostics = fileReport.findings.map((finding) => toDiagnostic(finding));
    diagnosticCollection.set(uri, diagnostics);
  }
}

function toDiagnostic(finding: AnalyzerFinding): vscode.Diagnostic {
  const line = Math.max(0, (finding.line ?? 1) - 1);
  const start = Math.max(0, (finding.col ?? 1) - 1);
  const end = start + Math.max(1, Math.min(120, finding.snippet?.length || 12));
  const range = new vscode.Range(line, start, line, end);

  const message = [
    `[Auto-CHUB] ${finding.title}`,
    `Guidance: ${finding.guidance}`,
    `Fix: ${finding.replacement}`,
  ].join('\n');

  const diagnostic = new vscode.Diagnostic(range, message, severityToVsCode(finding.severity));
  diagnostic.source = 'auto-chub';

  if (finding.localDocPath && fs.existsSync(finding.localDocPath)) {
    diagnostic.code = {
      value: 'Open offline docs',
      target: vscode.Uri.file(finding.localDocPath),
    };
  } else if (finding.docsUrl) {
    try {
      diagnostic.code = {
        value: 'Open docs',
        target: vscode.Uri.parse(finding.docsUrl),
      };
    } catch {
      diagnostic.code = 'Auto-CHUB';
    }
  } else {
    diagnostic.code = 'Auto-CHUB';
  }

  return diagnostic;
}

function severityToVsCode(severity: AnalyzerFinding['severity']): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'critical':
    case 'high':
      return vscode.DiagnosticSeverity.Error;
    case 'medium':
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

function parseAnalyzerReport(stdout: string): AnalyzerReport | null {
  return parseJsonFromStdout<AnalyzerReport>(stdout);
}

function parseJsonFromStdout<T>(stdout: string): T | null {
  if (!stdout.trim()) return null;

  const lines = stdout.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('{')) {
      start = i;
      break;
    }
  }

  if (start < 0) return null;
  const json = lines.slice(start).join('\n').trim();

  try {
    const parsed = JSON.parse(json) as T;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function resolveReportedPath(reportPath: string, workspaceRoot: string): string {
  if (path.isAbsolute(reportPath)) return reportPath;
  return path.resolve(workspaceRoot, reportPath);
}

function runCliCommand(
  command: CommandSpec,
  args: string[],
  cwd: string,
  maxBuffer: number
): Promise<CliExecResult> {
  return new Promise<CliExecResult>((resolve) => {
    const options: cp.ExecFileOptionsWithStringEncoding = {
      cwd,
      encoding: 'utf8',
      maxBuffer,
      shell: shouldUseShellForCommand(command.command),
      windowsHide: true,
    };

    try {
      cp.execFile(command.command, args, options, (error, stdout, stderr) => {
        resolve({
          error: error ?? null,
          stdout,
          stderr,
        });
      });
    } catch (error) {
      resolve({
        error: error instanceof Error ? error : new Error(String(error)),
        stdout: '',
        stderr: '',
      });
    }
  });
}

function shouldUseShellForCommand(command: string): boolean {
  return process.platform === 'win32' && /\.(?:bat|cmd)$/i.test(command);
}

function getNodeCommand(): string {
  const executableName = path.basename(process.execPath).toLowerCase();
  if (executableName === 'node' || executableName === 'node.exe') {
    return process.execPath;
  }

  return process.platform === 'win32' ? 'node.exe' : 'node';
}

function resolveCliCommand(workspaceRoot: string): CommandSpec {
  const config = vscode.workspace.getConfiguration('autochub');
  const customPath = config.get<string>('cliPath', '').trim();

  if (customPath) {
    if (customPath.endsWith('.js') || customPath.endsWith('.cjs') || customPath.endsWith('.mjs')) {
      return { command: getNodeCommand(), argsPrefix: [customPath] };
    }
    return { command: customPath, argsPrefix: [] };
  }

  const localCli = findLocalCliPath(workspaceRoot);
  if (localCli) {
    return { command: getNodeCommand(), argsPrefix: [localCli] };
  }

  const localBin = path.join(workspaceRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'autochub.cmd' : 'autochub');
  if (fs.existsSync(localBin)) {
    return { command: localBin, argsPrefix: [] };
  }

  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    argsPrefix: ['autochub'],
  };
}

function findLocalCliPath(workspaceRoot: string): string | null {
  const parentDir = path.dirname(workspaceRoot);
  const candidates = [
    path.join(workspaceRoot, 'dist', 'cli', 'index.js'),
    path.join(workspaceRoot, 'autochub-context-hub', 'dist', 'cli', 'index.js'),
    path.join(parentDir, 'dist', 'cli', 'index.js'),
    path.join(parentDir, 'autochub-context-hub', 'dist', 'cli', 'index.js'),
    path.join(workspaceRoot, '..', 'autochub-context-hub', 'dist', 'cli', 'index.js'),
  ];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

function getWorkspaceRoot(targetPath?: string): string | undefined {
  if (targetPath) {
    const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(targetPath));
    if (folder) return folder.uri.fsPath;
  }

  if (vscode.workspace.workspaceFolders?.length) {
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  return undefined;
}

export function deactivate() {
  if (cacheHealthRefreshTimer) {
    clearInterval(cacheHealthRefreshTimer);
    cacheHealthRefreshTimer = undefined;
  }
  cacheHealthPanel?.dispose();
  findingsReportPanel?.dispose();
  cacheHealthStatusItem?.dispose();
  diagnosticCollection?.dispose();
}
