# Quick Reference - Memgraph Implementation

## One Command Setup
```bash
npm run setup
```

## Basic Usage
```typescript
import { MemgraphService } from './src/lib/memgraph';

const service = new MemgraphService();
await service.initialize();
await service.indexProject('./src');

const context = await service.getDeprecationContext('ChatCompletion.create');
console.log(context);

await service.shutdown();
```

## Key Methods

| Method | Purpose |
|--------|---------|
| `initialize()` | Connect to Memgraph |
| `indexProject(path)` | Index source files |
| `getDeprecationContext(api)` | Get API analysis |
| `findAllDeprecatedApis()` | Find all deprecated APIs |
| `generateReport()` | Generate full report |
| `shutdown()` | Cleanup |

## Docker Commands

| Command | Purpose |
|---------|---------|
| `docker run -d -p 7687:7687 memgraph/memgraph` | Start Memgraph |
| `docker stop memgraph-autochub` | Stop Memgraph |
| `docker start memgraph-autochub` | Restart Memgraph |
| `docker logs memgraph-autochub` | View logs |

## File Locations

| File | Purpose |
|------|---------|
| `src/lib/memgraph/` | Core implementation |
| `scripts/setup-memgraph.js` | Setup script |
| `examples/memgraph-example.ts` | Usage example |
| `.env.memgraph` | Configuration |
| `docker-compose.memgraph.yml` | Docker config |

## Response Format

```typescript
{
  apiName: 'ChatCompletion.create',
  totalUsages: 12,
  impactedFiles: 5,
  riskScore: 75,
  usages: [
    {
      functionName: 'chatWithOpenAI',
      filePath: 'src/chat.ts',
      lineNumber: 42
    }
  ],
  refactoringPath: {
    from: 'ChatCompletion.create',
    to: 'client.chat.completions.create',
    steps: ['Update 12 usages', 'Run tests', 'Update docs'],
    estimatedEffort: 'Medium'
  }
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection failed | `docker restart memgraph-autochub` |
| Port in use | `docker run -p 7688:7687 memgraph/memgraph` |
| Out of memory | `docker run -m 4g -p 7687:7687 memgraph/memgraph` |
| Slow queries | Create indexes: `CREATE INDEX ON :File(path)` |

## Performance

- **Indexing**: 1-2 sec per 100 files
- **Queries**: 10-500ms
- **Memory**: 50MB per 100 files

## Next Steps

1. Run: `npm run setup`
2. Try: `npx ts-node examples/memgraph-example.ts`
3. Integrate with extension
4. Create CLI commands

