#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeCommand } from './commands/analyze';
import { fixCommand } from './commands/fix';
import { reportCommand } from './commands/report';
import { configCommand } from './commands/config';

const program = new Command();

program
  .name('autochub')
  .description('Detect and fix deprecated API calls with Memgraph analysis')
  .version('1.0.0');

// Analyze command
program
  .command('analyze [path]')
  .description('Analyze codebase for deprecated APIs')
  .option('--with-graph', 'Use Memgraph for deep analysis')
  .option('--lang <language>', 'Filter by language (js, ts, py, go, java, cs)')
  .option('--output <format>', 'Output format (json, html, markdown)', 'json')
  .option('--severity <level>', 'Filter by severity (critical, warning, info)')
  .option('--exclude <patterns>', 'Exclude file patterns')
  .option('--max-results <number>', 'Limit results')
  .option('--github-links', 'Include GitHub documentation links')
  .action(analyzeCommand);

// Fix command
program
  .command('fix [path]')
  .description('Apply fixes to deprecated APIs')
  .option('--dry-run', 'Preview changes without applying')
  .option('--auto-approve', 'Apply all fixes without confirmation')
  .option('--use-llm', 'Use LLM for intelligent migrations')
  .option('--backup', 'Create backup before fixing')
  .option('--severity <level>', 'Only fix issues of this severity')
  .action(fixCommand);

// Report command
program
  .command('report [path]')
  .description('Generate deprecation report')
  .option('--format <format>', 'Output format (html, json, markdown, csv)', 'html')
  .option('--include-timeline', 'Show deprecation timeline')
  .option('--include-metrics', 'Show migration metrics')
  .option('--output <file>', 'Save to file')
  .action(reportCommand);

// Config command
program
  .command('config [action] [key] [value]')
  .description('Manage configuration')
  .action(configCommand);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
