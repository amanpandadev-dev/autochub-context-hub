import * as fs from 'fs';
import * as path from 'path';

interface FixOptions {
  dryRun?: boolean;
  autoApprove?: boolean;
  useLlm?: boolean;
  backup?: boolean;
  severity?: string;
}

export async function fixCommand(projectPath: string = '.', options: FixOptions) {
  try {
    console.log('\n🔧 Auto-CHUB Fixer\n');
    console.log(`📁 Fixing: ${path.resolve(projectPath)}\n`);

    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be applied\n');
    }

    // Find deprecated patterns
    const findings = findDeprecatedPatterns(projectPath);

    if (findings.length === 0) {
      console.log('✓ No deprecated APIs found!\n');
      return;
    }

    console.log(`Found ${findings.length} deprecated API usages\n`);

    // Create backup if requested
    if (options.backup && !options.dryRun) {
      console.log('💾 Creating backup...');
      createBackup(projectPath);
      console.log('✓ Backup created\n');
    }

    // Apply fixes
    const fixes = [
      {
        pattern: 'ChatCompletion.create',
        replacement: 'client.chat.completions.create',
        description: 'OpenAI API migration',
      },
      {
        pattern: 'ReactDOM.render',
        replacement: 'createRoot().render',
        description: 'React 18 migration',
      },
      {
        pattern: 'new Buffer',
        replacement: 'Buffer.from',
        description: 'Node.js Buffer API',
      },
    ];

    let fixedCount = 0;

    for (const fix of fixes) {
      const matchingFindings = findings.filter(f => f.pattern === fix.pattern);
      if (matchingFindings.length === 0) continue;

      console.log(`\n🔄 Fixing: ${fix.pattern}`);
      console.log(`   → ${fix.replacement}`);
      console.log(`   📝 ${fix.description}`);
      console.log(`   📊 Found in ${matchingFindings.length} locations\n`);

      if (!options.dryRun) {
        for (const finding of matchingFindings) {
          try {
            const content = fs.readFileSync(finding.file, 'utf-8');
            const fixed = content.replace(
              new RegExp(escapeRegex(fix.pattern), 'g'),
              fix.replacement
            );

            fs.writeFileSync(finding.file, fixed);
            console.log(`   ✓ Fixed: ${finding.file}:${finding.line}`);
            fixedCount++;
          } catch (error) {
            console.error(`   ✗ Failed to fix: ${finding.file}`);
          }
        }
      } else {
        console.log(`   [DRY RUN] Would fix ${matchingFindings.length} occurrences`);
        matchingFindings.forEach(f => {
          console.log(`   [DRY RUN] ${f.file}:${f.line}`);
        });
      }
    }

    // Summary
    console.log('\n📊 Summary:');
    if (options.dryRun) {
      console.log(`   Would fix: ${findings.length} issues`);
      console.log('   Status: DRY RUN (no changes applied)\n');
    } else {
      console.log(`   Fixed: ${fixedCount} issues`);
      console.log('   Status: ✓ Complete\n');
    }
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

interface Finding {
  file: string;
  line: number;
  pattern: string;
  code: string;
}

function findDeprecatedPatterns(projectPath: string): Finding[] {
  const files = findSourceFiles(projectPath);
  const findings: Finding[] = [];

  const deprecatedPatterns = [
    'ChatCompletion.create',
    'ReactDOM.render',
    'new Buffer',
    'CancelToken',
  ];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, i) => {
        for (const pattern of deprecatedPatterns) {
          if (line.includes(pattern)) {
            findings.push({
              file,
              line: i + 1,
              pattern,
              code: line.trim(),
            });
          }
        }
      });
    } catch (error) {
      // Skip files that can't be read
    }
  }

  return findings;
}

function findSourceFiles(projectPath: string): string[] {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'out'];

  const walk = (dir: string) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.') || excludeDirs.includes(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  };

  walk(projectPath);
  return files;
}

function createBackup(projectPath: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(projectPath, `.backup-${timestamp}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const files = findSourceFiles(projectPath);
  for (const file of files) {
    const relativePath = path.relative(projectPath, file);
    const backupPath = path.join(backupDir, relativePath);
    const backupFileDir = path.dirname(backupPath);

    if (!fs.existsSync(backupFileDir)) {
      fs.mkdirSync(backupFileDir, { recursive: true });
    }

    fs.copyFileSync(file, backupPath);
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
