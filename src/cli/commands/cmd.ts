#!/usr/bin/env node

interface CommandGuide {
  name: string;
  usage: string;
  useCase: string;
  examples: string[];
}

const COMMANDS: CommandGuide[] = [
  {
    name: 'init',
    usage: 'autochub init [path]',
    useCase: 'Create a .autochub.json config file before scanning a project.',
    examples: [
      'autochub init',
      'autochub init ./my-project',
    ],
  },
  {
    name: 'analyze',
    usage: 'autochub analyze [path] [options]',
    useCase: 'Scan source files, find deprecated APIs, and create an HTML findings report.',
    examples: [
      'autochub analyze .',
      'autochub analyze src --with-graph',
      'autochub analyze . --no-open-report',
      'autochub analyze . --severity high --output json',
    ],
  },
  {
    name: 'fix',
    usage: 'autochub fix [path] [options]',
    useCase: 'Preview or apply safe automatic replacements for supported findings.',
    examples: [
      'autochub fix . --dry-run',
      'autochub fix src --backup',
    ],
  },
  {
    name: 'report',
    usage: 'autochub report [path] [options]',
    useCase: 'Generate a shareable migration report in markdown, JSON, or CSV.',
    examples: [
      'autochub report .',
      'autochub report . --format markdown --include-metrics --include-timeline --output REPORT.md',
    ],
  },
  {
    name: 'rules',
    usage: 'autochub rules [options]',
    useCase: 'List built-in deprecation rules and filter them by language or severity.',
    examples: [
      'autochub rules',
      'autochub rules --lang ts',
      'autochub rules --severity critical',
    ],
  },
  {
    name: 'sync',
    usage: 'autochub sync [options]',
    useCase: 'Refresh local documentation caches and add discovered rules from Context Hub or GitHub docs.',
    examples: [
      'autochub sync --github',
      'autochub sync --github andrewyng/context-hub@main',
      'autochub sync --chub',
    ],
  },
  {
    name: 'cache-health',
    usage: 'autochub cache-health [options]',
    useCase: 'Check whether the offline docs cache is present, fresh, stale, or empty.',
    examples: [
      'autochub cache-health',
      'autochub cache-health --output json',
    ],
  },
  {
    name: 'config',
    usage: 'autochub config [show|set|reset]',
    useCase: 'Inspect, update, or reset Auto-CHUB project configuration.',
    examples: [
      'autochub config show',
      'autochub config set options.maxResults 50',
      'autochub config reset',
    ],
  },
  {
    name: 'cmd',
    usage: 'autochub cmd [command]',
    useCase: 'Show this command guide, or focus on one command and its examples.',
    examples: [
      'autochub cmd',
      'autochub cmd analyze',
    ],
  },
];

export async function cmdCommand(commandName?: string) {
  const normalizedName = commandName?.trim().toLowerCase();

  if (normalizedName) {
    const command = COMMANDS.find((item) => item.name === normalizedName);
    if (!command) {
      console.log(`\nUnknown Auto-CHUB command: ${commandName}\n`);
      console.log('Run `autochub cmd` to see all available commands.\n');
      return;
    }

    printCommand(command);
    return;
  }

  console.log('\nAuto-CHUB Command Guide\n');
  console.log('Use this as a quick map from task to command.\n');

  for (const command of COMMANDS) {
    console.log(`${command.name}`);
    console.log(`  Usage: ${command.usage}`);
    console.log(`  Use case: ${command.useCase}`);
    console.log(`  Example: ${command.examples[0]}`);
    console.log();
  }

  console.log('Common workflow:');
  console.log('  1. autochub init');
  console.log('  2. autochub sync --github');
  console.log('  3. autochub analyze . --with-graph');
  console.log('  4. autochub fix . --dry-run');
  console.log('  5. autochub report . --output REPORT.md');
  console.log();
  console.log('Tip: run `autochub cmd analyze` for focused examples.\n');
}

function printCommand(command: CommandGuide) {
  console.log(`\n${command.name}`);
  console.log(`  Usage: ${command.usage}`);
  console.log(`  Use case: ${command.useCase}`);
  console.log('  Examples:');

  for (const example of command.examples) {
    console.log(`    ${example}`);
  }

  console.log();
}
