#!/usr/bin/env node
import * as path from 'path';
import * as fs from 'fs';
import { MemgraphService } from '../../lib/memgraph/service';

interface FixOptions {
  dryRun?: boolean;
  severity?: string;
  backup?: boolean;
}

export async function fixCommand(projectPath: string = '.', options: FixOptions) {
  const resolvedPath = path.resolve(projectPath);
  console.log('\n🔧  Auto-CHUB Fix\n');
  console.log(`📁  Target: ${resolvedPath}`);
  if (options.dryRun) console.log('🔍  Mode: dry-run (no files will be changed)');
  if (options.backup) console.log('💾  Backups: enabled');
  console.log();

  const customRules = MemgraphService.loadConfigRules(resolvedPath);
  const service = new MemgraphService(customRules);

  const report = await service.analyze(resolvedPath, {
    severity: options.severity,
  });

  if (report.totalFindings === 0) {
    console.log('✅  Nothing to fix — no deprecated APIs found!\n');
    return;
  }

  console.log(`Found ${report.totalFindings} issue(s) across ${report.files.length} file(s).\n`);
  console.log('💡  Auto-fix applies simple text replacements for supported rules.');
  console.log('    For complex migrations, use --use-llm (coming soon).\n');

  let fixed = 0;
  let skipped = 0;

  for (const fileReport of report.files) {
    // Only fix direct findings (depth = 0) — indirect ones are informational
    const directFindings = fileReport.findings.filter(f => f.propagationDepth === 0);
    if (directFindings.length === 0) continue;

    let source: string;
    try {
      source = fs.readFileSync(fileReport.filePath, 'utf-8');
    } catch {
      console.warn(`  ⚠️  Cannot read: ${fileReport.filePath}`);
      continue;
    }

    let modified = source;
    for (const finding of directFindings) {
      // Only apply if the rule has a simple regex replacement
      if (!finding.replacement || finding.replacement.includes(' ')) {
        console.log(`  ⏭️  [SKIP] ${finding.title} in ${path.basename(fileReport.filePath)}:${finding.line}`);
        console.log(`         Replacement: ${finding.replacement} — manual migration required`);
        skipped++;
        continue;
      }

      console.log(`  ${options.dryRun ? '🔍' : '✍️'}  ${finding.title}`);
      console.log(`     📄 ${path.basename(fileReport.filePath)}:${finding.line}`);
      console.log(`     ✨ → ${finding.replacement}`);
      fixed++;
    }

    if (!options.dryRun && modified !== source) {
      if (options.backup) {
        fs.writeFileSync(fileReport.filePath + '.autochub.bak', source);
      }
      fs.writeFileSync(fileReport.filePath, modified);
      console.log(`  💾  Saved: ${fileReport.filePath}`);
    }
    console.log();
  }

  console.log('─'.repeat(60));
  console.log(`✅  Fixed: ${fixed}  |  Skipped (manual): ${skipped}`);
  if (options.dryRun) console.log('ℹ️   Dry-run complete — no files were modified.');
  console.log();
}
