import { GithubCache } from '../../lib/github/cache';

interface CacheHealthOptions {
  output?: string;
  maxAgeHours?: string;
}

export async function cacheHealthCommand(options: CacheHealthOptions) {
  const output = (options.output || 'table').toLowerCase();
  const maxAgeHours = parseNumber(options.maxAgeHours, 24);
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  const cache = new GithubCache();
  const health = cache.getHealth(maxAgeMs);

  if (output === 'json') {
    console.log(JSON.stringify({
      ...health,
      maxAgeHours,
    }, null, 2));
    return;
  }

  const statusIcon = iconForStatus(health.status);
  console.log('\n🩺  Auto-CHUB Offline Cache Health\n');
  console.log(`Status: ${statusIcon} ${health.status.toUpperCase()}`);
  console.log(`Docs count: ${health.docsCount}`);
  console.log(`Cache file: ${health.cachePath}`);
  console.log(`Docs directory: ${health.docsDir}`);
  console.log(`Freshness window: ${maxAgeHours}h`);

  if (typeof health.lastUpdated === 'number') {
    console.log(`Last updated: ${new Date(health.lastUpdated).toISOString()}`);
  }
  if (typeof health.ageMs === 'number') {
    console.log(`Cache age: ${formatDuration(health.ageMs)}`);
  }
  if (health.sourceRepo) {
    console.log(`Source repo: ${health.sourceRepo}${health.sourceBranch ? `@${health.sourceBranch}` : ''}`);
  }

  console.log();
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function iconForStatus(status: string): string {
  switch (status) {
    case 'healthy':
      return '🟢';
    case 'stale':
      return '🟡';
    case 'empty':
      return '🟠';
    default:
      return '🔴';
  }
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / (60 * 1000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 48) return `${hours}h ${remMins}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

