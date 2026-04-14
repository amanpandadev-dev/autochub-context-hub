#!/usr/bin/env node
import * as path from 'path';
import * as fs from 'fs';

const CONFIG_FILE = '.autochub.json';

const DEFAULT_CONFIG = {
  version: '1.0.0',
  rules: [],
  options: {
    exclude: ['node_modules', 'dist', 'build', '.git', 'venv', 'env', '__pycache__'],
    severity: 'low',
    maxResults: 100,
  },
};

export async function initCommand(projectPath: string = '.') {
  const resolvedPath = path.resolve(projectPath);
  const configPath = path.join(resolvedPath, CONFIG_FILE);

  console.log('\n🚀  Auto-CHUB Init\n');

  if (fs.existsSync(configPath)) {
    console.log(`⚠️  Config already exists at: ${configPath}`);
    console.log('    Delete it and re-run to reset, or edit it directly.\n');
    return;
  }

  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');

  console.log(`✅  Created: ${configPath}\n`);
  console.log('You can now:');
  console.log('  • Add custom rules to the "rules" array in .autochub.json');
  console.log('  • Run:  autochub analyze .            (fast regex scan)');
  console.log('  • Run:  autochub analyze . --with-graph  (deep graph propagation)');
  console.log('  • Run:  autochub analyze . --use-chub    (enrich with Context Hub docs)');
  console.log('  • Run:  autochub sync --chub             (pull new rules from Context Hub)');
  console.log('  • Run:  autochub report . --format markdown --output REPORT.md');
  console.log('  • Run:  autochub rules               (list all built-in rules)\n');
}

export async function configCommand(action?: string, key?: string, value?: string) {
  const configPath = path.resolve(CONFIG_FILE);

  if (!action || action === 'show') {
    if (!fs.existsSync(configPath)) {
      console.log('ℹ️  No .autochub.json found. Run: autochub init\n');
      return;
    }
    console.log('\n📄  .autochub.json\n');
    console.log(fs.readFileSync(configPath, 'utf-8'));
    return;
  }

  if (action === 'set' && key && value) {
    let config = DEFAULT_CONFIG;
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    const keys = key.split('.');
    let obj: any = config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log(`✅  Set ${key} = ${value}`);
    return;
  }

  if (action === 'reset') {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
    console.log('✅  Config reset to defaults.');
    return;
  }

  console.log('Usage: autochub config [show|set <key> <value>|reset]');
}
