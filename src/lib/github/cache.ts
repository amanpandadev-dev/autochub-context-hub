import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ChubDoc } from '../chub';

export interface GithubCacheData {
  schemaVersion: number;
  lastUpdated: number;
  sourceRepo?: string;
  sourceBranch?: string;
  docs: ChubDoc[];
}

export type GithubCacheHealthStatus = 'healthy' | 'stale' | 'missing' | 'empty';

export interface GithubCacheHealth {
  status: GithubCacheHealthStatus;
  cachePath: string;
  docsDir: string;
  docsCount: number;
  lastUpdated?: number;
  ageMs?: number;
  sourceRepo?: string;
  sourceBranch?: string;
}

export class GithubCache {
  private readonly schemaVersion = 2;
  private readonly cacheDir: string;
  private cachePath: string;
  private docsDir: string;

  constructor() {
    const preferredDir = path.join(os.homedir(), '.autochub');
    const workspaceFallback = path.join(process.cwd(), '.autochub');
    const tempFallback = path.join(os.tmpdir(), 'autochub-cache');

    const rootDir =
      this.canUseDirectory(preferredDir) ? preferredDir :
      this.canUseDirectory(workspaceFallback) ? workspaceFallback :
      tempFallback;

    this.cacheDir = rootDir;
    this.docsDir = path.join(this.cacheDir, 'docs');
    this.cachePath = path.join(this.cacheDir, 'github_cache.json');
    this.ensureDirectories();
  }

  public getCacheData(): GithubCacheData | null {
    if (!fs.existsSync(this.cachePath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(this.cachePath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<GithubCacheData>;
      if (!Array.isArray(parsed.docs)) return null;

      const docs = parsed.docs.map((doc) => this.ensureLocalDocFile(doc));
      return {
        schemaVersion: parsed.schemaVersion ?? 1,
        lastUpdated: parsed.lastUpdated ?? 0,
        sourceRepo: parsed.sourceRepo,
        sourceBranch: parsed.sourceBranch,
        docs,
      };
    } catch {
      return null;
    }
  }

  public saveCacheData(
    docs: ChubDoc[],
    source?: { repo?: string; branch?: string }
  ): void {
    const docsWithLocalCopies = docs.map((doc) => this.ensureLocalDocFile(doc));

    const data: GithubCacheData = {
      schemaVersion: this.schemaVersion,
      lastUpdated: Date.now(),
      sourceRepo: source?.repo,
      sourceBranch: source?.branch,
      docs: docsWithLocalCopies,
    };

    fs.writeFileSync(this.cachePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  public isCacheExpired(maxAgeMs = 24 * 60 * 60 * 1000): boolean {
    const data = this.getCacheData();
    if (!data) return true;
    return Date.now() - data.lastUpdated > maxAgeMs;
  }

  public getDocsDirectory(): string {
    return this.docsDir;
  }

  public getCachePath(): string {
    return this.cachePath;
  }

  public getHealth(maxAgeMs = 24 * 60 * 60 * 1000): GithubCacheHealth {
    const cacheData = this.getCacheData();

    if (!cacheData) {
      return {
        status: 'missing',
        cachePath: this.cachePath,
        docsDir: this.docsDir,
        docsCount: 0,
      };
    }

    const docsCount = cacheData.docs.length;
    const ageMs = Date.now() - cacheData.lastUpdated;

    let status: GithubCacheHealthStatus = 'healthy';
    if (docsCount === 0) {
      status = 'empty';
    } else if (ageMs > maxAgeMs) {
      status = 'stale';
    }

    return {
      status,
      cachePath: this.cachePath,
      docsDir: this.docsDir,
      docsCount,
      lastUpdated: cacheData.lastUpdated,
      ageMs,
      sourceRepo: cacheData.sourceRepo,
      sourceBranch: cacheData.sourceBranch,
    };
  }

  private ensureDirectories(): void {
    this.safeMkdir(this.cacheDir);
    this.safeMkdir(this.docsDir);
  }

  private canUseDirectory(dirPath: string): boolean {
    return this.safeMkdir(dirPath);
  }

  private safeMkdir(dirPath: string): boolean {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return true;
    } catch {
      return false;
    }
  }

  private ensureLocalDocFile(doc: ChubDoc): ChubDoc {
    const safeName = this.toSafeFileName(doc.id || doc.name || 'doc');
    const localPath = path.join(this.docsDir, `${safeName}.md`);
    const content = this.toDocContent(doc);

    try {
      if (content && !fs.existsSync(localPath)) {
        fs.writeFileSync(localPath, content, 'utf-8');
      } else if (content) {
        const existing = fs.readFileSync(localPath, 'utf-8');
        if (existing !== content) {
          fs.writeFileSync(localPath, content, 'utf-8');
        }
      }
    } catch {
      // Best-effort local persistence.
    }

    return {
      ...doc,
      localPath,
      source: doc.source ?? 'local',
    };
  }

  private toSafeFileName(value: string): string {
    const cleaned = value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return cleaned || 'doc';
  }

  private toDocContent(doc: ChubDoc): string {
    if (doc.content && doc.content.trim()) {
      return doc.content;
    }

    const lines: string[] = [];
    lines.push(`# ${doc.name || doc.id}`);
    if (doc.description) lines.push(`\n${doc.description}`);
    if (doc.docsUrl) lines.push(`\nSource: ${doc.docsUrl}`);
    if (doc.deprecatedMethods?.length) {
      lines.push('\nDeprecated methods:');
      for (const method of doc.deprecatedMethods) {
        lines.push(`- ${method}`);
      }
    }
    if (doc.replacementHints?.length) {
      lines.push('\nReplacement hints:');
      for (const replacement of doc.replacementHints) {
        lines.push(`- ${replacement}`);
      }
    }
    return lines.join('\n').trim();
  }
}
