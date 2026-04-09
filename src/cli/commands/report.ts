import * as fs from 'fs';
import * as path from 'path';

interface ReportOptions {
  format?: string;
  includeTimeline?: boolean;
  includeMetrics?: boolean;
  output?: string;
}

export async function reportCommand(projectPath: string = '.', options: ReportOptions) {
  try {
    console.log('\n📊 Auto-CHUB Report Generator\n');
    console.log(`📁 Analyzing: ${path.resolve(projectPath)}\n`);

    const findings = findDeprecatedPatterns(projectPath);

    if (findings.length === 0) {
      console.log('✓ No deprecated APIs found!\n');
      return;
    }

    // Generate report
    const report = generateReport(findings, projectPath);

    // Output format
    const format = options.format || 'html';

    let output = '';
    switch (format) {
      case 'json':
        output = JSON.stringify(report, null, 2);
        break;
      case 'markdown':
        output = generateMarkdownReport(report);
        break;
      case 'csv':
        output = generateCsvReport(report);
        break;
      case 'html':
      default:
        output = generateHtmlReport(report);
        break;
    }

    // Save or display
    if (options.output) {
      fs.writeFileSync(options.output, output);
      console.log(`✓ Report saved to: ${options.output}\n`);
    } else {
      console.log(output);
    }
  } catch (error) {
    console.error('❌ Report generation failed:', error);
    process.exit(1);
  }
}

interface Finding {
  file: string;
  line: number;
  pattern: string;
  code: string;
}

interface Report {
  timestamp: string;
  projectPath: string;
  totalFindings: number;
  totalFiles: number;
  findings: Finding[];
  summary: Record<string, number>;
}

function findDeprecatedPatterns(projectPath: string): Finding[] {
  const files = findSourceFiles(projectPath);
  const findings: Finding[] = [];

  const deprecatedPatterns = [
    'ChatCompletion.create',
    'ReactDOM.render',
    'new Buffer',
    'CancelToken',
  ];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, i) => {
        for (const pattern of deprecatedPatterns) {
          if (line.includes(pattern)) {
            findings.push({
              file,
              line: i + 1,
              pattern,
              code: line.trim(),
            });
          }
        }
      });
    } catch (error) {
      // Skip files that can't be read
    }
  }

  return findings;
}

function generateReport(findings: Finding[], projectPath: string): Report {
  const summary: Record<string, number> = {};
  const uniqueFiles = new Set<string>();

  findings.forEach(f => {
    summary[f.pattern] = (summary[f.pattern] || 0) + 1;
    uniqueFiles.add(f.file);
  });

  return {
    timestamp: new Date().toISOString(),
    projectPath,
    totalFindings: findings.length,
    totalFiles: uniqueFiles.size,
    findings,
    summary,
  };
}

function generateHtmlReport(report: Report): string {
  const rows = report.findings
    .map(
      f => `
    <tr>
      <td>${f.pattern}</td>
      <td>${f.file}</td>
      <td>${f.line}</td>
      <td><code>${escapeHtml(f.code)}</code></td>
    </tr>
  `
    )
    .join('');

  const summaryRows = Object.entries(report.summary)
    .map(
      ([pattern, count]) => `
    <tr>
      <td>${pattern}</td>
      <td>${count}</td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Auto-CHUB Deprecation Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    code { background-color: #f4f4f4; padding: 2px 6px; }
    .summary { background-color: #e8f5e9; padding: 15px; border-radius: 5px; }
  </style>
</head>
<body>
  <h1>Auto-CHUB Deprecation Report</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Generated:</strong> ${report.timestamp}</p>
    <p><strong>Project:</strong> ${report.projectPath}</p>
    <p><strong>Total Findings:</strong> ${report.totalFindings}</p>
    <p><strong>Files Affected:</strong> ${report.totalFiles}</p>
  </div>

  <h2>Deprecated APIs</h2>
  <table>
    <tr>
      <th>API</th>
      <th>Count</th>
    </tr>
    ${summaryRows}
  </table>

  <h2>Detailed Findings</h2>
  <table>
    <tr>
      <th>API</th>
      <th>File</th>
      <th>Line</th>
      <th>Code</th>
    </tr>
    ${rows}
  </table>
</body>
</html>
  `;
}

function generateMarkdownReport(report: Report): string {
  const rows = report.findings
    .map(f => `| ${f.pattern} | ${f.file} | ${f.line} | \`${f.code}\` |`)
    .join('\n');

  const summaryRows = Object.entries(report.summary)
    .map(([pattern, count]) => `| ${pattern} | ${count} |`)
    .join('\n');

  return `
# Auto-CHUB Deprecation Report

## Summary

- **Generated:** ${report.timestamp}
- **Project:** ${report.projectPath}
- **Total Findings:** ${report.totalFindings}
- **Files Affected:** ${report.totalFiles}

## Deprecated APIs

| API | Count |
|-----|-------|
${summaryRows}

## Detailed Findings

| API | File | Line | Code |
|-----|------|------|------|
${rows}
  `;
}

function generateCsvReport(report: Report): string {
  const header = 'API,File,Line,Code\n';
  const rows = report.findings
    .map(f => `"${f.pattern}","${f.file}",${f.line},"${f.code.replace(/"/g, '""')}"`)
    .join('\n');

  return header + rows;
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

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
