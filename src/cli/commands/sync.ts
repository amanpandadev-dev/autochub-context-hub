import * as path from 'path';
import * as fs from 'fs';
import { MemgraphService } from '../../lib/memgraph/service';
import { ChubWrapper } from '../../lib/chub';

interface SyncOptions {
  output?: string;
  url?: string;
  chub?: boolean;
}

export async function syncCommand(options: SyncOptions) {
  console.log('\n🔄  Auto-CHUB Sync\n');

  const customRulesPath = path.resolve('.autochub.json');
  let config: any = { rules: [] };
  if (fs.existsSync(customRulesPath)) {
    try {
      config = JSON.parse(fs.readFileSync(customRulesPath, 'utf-8'));
    } catch { /* ignore */ }
  }

  const newRules: any[] = [];

  if (options.url) {
    console.log(`🌐  Fetching rules from: ${options.url}`);
    // Future: implement fetch from URL
  }

  if (options.chub) {
    console.log('📚  Scanning Context Hub (chub) for new deprecation hints...');
    const wrapper = new ChubWrapper();
    if (wrapper.isAvailable()) {
      const results = await wrapper.search('deprecated');
      for (const res of results) {
        newRules.push({
          id: `chub/${res.id}`,
          title: res.name,
          pattern: res.name.toLowerCase().replace(/ /g, '\\.'),
          severity: 'medium',
          languages: ['any'],
          guidance: res.description,
          replacement: 'Refer to Context Hub docs',
          docsUrl: `https://aichub.org/v1/docs/${res.id}`
        });
      }
      console.log(`✅  Found ${results.length} potentials in CHUB.`);
    } else {
      console.warn('⚠️  Context Hub (chub) CLI not found. It should be installed as a dependency.');
    }
  }

  if (newRules.length > 0) {
    config.rules = [...(config.rules || []), ...newRules];
    // Remove duplicates by ID
    config.rules = Array.from(new Map(config.rules.map((r: any) => [r.id, r])).values());
    
    fs.writeFileSync(customRulesPath, JSON.stringify(config, null, 2) + '\n');
    console.log(`✅  Synced ${newRules.length} new or updated rules to .autochub.json`);
  } else if (options.url || options.chub) {
    console.log('ℹ️   No new rules found to sync.');
  } else {
    console.log('💡  Usage: autochub sync --chub  (to pull from Andrew Ng\'s Context Hub)');
  }

  console.log();
}
