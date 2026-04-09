# Setup Guide - Memgraph for Auto-CHUB

## Prerequisites

- Node.js 16+ (already have it)
- Docker (required for Memgraph)
- npm (already have it)

## Installation Steps

### Step 1: One Command Setup
```bash
npm run setup
```

This will:
1. Install memgraph package
2. Start Memgraph in Docker
3. Create configuration files
4. Create example file
5. Display next steps

### Step 2: Verify Installation
```bash
# Check if Memgraph is running
docker ps | grep memgraph-autochub

# Should show:
# memgraph-autochub   memgraph/memgraph   Up X seconds   0.0.0.0:7687->7687/tcp
```

### Step 3: Try Example
```bash
npx ts-node examples/memgraph-example.ts
```

Expected output:
```
📊 Initializing Memgraph...
✓ Memgraph initialized

📁 Indexing project...
✓ Project indexed

🔍 Analyzing deprecated API: ChatCompletion.create

Deprecation Context:
  API Name: ChatCompletion.create
  Total Usages: 0
  Impacted Files: 0
  Risk Score: 0%
  Estimated Effort: Low

📋 Finding all deprecated APIs...
Found 0 deprecated APIs

📊 Generating report...
Report:
  Total Files: 0
  Total Deprecations: 0
  Files with Deprecations: 0

🛑 Shutting down...
✓ Done
```

## What Gets Installed

### New Dependency
```json
{
  "memgraph": "^1.0.0"
}
```

### New Files Created
```
src/lib/memgraph/
├── types.ts
├── client.ts
├── parser.ts
├── analyzer.ts
├── service.ts
└── index.ts

scripts/
└── setup-memgraph.js

examples/
└── memgraph-example.ts

.env.memgraph
docker-compose.memgraph.yml
```

### Configuration Files
```
.env.memgraph:
  MEMGRAPH_HOST=localhost
  MEMGRAPH_PORT=7687
  MEMGRAPH_USERNAME=memgraph
  MEMGRAPH_PASSWORD=memgraph

docker-compose.memgraph.yml:
  Memgraph service configuration
```

## Docker Management

### Start Memgraph
```bash
# Automatic (via setup)
npm run setup

# Manual
docker run -d --name memgraph-autochub -p 7687:7687 memgraph/memgraph

# Using Docker Compose
docker-compose -f docker-compose.memgraph.yml up -d
```

### Stop Memgraph
```bash
docker stop memgraph-autochub
```

### Restart Memgraph
```bash
docker start memgraph-autochub
```

### View Logs
```bash
docker logs memgraph-autochub
```

### Remove Memgraph
```bash
docker stop memgraph-autochub
docker rm memgraph-autochub
```

## Usage

### Basic Usage
```typescript
import { MemgraphService } from './src/lib/memgraph';

async function main() {
  const service = new MemgraphService();
  
  try {
    // Initialize
    await service.initialize();
    
    // Index your project
    await service.indexProject('./src');
    
    // Analyze
    const context = await service.getDeprecationContext('ChatCompletion.create');
    console.log(context);
    
  } finally {
    await service.shutdown();
  }
}

main().catch(console.error);
```

### Run Example
```bash
npx ts-node examples/memgraph-example.ts
```

### Integrate with Extension
```typescript
// In extension-template.ts
import { MemgraphService } from './lib/memgraph';

async function analyzeCurrentFileWithGraph() {
  const service = new MemgraphService();
  await service.initialize();
  
  try {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (workspace) {
      await service.indexProject(workspace.uri.fsPath);
    }
    
    // Get analysis
    const context = await service.getDeprecationContext('ChatCompletion.create');
    vscode.window.showInformationMessage(
      `Risk Score: ${context.riskScore}%`
    );
  } finally {
    await service.shutdown();
  }
}
```

## Troubleshooting

### Issue: Docker not installed
**Solution**: Install Docker from https://www.docker.com/products/docker-desktop

### Issue: Port 7687 already in use
**Solution**: 
```bash
# Find process using port
lsof -i :7687

# Kill process
kill -9 <PID>

# Or use different port
docker run -d -p 7688:7687 memgraph/memgraph
```

### Issue: Connection refused
**Solution**:
```bash
# Check if container is running
docker ps | grep memgraph

# Restart if needed
docker restart memgraph-autochub

# Check logs
docker logs memgraph-autochub
```

### Issue: Out of memory
**Solution**:
```bash
# Increase Docker memory
docker run -m 4g -p 7687:7687 memgraph/memgraph
```

### Issue: npm install fails
**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Try again
npm install
```

## Verification Checklist

- [ ] Docker is installed and running
- [ ] `npm run setup` completed successfully
- [ ] `docker ps` shows memgraph-autochub container
- [ ] Example runs without errors
- [ ] Can import MemgraphService in code

## Next Steps

1. **Explore the API**
   - Read `MEMGRAPH_IMPLEMENTATION.md`
   - Check `examples/memgraph-example.ts`

2. **Integrate with Extension**
   - Add Memgraph service to extension commands
   - Enhance analysis features

3. **Create CLI Commands**
   - `autochub analyze --with-graph`
   - `autochub report --format html`

4. **Deploy to Production**
   - Use Memgraph Cloud
   - Or self-host with Docker

## Support

### Documentation
- `MEMGRAPH_IMPLEMENTATION.md` - Full guide
- `QUICK_REFERENCE.md` - Quick reference
- `examples/memgraph-example.ts` - Working example

### Resources
- [Memgraph Docs](https://memgraph.com/docs)
- [Docker Docs](https://docs.docker.com)
- [TypeScript Docs](https://www.typescriptlang.org/docs)

## Summary

✅ **One command**: `npm run setup`  
✅ **Automatic Docker setup**  
✅ **Ready to use immediately**  
✅ **Well documented**  
✅ **Easy to integrate**  

You're all set! 🚀

