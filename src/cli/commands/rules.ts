#!/usr/bin/env node
import { BUILTIN_RULES } from '../../lib/memgraph/rules';
import { Severity } from '../../lib/memgraph/types';

const SEVERITY_ICON: Record<Severity, string> = {
  critical: '🔴', high: '🟠', medium: '🟡', low: '🔵',
};

export async function rulesCommand(options: { severity?: string; lang?: string }) {
  let rules = BUILTIN_RULES;

  if (options.severity) {
    rules = rules.filter(r => r.severity === options.severity);
  }
  if (options.lang) {
    rules = rules.filter(r => r.languages.includes(options.lang as any) || r.languages.includes('any'));
  }

  console.log(`\n📖  Auto-CHUB Built-in Rules  (${rules.length} total)\n`);

  for (const rule of rules) {
    const icon = SEVERITY_ICON[rule.severity] ?? '⚪';
    console.log(`  ${icon} [${rule.id}]`);
    console.log(`     ${rule.title}`);
    console.log(`     Severity: ${rule.severity}  |  Languages: ${rule.languages.join(', ')}`);
    console.log(`     Replace: ${rule.replacement}`);
    if (rule.docsUrl) console.log(`     Docs: ${rule.docsUrl}`);
    console.log();
  }

  console.log(`💡  Add custom rules to .autochub.json — run: autochub init\n`);
}
