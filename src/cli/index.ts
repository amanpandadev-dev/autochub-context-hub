#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeCommand } from './commands/analyze';
import { fixCommand } from './commands/fix';
import { reportCommand } from './commands/report';
import { configCommand, initCommand } from './commands/config';
import { rulesCommand } from './commands/rules';
import { syncCommand } from './commands/sync';
import { cacheHealthCommand } from './commands/cache-health';
import { cmdCommand } from './commands/cmd';

const program = new Command();

program
  .name('autochub')
  .description('Detect and fix deprecated API calls using in-memory graph analysis — no Docker required')
  .version('1.0.0');

// ── analyze ──────────────────────────────────────────────────────────────────
program
  .command('analyze [path]')
  .description('Scan a project for deprecated API calls')
  .option('--with-graph', 'Enable call-graph propagation (finds indirect usages)')
  .option('--lang <language>', 'Filter by language: ts, js, py, java, go, cs')
  .option('--output <format>', 'Output format: table (default), json, markdown', 'table')
  .option('--severity <level>', 'Minimum severity to report: critical, high, medium, low')
  .option('--exclude <patterns>', 'Comma-separated directory/file patterns to skip')
  .option('--max-results <number>', 'Limit number of results')
  .option('--rules <file>', 'Path to a JSON file with custom deprecation rules')
  .option('--use-chub', 'Enrich findings with Andrew Ng\'s Context Hub documentation')
  .action(analyzeCommand);

// ── fix ───────────────────────────────────────────────────────────────────────
program
  .command('fix [path]')
  .description('Apply safe automatic fixes to deprecated API usages')
  .option('--dry-run', 'Preview changes without writing files')
  .option('--backup', 'Create .autochub.bak backup before modifying files')
  .option('--severity <level>', 'Only fix issues at this severity or above')
  .action(fixCommand);

// ── report ────────────────────────────────────────────────────────────────────
program
  .command('report [path]')
  .description('Generate a deprecation report for a project')
  .option('--format <format>', 'Output format: markdown (default), json, csv', 'markdown')
  .option('--include-timeline', 'Add a migration checklist to the report')
  .option('--include-metrics', 'Include per-file risk scores in the report')
  .option('--output <file>', 'Save report to a file instead of stdout')
  .action(reportCommand);

// ── init ──────────────────────────────────────────────────────────────────────
program
  .command('init [path]')
  .description('Create a .autochub.json config file in the project root')
  .action(initCommand);

// ── rules ─────────────────────────────────────────────────────────────────────
program
  .command('rules')
  .description('List all built-in deprecation rules')
  .option('--severity <level>', 'Filter by severity: critical, high, medium, low')
  .option('--lang <language>', 'Filter by language: ts, js, py, java, go, cs')
  .action(rulesCommand);

// ── sync ──────────────────────────────────────────────────────────────────────
program
  .command('sync')
  .description('Synchronize offline document caches and rules (e.g. from GitHub or CHUB)')
  .option('--github [repo]', 'Pull rules and docs from GitHub (format: owner/repo@branch)')
  .option('--chub', 'Scan Context Hub locally for deprecated docs')
  .option('--bg', 'Run sync silently (used internally for background polling)')
  .action(syncCommand);

// —— cache-health —————————————————————————————————————————————————————————————————————————————————————
program
  .command('cache-health')
  .description('Show offline cache health for CHUB GitHub docs')
  .option('--output <format>', 'Output format: table (default), json', 'table')
  .option('--max-age-hours <number>', 'Freshness window in hours (default 24)', '24')
  .action(cacheHealthCommand);

program
  .command('cmd [command]')
  .description('Explain available Auto-CHUB commands and their use cases')
  .action(cmdCommand);

// ── config ────────────────────────────────────────────────────────────────────
program
  .command('config [action] [key] [value]')
  .description('Manage autochub configuration (show | set <key> <value> | reset)')
  .action(configCommand);

// Show help if no subcommand given
if (!process.argv.slice(2).length) {
  program.outputHelp();
} else {
  program.parse(process.argv);
}
