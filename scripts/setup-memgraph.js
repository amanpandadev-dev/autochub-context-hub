#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';
const isLinux = os.platform() === 'linux';

console.log('\n🚀 Auto-CHUB Memgraph Setup\n');
console.log('This script will setup Memgraph for code analysis.\n');

// Check if Docker is installed
function checkDocker() {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if Memgraph is already running
async function checkMemgraphRunning() {
  try {
    const { Client } = require('memgraph');
    const client = new Client();
    await client.connect();
    await client.disconnect();
    return true;
  } catch {
    return false;
  }
}

// Start Memgraph with Docker
function startMemgraphDocker() {
  console.log('📦 Starting Memgraph with Docker...\n');
  
  try {
    // Check if container already exists
    try {
      execSync('docker ps -a | grep memgraph-autochub', { stdio: 'ignore' });
      console.log('✓ Stopping existing Memgraph container...');
      execSync('docker stop memgraph-autochub', { stdio: 'ignore' });
      execSync('docker rm memgraph-autochub', { stdio: 'ignore' });
    } catch {
      // Container doesn't exist, that's fine
    }

    // Start new container
    const cmd = isWindows
      ? 'docker run -d --name memgraph-autochub -p 7687:7687 memgraph/memgraph'
      : 'docker run -d --name memgraph-autochub -p 7687:7687 memgraph/memgraph';
    
    execSync(cmd, { stdio: 'inherit' });
    console.log('✓ Memgraph container started\n');
    
    // Wait for Memgraph to be ready
    console.log('⏳ Waiting for Memgraph to be ready...');
    let ready = false;
    let attempts = 0;
    
    while (!ready && attempts < 30) {
      try {
        execSync('docker exec memgraph-autochub memgraph-cli --query "RETURN 1"', { stdio: 'ignore' });
        ready = true;
      } catch {
        attempts++;
        execSync('timeout 1', { stdio: 'ignore' });
      }
    }
    
    if (ready) {
      console.log('✓ Memgraph is ready!\n');
      return true;
    } else {
      console.error('✗ Memgraph failed to start\n');
      return false;
    }
  } catch (error) {
    console.error('✗ Failed to start Memgraph:', error.message, '\n');
    return false;
  }
}

// Create .env file if it doesn't exist
function createEnvFile() {
  const envPath = path.join(process.cwd(), '.env.memgraph');
  
  if (!fs.existsSync(envPath)) {
    const envContent = `# Memgraph Configuration
MEMGRAPH_HOST=localhost
MEMGRAPH_PORT=7687
MEMGRAPH_USERNAME=memgraph
MEMGRAPH_PASSWORD=memgraph
`;
    fs.writeFileSync(envPath, envContent);
    console.log('✓ Created .env.memgraph configuration file\n');
  }
}

// Create docker-compose.yml for easy management
function createDockerCompose() {
  const composePath = path.join(process.cwd(), 'docker-compose.memgraph.yml');
  
  if (!fs.existsSync(composePath)) {
    const composeContent = `version: '3.8'

services:
  memgraph:
    image: memgraph/memgraph:latest
    container_name: memgraph-autochub
    ports:
      - "7687:7687"
    volumes:
      - memgraph_data:/var/lib/memgraph
    environment:
      - MEMGRAPH_ARGS=--bolt-port=7687

volumes:
  memgraph_data:
`;
    fs.writeFileSync(composePath, composeContent);
    console.log('✓ Created docker-compose.memgraph.yml\n');
  }
}

// Main setup function
async function setup() {
  try {
    // Check Docker
    if (!checkDocker()) {
      console.error('✗ Docker is not installed or not running');
      console.log('\nPlease install Docker from: https://www.docker.com/products/docker-desktop\n');
      process.exit(1);
    }
    console.log('✓ Docker is installed\n');

    // Check if Memgraph is already running
    console.log('🔍 Checking if Memgraph is already running...');
    const isRunning = await checkMemgraphRunning();
    
    if (isRunning) {
      console.log('✓ Memgraph is already running!\n');
    } else {
      // Start Memgraph
      const started = startMemgraphDocker();
      if (!started) {
        process.exit(1);
      }
    }

    // Create configuration files
    createEnvFile();
    createDockerCompose();

    // Create example usage file
    const examplePath = path.join(process.cwd(), 'examples', 'memgraph-example.ts');
    if (!fs.existsSync(path.dirname(examplePath))) {
      fs.mkdirSync(path.dirname(examplePath), { recursive: true });
    }

    if (!fs.existsSync(examplePath)) {
      const exampleContent = `import { MemgraphService } from '../src/lib/memgraph';

async function example() {
  const service = new MemgraphService();

  try {
    // Initialize
    await service.initialize();
    console.log('✓ Memgraph initialized');

    // Index your project
    await service.indexProject('./src');
    console.log('✓ Project indexed');

    // Get deprecation context
    const context = await service.getDeprecationContext('ChatCompletion.create');
    console.log('Deprecation Context:', JSON.stringify(context, null, 2));

    // Generate report
    const report = await service.generateReport();
    console.log('Report:', JSON.stringify(report, null, 2));
  } finally {
    await service.shutdown();
  }
}

example().catch(console.error);
`;
      fs.writeFileSync(examplePath, exampleContent);
      console.log('✓ Created example usage file\n');
    }

    console.log('✅ Setup complete!\n');
    console.log('📚 Next steps:');
    console.log('   1. npm install (if not already done)');
    console.log('   2. Check examples/memgraph-example.ts for usage');
    console.log('   3. Run: npm run dev\n');
    console.log('🛑 To stop Memgraph:');
    console.log('   docker stop memgraph-autochub\n');
    console.log('🔄 To restart Memgraph:');
    console.log('   docker start memgraph-autochub\n');

  } catch (error) {
    console.error('✗ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
setup();
