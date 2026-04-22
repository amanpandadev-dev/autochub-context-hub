import * as path from 'path';
import * as fs from 'fs';
import { ChubWrapper } from '../../lib/chub';
import { GithubFetcher } from '../../lib/github/fetcher';
import { GithubCache } from '../../lib/github/cache';
import { ChubDoc } from '../../lib/chub';
import { DeprecationRule } from '../../lib/memgraph/types';

interface SyncOptions {
  output?: string;
  url?: string;
  chub?: boolean;
  github?: boolean | string;
  bg?: boolean;
}

const DEFAULT_GITHUB_REPO = 'andrewyng/context-hub';
const DEFAULT_GITHUB_BRANCH = 'main';

export async function syncCommand(options: SyncOptions) {
  if (!options.bg) console.log('\n🔄  Auto-CHUB Sync\n');

  const customRulesPath = path.resolve('.autochub.json');
  let config: any = { rules: [] };
  if (fs.existsSync(customRulesPath)) {
    try {
      config = JSON.parse(fs.readFileSync(customRulesPath, 'utf-8'));
    } catch { /* ignore */ }
  }

  const newRules: DeprecationRule[] = [];

  if (options.url) {
    if (!options.bg) console.log(`🌐  Fetching rules from: ${options.url}`);
    // Future: implement fetch from URL
  }

  if (options.github || options.github === true) {
    const { repo, branch } = parseGithubTarget(
      typeof options.github === 'string' ? options.github : undefined
    );
    if (!options.bg) console.log(`🐙  Pulling docs from GitHub (${repo}@${branch})...`);
    
    const fetcher = new GithubFetcher();
    const docs = await fetcher.fetchDocs({
      repo,
      branch,
      maxDocs: 400,
      includeContent: true,
    });
    
    if (docs && docs.length > 0) {
      if (!options.bg) console.log(`✅  Successfully fetched ${docs.length} docs from GitHub.`);
      const cache = new GithubCache();
      cache.saveCacheData(docs, { repo, branch });
      if (!options.bg) {
        console.log(`💾  Offline docs cache updated at ${cache.getDocsDirectory()}`);
      }
      
      newRules.push(...buildRulesFromDocs(docs));
    } else {
      if (!options.bg) console.warn('⚠️  Could not fetch docs from GitHub (empty or failed).');

      const cache = new GithubCache();
      const cacheData = cache.getCacheData();
      if (!options.bg && cacheData?.docs?.length) {
        console.log(`ℹ️   Using existing offline cache (${cacheData.docs.length} docs).`);
      }
    }
  }

  if (options.chub) {
    if (!options.bg) console.log('📚  Scanning Context Hub (chub) for new deprecation hints...');
    const wrapper = new ChubWrapper();
    if (wrapper.isAvailable()) {
      const results = await wrapper.search('deprecated');
      for (const res of results) {
        newRules.push({
          id: `chub/${res.id}`,
          title: res.name,
          pattern: buildRegexForApiSymbol(res.name) ?? escapeRegex(res.name),
          severity: 'medium',
          languages: ['any'],
          guidance: res.description || 'Refer to Context Hub docs',
          replacement: 'Refer to Context Hub docs',
          docsUrl: `https://aichub.org/v1/docs/${res.id}`
        });
      }
      if (!options.bg) console.log(`✅  Found ${results.length} potentials in CHUB.`);
    } else {
      if (!options.bg) console.warn('⚠️  Context Hub (chub) CLI not found. It should be installed as a dependency.');
    }
  }

  if (newRules.length > 0) {
    config.rules = [...(config.rules || []), ...newRules];
    // Remove duplicates by ID
    config.rules = Array.from(new Map(config.rules.map((r: any) => [r.id, r])).values());
    
    fs.writeFileSync(customRulesPath, JSON.stringify(config, null, 2) + '\n');
    if (!options.bg) console.log(`✅  Synced ${newRules.length} new or updated rules to .autochub.json`);
  } else if (options.url || options.chub || options.github) {
    if (!options.bg) console.log('ℹ️   No new rules found to sync.');
  } else {
    if (!options.bg) console.log('💡  Usage: autochub sync --chub  (to pull from Context Hub), or --github (to pull from GitHub)');
  }

  console.log();
}

function parseGithubTarget(value?: string): { repo: string; branch: string } {
  if (!value) {
    return { repo: DEFAULT_GITHUB_REPO, branch: DEFAULT_GITHUB_BRANCH };
  }

  const trimmed = value.trim();
  const at = trimmed.lastIndexOf('@');
  if (at > 0) {
    return {
      repo: trimmed.slice(0, at),
      branch: trimmed.slice(at + 1) || DEFAULT_GITHUB_BRANCH,
    };
  }

  return { repo: trimmed, branch: DEFAULT_GITHUB_BRANCH };
}

function buildRulesFromDocs(docs: ChubDoc[]): DeprecationRule[] {
  const rules: DeprecationRule[] = [];

  for (const doc of docs) {
    const methods = doc.deprecatedMethods ?? [];
    if (methods.length === 0) continue;

    for (const method of methods) {
      const pattern = buildRegexForApiSymbol(method);
      if (!pattern) continue;

      rules.push({
        id: `github/${doc.id}/${slugify(method)}`,
        title: `${method} is deprecated`,
        pattern,
        severity: 'high',
        languages: ['any'],
        guidance: doc.description || `Deprecated API guidance from ${doc.name}`,
        replacement: doc.replacementHints?.[0] || 'See cached CHUB docs',
        docsUrl: doc.docsUrl,
      });
    }
  }

  return rules;
}

function buildRegexForApiSymbol(symbol: string): string | null {
  const normalized = symbol.trim();
  if (!normalized || normalized.length < 2) return null;

  const noTicks = normalized.replace(/`/g, '');
  if (/^[A-Za-z_][\w$]*(\.[A-Za-z_][\w$]*)+\(\)$/.test(noTicks)) {
    const base = noTicks.slice(0, -2);
    return `${escapeRegex(base)}\\s*\\(`;
  }
  if (/^[A-Za-z_][\w$]*(\.[A-Za-z_][\w$]*)+\(/.test(noTicks)) {
    return escapeRegex(noTicks).replace(/\\\(/g, '\\s*\\(');
  }
  if (/^[A-Za-z_][\w$]*\(\)$/.test(noTicks)) {
    const base = noTicks.slice(0, -2);
    return `\\b${escapeRegex(base)}\\s*\\(`;
  }
  if (/^[A-Za-z_][\w$]*(\.[A-Za-z_][\w$]*)+$/.test(noTicks)) {
    return escapeRegex(noTicks);
  }
  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
