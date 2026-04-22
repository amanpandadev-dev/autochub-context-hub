const DEPRECATION_CONTEXT_RE = /\b(deprecated|deprecation|legacy|removed|sunset)\b/i;
const MIGRATION_CONTEXT_RE = /\b(replaced by|replace .* with|use .* instead|migrat(e|ion)|switch to)\b/i;
const INLINE_CODE_RE = /`([^`]+)`/g;
const API_PATTERN_RE = /\b[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)+\s*\(\)?|\b[A-Za-z_][\w$]*\s*\(\)/g;

export function extractDeprecatedMethodsFromMarkdown(markdown: string, limit = 25): string[] {
  const lines = markdown.split('\n');
  const found = new Set<string>();
  let contextActive = false;

  for (const line of lines) {
    const hasContext = DEPRECATION_CONTEXT_RE.test(line) || MIGRATION_CONTEXT_RE.test(line);
    if (hasContext) {
      contextActive = true;
    } else if (!line.trim()) {
      contextActive = false;
    }

    if (!hasContext && !contextActive) continue;

    for (const token of extractCandidateTokens(line)) {
      if (!looksLikeApiSymbol(token)) continue;
      found.add(normalizeApiSymbol(token));
      if (found.size >= limit) {
        return [...found];
      }
    }
  }

  return [...found];
}

export function extractReplacementHintsFromMarkdown(markdown: string, limit = 25): string[] {
  const lines = markdown.split('\n');
  const hints = new Set<string>();

  for (const line of lines) {
    if (!MIGRATION_CONTEXT_RE.test(line)) continue;

    for (const token of extractCandidateTokens(line)) {
      if (!looksLikeApiSymbol(token)) continue;
      const normalized = normalizeApiSymbol(token);
      hints.add(normalized);
      if (hints.size >= limit) {
        return [...hints];
      }
    }
  }

  return [...hints];
}

export function looksLikeApiSymbol(token: string): boolean {
  const cleaned = token.trim();
  if (cleaned.length < 3 || cleaned.length > 120) return false;
  if (!/[A-Za-z]/.test(cleaned)) return false;
  if (/^https?:\/\//i.test(cleaned)) return false;
  if (/^[\d.\-_/]+$/.test(cleaned)) return false;
  if (cleaned.includes(' ')) return false;
  if (/^[A-Z0-9_]+$/.test(cleaned)) return false;
  if (/^v\d+(\.\d+)*$/i.test(cleaned)) return false;

  return (
    /^[A-Za-z_][\w$]*\(\)$/.test(cleaned) ||
    /^[A-Za-z_][\w$]*\.[A-Za-z_][\w$.]*\(\)?$/.test(cleaned) ||
    /^[A-Za-z_][\w$]*\.[A-Za-z_][\w$.]*$/.test(cleaned)
  );
}

function extractCandidateTokens(line: string): string[] {
  const tokens = new Set<string>();

  for (const inline of extractInlineCode(line)) {
    tokens.add(inline);
  }

  const plainMatches = line.match(API_PATTERN_RE) ?? [];
  for (const match of plainMatches) {
    tokens.add(match);
  }

  return [...tokens];
}

function extractInlineCode(line: string): string[] {
  const tokens: string[] = [];
  INLINE_CODE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_CODE_RE.exec(line)) !== null) {
    const value = match[1].trim();
    if (value) tokens.push(value);
  }
  return tokens;
}

function normalizeApiSymbol(symbol: string): string {
  return symbol
    .trim()
    .replace(/[.,;:]+$/g, '')
    .replace(/\s+/g, '');
}
