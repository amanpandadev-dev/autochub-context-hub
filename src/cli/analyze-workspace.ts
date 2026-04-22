import * as fs from 'fs';
import * as path from 'path';
import { GraphEngine } from '../lib/memgraph/client';
import { CodeParser } from '../lib/memgraph/parser';
import { BUILTIN_RULES } from '../lib/memgraph/rules';

const WORKSPACE_PATH = path.join(__dirname, '..', '..', '..'); // Points to autochub-context root
const OUTPUT_PATH = path.join(__dirname, '..', '..', '..', 'analysis_results.json');

async function runAnalysis() {
  console.log(`Starting analysis of workspace: ${WORKSPACE_PATH}`);
  
  const graph = new GraphEngine();
  const parser = new CodeParser(graph, BUILTIN_RULES);
  
  const filesToScan: string[] = [];
  
  function getFiles(dir: string) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        if (item !== 'node_modules' && item !== '.git' && item !== 'dist' && item !== '.gemini') {
          getFiles(fullPath);
        }
      } else {
        const ext = path.extname(fullPath).toLowerCase();
        if (['.ts', '.js', '.py', '.java', '.go', '.cs'].includes(ext)) {
          filesToScan.push(fullPath);
        }
      }
    }
  }

  getFiles(WORKSPACE_PATH);
  console.log(`Found ${filesToScan.length} files to scan.`);

  const allFindings = [];
  
  for (const file of filesToScan) {
    // console.log(`Analyzing: ${path.relative(WORKSPACE_PATH, file)}`);
    const findings = parser.parseFile(file);
    if (findings.length > 0) {
      allFindings.push(...findings);
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    workspace: WORKSPACE_PATH,
    filesAnalyzed: filesToScan.map(f => path.relative(WORKSPACE_PATH, f)),
    findings: allFindings.map(f => ({
      ...f,
      filePath: path.relative(WORKSPACE_PATH, f.filePath)
    }))
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`Analysis complete. Found ${allFindings.length} issues.`);
  console.log(`Results saved to: ${OUTPUT_PATH}`);
}

runAnalysis().catch(err => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
