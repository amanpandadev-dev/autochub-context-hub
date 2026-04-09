import * as fs from 'fs';
import * as path from 'path';

const CONFIG_FILE = path.join(process.cwd(), '.autochubrc.json');

interface Config {
  memgraph?: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
  analysis?: {
    excludeDirs?: string[];
    extensions?: string[];
  };
  output?: {
    format?: string;
    directory?: string;
  };
}

export async function configCommand(action?: string, key?: string, value?: string) {
  try {
    const config = loadConfig();

    switch (action) {
      case 'get':
        handleGet(config, key);
        break;
      case 'set':
        handleSet(config, key, value);
        break;
      case 'list':
        handleList(config);
        break;
      case 'reset':
        handleReset();
        break;
      default:
        handleList(config);
    }
  } catch (error) {
    console.error('❌ Config command failed:', error);
    process.exit(1);
  }
}

function loadConfig(): Config {
  if (fs.existsSync(CONFIG_FILE)) {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  }
  return {};
}

function saveConfig(config: Config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(`✓ Configuration saved to ${CONFIG_FILE}\n`);
}

function handleGet(config: Config, key?: string) {
  if (!key) {
    console.log('❌ Please specify a key\n');
    console.log('Usage: autochub config get <key>\n');
    console.log('Available keys:');
    console.log('  memgraph.host');
    console.log('  memgraph.port');
    console.log('  memgraph.username');
    console.log('  memgraph.password');
    console.log('  analysis.excludeDirs');
    console.log('  analysis.extensions');
    console.log('  output.format');
    console.log('  output.directory\n');
    return;
  }

  const keys = key.split('.');
  let value: any = config;

  for (const k of keys) {
    value = value?.[k];
  }

  if (value === undefined) {
    console.log(`❌ Key not found: ${key}\n`);
  } else {
    console.log(`${key}: ${JSON.stringify(value)}\n`);
  }
}

function handleSet(config: Config, key?: string, value?: string) {
  if (!key || !value) {
    console.log('❌ Please specify key and value\n');
    console.log('Usage: autochub config set <key> <value>\n');
    return;
  }

  const keys = key.split('.');
  let current: any = config;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!current[k]) {
      current[k] = {};
    }
    current = current[k];
  }

  const lastKey = keys[keys.length - 1];
  current[lastKey] = parseValue(value);

  saveConfig(config);
  console.log(`✓ Set ${key} = ${value}\n`);
}

function handleList(config: Config) {
  console.log('\n📋 Current Configuration:\n');

  if (Object.keys(config).length === 0) {
    console.log('No configuration set. Use: autochub config set <key> <value>\n');
    return;
  }

  console.log(JSON.stringify(config, null, 2));
  console.log();
}

function handleReset() {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
    console.log(`✓ Configuration reset\n`);
  } else {
    console.log('No configuration file found\n');
  }
}

function parseValue(value: string): any {
  // Try to parse as JSON
  try {
    return JSON.parse(value);
  } catch {
    // Return as string
    return value;
  }
}
