import { ChubDoc } from '../chub';
import {
  extractDeprecatedMethodsFromMarkdown,
  extractReplacementHintsFromMarkdown,
} from './doc-extraction';

interface FetchDocsOptions {
  repo?: string;
  branch?: string;
  maxDocs?: number;
  includeContent?: boolean;
}

interface TreeEntry {
  path: string;
  type: 'blob' | 'tree' | string;
}

export class GithubFetcher {
  private readonly defaultRepo = 'andrewyng/context-hub';
  private readonly defaultBranch = 'main';
  private readonly defaultMaxDocs = 250;
  private readonly timeoutMs = 12000;
  private readonly jsonCandidates = [
    '.autochub-docs.json',
    'content/.autochub-docs.json',
    'docs/.autochub-docs.json',
    'content/registry.json',
    'registry.json',
  ];

  /**
   * Pull docs metadata from Andrew Ng's Context Hub repo.
   * We try a JSON registry first, then fall back to scanning markdown DOC files in /content.
   */
  public async fetchDocs(repoOrOptions?: string | FetchDocsOptions): Promise<ChubDoc[]> {
    const options = this.normalizeOptions(repoOrOptions);
    const { repo, branch, maxDocs } = options;

    const registryDocs = await this.fetchFromJsonCandidates(repo, branch);
    if (registryDocs.length > 0) {
      return this.limitDocs(registryDocs, maxDocs);
    }

    const treeDocs = await this.fetchFromContentTree(options);
    return this.limitDocs(treeDocs, maxDocs);
  }

  private normalizeOptions(repoOrOptions?: string | FetchDocsOptions): Required<FetchDocsOptions> {
    if (typeof repoOrOptions === 'string') {
      const parsed = this.parseRepoWithBranch(repoOrOptions);
      return {
        repo: parsed.repo,
        branch: parsed.branch,
        maxDocs: this.defaultMaxDocs,
        includeContent: true,
      };
    }

    const parsed = this.parseRepoWithBranch(repoOrOptions?.repo ?? this.defaultRepo);
    return {
      repo: parsed.repo,
      branch: repoOrOptions?.branch ?? parsed.branch,
      maxDocs: repoOrOptions?.maxDocs ?? this.defaultMaxDocs,
      includeContent: repoOrOptions?.includeContent ?? true,
    };
  }

  private parseRepoWithBranch(rawRepo: string): { repo: string; branch: string } {
    const trimmed = rawRepo.trim();
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex > 0) {
      return {
        repo: trimmed.slice(0, atIndex).trim(),
        branch: trimmed.slice(atIndex + 1).trim() || this.defaultBranch,
      };
    }
    return { repo: trimmed || this.defaultRepo, branch: this.defaultBranch };
  }

  private async fetchFromJsonCandidates(repo: string, branch: string): Promise<ChubDoc[]> {
    for (const candidatePath of this.jsonCandidates) {
      const url = this.toRawUrl(repo, branch, candidatePath);
      const json = await this.fetchJson(url);
      if (!json) continue;

      const docs = this.normalizeJsonDocs(json, repo, branch);
      if (docs.length > 0) return docs;
    }

    return [];
  }

  private async fetchFromContentTree(options: Required<FetchDocsOptions>): Promise<ChubDoc[]> {
    const treeUrl = `https://api.github.com/repos/${options.repo}/git/trees/${options.branch}?recursive=1`;
    const treeResponse = await this.fetchJson(treeUrl);
    const tree = this.extractTreeEntries(treeResponse);

    if (tree.length === 0) return [];

    const docPaths = tree
      .filter((entry) => entry.type === 'blob')
      .map((entry) => entry.path)
      .filter((p) => /\/DOC\.md$/i.test(p) && p.toLowerCase().startsWith('content/'))
      .slice(0, options.maxDocs);

    if (docPaths.length === 0) return [];

    const docs: ChubDoc[] = [];
    const concurrency = 8;

    for (let i = 0; i < docPaths.length; i += concurrency) {
      const batch = docPaths.slice(i, i + concurrency);
      const batchDocs = await Promise.all(
        batch.map(async (docPath) => {
          const rawUrl = this.toRawUrl(options.repo, options.branch, docPath);
          const markdown = await this.fetchText(rawUrl);
          if (!markdown) return null;
          return this.parseDocMarkdown(docPath, markdown, options.repo, options.branch, options.includeContent);
        })
      );

      for (const parsed of batchDocs) {
        if (parsed) docs.push(parsed);
      }
    }

    return docs;
  }

  private extractTreeEntries(raw: unknown): TreeEntry[] {
    if (!raw || typeof raw !== 'object') return [];
    const maybeTree = (raw as { tree?: unknown }).tree;
    if (!Array.isArray(maybeTree)) return [];

    const entries: TreeEntry[] = [];
    for (const item of maybeTree) {
      if (!item || typeof item !== 'object') continue;
      const path = (item as { path?: unknown }).path;
      const type = (item as { type?: unknown }).type;
      if (typeof path !== 'string' || typeof type !== 'string') continue;
      entries.push({ path, type });
    }
    return entries;
  }

  private parseDocMarkdown(
    filePath: string,
    markdown: string,
    repo: string,
    branch: string,
    includeContent: boolean
  ): ChubDoc {
    const { frontmatter, body } = this.parseFrontmatter(markdown);
    const parsedPath = this.parseDocPath(filePath);
    const baseId = parsedPath.docId ?? frontmatter.id ?? this.pathToId(filePath);

    const title =
      frontmatter.title ||
      frontmatter.name ||
      parsedPath.displayName ||
      baseId;

    const description =
      frontmatter.description ||
      frontmatter.summary ||
      this.firstParagraph(body);

    const deprecatedMethods = extractDeprecatedMethodsFromMarkdown(markdown);
    const replacementHints = extractReplacementHintsFromMarkdown(markdown);

    return {
      id: baseId,
      name: title,
      description,
      content: includeContent ? markdown : undefined,
      docsUrl: `https://github.com/${repo}/blob/${branch}/${filePath}`,
      source: 'github',
      deprecatedMethods,
      replacementHints,
      metadata: {
        repo,
        branch,
        path: filePath,
        provider: parsedPath.provider,
        language: parsedPath.language,
      },
    };
  }

  private parseFrontmatter(markdown: string): { frontmatter: Record<string, string>; body: string } {
    const lines = markdown.split('\n');
    if (lines[0]?.trim() !== '---') {
      return { frontmatter: {}, body: markdown };
    }

    let end = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        end = i;
        break;
      }
    }

    if (end < 0) {
      return { frontmatter: {}, body: markdown };
    }

    const fm: Record<string, string> = {};
    for (const line of lines.slice(1, end)) {
      const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
      if (!match) continue;
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      fm[key] = value;
    }

    return { frontmatter: fm, body: lines.slice(end + 1).join('\n').trim() };
  }

  private parseDocPath(filePath: string): {
    provider?: string;
    docName?: string;
    language?: string;
    docId?: string;
    displayName?: string;
  } {
    const parts = filePath.split('/').filter(Boolean);
    // Expected pattern: content/<provider>/docs/<doc>/<lang>/DOC.md
    if (parts.length < 4 || parts[0] !== 'content') {
      return {};
    }

    const provider = parts[1];
    const docsIndex = parts.indexOf('docs');
    if (docsIndex < 0 || docsIndex + 1 >= parts.length) {
      return { provider };
    }

    const docName = parts[docsIndex + 1];
    let language: string | undefined;
    if (parts.length > docsIndex + 3) {
      const maybeLanguage = parts[docsIndex + 2];
      if (maybeLanguage && !maybeLanguage.toLowerCase().endsWith('.md')) {
        language = maybeLanguage;
      }
    }

    const docId = `${provider}/${docName}`;
    const displayName = `${provider}/${docName}${language ? ` (${language})` : ''}`;
    return { provider, docName, language, docId, displayName };
  }

  private firstParagraph(markdown: string): string {
    const lines = markdown.split('\n');
    const chunk: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (chunk.length > 0) break;
        continue;
      }
      if (trimmed.startsWith('#')) continue;
      chunk.push(trimmed);
      if (chunk.join(' ').length > 240) break;
    }
    return chunk.join(' ').slice(0, 240);
  }

  private normalizeJsonDocs(payload: unknown, repo: string, branch: string): ChubDoc[] {
    const docsRaw = this.pickDocsArray(payload);
    if (!docsRaw) return [];

    const docs: ChubDoc[] = [];
    for (const item of docsRaw) {
      if (!item || typeof item !== 'object') continue;

      const asRecord = item as Record<string, unknown>;
      const id = this.str(asRecord.id) || this.str(asRecord.slug) || this.pathToId(this.str(asRecord.path) ?? '');
      const name = this.str(asRecord.name) || this.str(asRecord.title) || id;
      if (!id || !name) continue;

      const deprecatedMethods = this.toStringArray(
        asRecord.deprecatedMethods ?? asRecord.deprecated ?? asRecord.methods
      );
      const replacementHints = this.toStringArray(
        asRecord.replacementHints ?? asRecord.replacements
      );
      const docsPath = this.str(asRecord.path);

      docs.push({
        id,
        name,
        description: this.str(asRecord.description) || this.str(asRecord.summary),
        content: this.str(asRecord.content),
        docsUrl: docsPath
          ? `https://github.com/${repo}/blob/${branch}/${docsPath}`
          : `https://github.com/${repo}`,
        source: 'github',
        deprecatedMethods,
        replacementHints,
        metadata: {
          repo,
          branch,
          raw: asRecord,
        },
      });
    }

    return docs;
  }

  private pickDocsArray(payload: unknown): unknown[] | null {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return null;

    const rec = payload as Record<string, unknown>;
    const candidates = ['docs', 'items', 'entries', 'content'];
    for (const key of candidates) {
      if (Array.isArray(rec[key])) return rec[key] as unknown[];
    }
    return null;
  }

  private pathToId(pathValue: string): string {
    if (!pathValue) return '';
    const trimmed = pathValue.replace(/^\/+|\/+$/g, '');
    if (!trimmed) return '';

    const parts = trimmed.split('/');
    if (parts.length >= 4 && parts[0] === 'content' && parts[2] === 'docs') {
      return `${parts[1]}/${parts[3]}`;
    }
    return trimmed.replace(/\//g, '-').replace(/\.md$/i, '');
  }

  private str(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private limitDocs(docs: ChubDoc[], maxDocs: number): ChubDoc[] {
    if (docs.length <= maxDocs) return docs;
    return docs.slice(0, maxDocs);
  }

  private toRawUrl(repo: string, branch: string, repoPath: string): string {
    return `https://raw.githubusercontent.com/${repo}/${branch}/${repoPath}`;
  }

  private async fetchJson(url: string): Promise<unknown | null> {
    try {
      const response = await this.fetchWithTimeout(url);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  private async fetchText(url: string): Promise<string | null> {
    try {
      const response = await this.fetchWithTimeout(url);
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, {
        headers: {
          'User-Agent': 'autochub-context-hub',
          Accept: 'application/vnd.github+json',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
