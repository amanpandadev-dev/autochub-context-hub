import * as vscode from "vscode";
import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";

const EXTENSION_SOURCE = "Auto-CHUB";
const COMMAND_OPEN = "autochub.open";
const COMMAND_ANALYZE_CURRENT_FILE = "autochub.analyzeCurrentFile";
const COMMAND_ANALYZE_SELECTION = "autochub.analyzeSelection";
const COMMAND_APPLY_ALL_FIXES = "autochub.applyAllLatestFixes";
const COMMAND_APPLY_LLM_FIXES = "autochub.applyLlmFixes";
const COMMAND_DEBUG_SELECTION = "autochub.debugSelection";

interface OutdatedApiRule {
  id: string;
  title: string;
  pattern: RegExp;
  replacement?: string;
  quickFixLabel?: string;
  guidance: string;
  docsUrl?: string;
  isHeuristic?: boolean;
  efficiencyComparison?: string;
  sourceDocId?: string;
}

interface OutdatedApiFinding {
  rule: OutdatedApiRule;
  range: vscode.Range;
  matchText: string;
}

interface CustomOutdatedPatternDefinition {
  id?: string;
  title?: string;
  pattern?: string;
  flags?: string;
  replacement?: string;
  quickFixLabel?: string;
  guidance?: string;
  docsUrl?: string;
}

interface DetectionSettings {
  activeRules: OutdatedApiRule[];
  enableGenericLegacyDetector: boolean;
  genericLegacyMethodNames: string[];
}

interface ChubCliSettings {
  useContextHubCli: boolean;
  chubBinaryPath: string;
  contextHubMaxQueries: number;
  contextHubMaxDocs: number;
}

interface ContextHubDoc {
  id: string;
  title?: string;
  content: string;
  path?: string;
  githubUrl?: string;
}

interface ContextHubRuleResult {
  rules: OutdatedApiRule[];
  docs: ContextHubDoc[];
}

interface LlmFixesSettings {
  enabled: boolean;
  openRouterApiKey: string;
  openRouterModel: string;
  openRouterApiUrl: string;
  maxInputChars: number;
}

function startRealtimeLogs(
  output: vscode.OutputChannel,
  action: string,
  document?: vscode.TextDocument,
): void {
  const stamp = new Date().toISOString();
  const fileInfo = document ? ` | file=${document.fileName}` : "";
  output.show(true);
  output.appendLine(`[${stamp}] ===== ${action}${fileInfo} =====`);
}

interface ContextHubSearchEntry {
  id: string;
  name?: string;
  tags: string[];
  languages: string[];
  score: number;
}

interface DeprecatedSignatureEvidence {
  signature: string;
  replacement?: string;
  deprecationSummary: string;
  efficiencySummary?: string;
  lineNumber: number;
}

const DEFAULT_GENERIC_LEGACY_METHOD_NAMES = [
  "chat.completions.create",
  "createChatCompletion",
  "completions.create",
  "ReactDOM.render",
  "CancelToken",
  "new Buffer",
  "GoogleGenAI",
  "generateContent",
];

const CONTEXT_HUB_SIGNAL_TERMS = [
  "openai",
  "groq",
  "gemini",
  "genai",
  "anthropic",
  "azure",
  "chat",
  "completion",
  "responses",
  "axios",
  "reactdom",
  "buffer",
  "canceltoken",
];

const CONTEXT_HUB_NOISY_TERMS = new Set([
  "react",
  "react-dom",
  "react-markdown",
  "lucide-react",
  "motion",
  "motion/react",
  "clsx",
  "tailwind-merge",
  "vite",
  "express",
]);

const CONTEXT_HUB_PROVIDER_DOC_HINTS: Record<
  string,
  { detector: RegExp; docIds: string[]; queryHints: string[] }
> = {
  openai: {
    detector:
      /\bopenai\b|\bchat\.completions\.create\b|\bcreateChatCompletion\b|\bresponses\.create\b/i,
    docIds: ["openai/chat", "openai/package"],
    queryHints: ["openai chat", "openai responses", "openai sdk"],
  },
  gemini: {
    detector:
      /\bGoogleGenAI\b|@google\/genai|\bgenerateContent\b|\bgemini\b/i,
    docIds: ["gemini/genai"],
    queryHints: ["gemini genai", "gemini sdk", "google genai"],
  },
  groq: {
    detector: /\bgroq\b|\bgroq\.chat\.completions\.create\b/i,
    docIds: ["groq/package"],
    queryHints: ["groq", "groq sdk"],
  },
};

const CONTEXT_HUB_HEURISTIC_REPLACEMENTS = new Map<string, string>([
  ["chat.completions.create", "client.responses.create("],
  ["createchatcompletion", "responses.create("],
  ["completions.create", "responses.create("],
  ["reactdom.render", "createRoot("],
  ["newbuffer", "Buffer.from("],
  ["canceltoken", "AbortController"],
  ["googlegenai", "openrouterClient.responses.create("],
  ["generatecontent", "openrouterClient.responses.create("],
]);

const GENERIC_FALLBACK_DOC_LINKS = new Map<string, string>([
  [
    "chat.completions.create",
    "https://github.com/andrewyng/context-hub/blob/main/content/openai/docs/chat/javascript/DOC.md",
  ],
  [
    "completions.create",
    "https://github.com/andrewyng/context-hub/blob/main/content/openai/docs/chat/javascript/DOC.md",
  ],
  [
    "createchatcompletion",
    "https://github.com/andrewyng/context-hub/blob/main/content/openai/docs/chat/javascript/DOC.md",
  ],
  [
    "googlegenai",
    "https://github.com/andrewyng/context-hub/blob/main/content/gemini/docs/genai/javascript/DOC.md",
  ],
  [
    "generatecontent",
    "https://github.com/andrewyng/context-hub/blob/main/content/gemini/docs/genai/javascript/DOC.md",
  ],
  [
    "canceltoken",
    "https://github.com/andrewyng/context-hub/search?q=CancelToken&type=code",
  ],
  [
    "reactdom.render",
    "https://github.com/andrewyng/context-hub/search?q=ReactDOM.render&type=code",
  ],
  [
    "newbuffer",
    "https://github.com/andrewyng/context-hub/search?q=new+Buffer&type=code",
  ],
]);

const GENERIC_MEMBER_CALL_PATTERN =
  /\b((?:[A-Za-z_$][\w$]*\s*\.\s*)+[A-Za-z_$][\w$]*)\s*\(/g;
const GENERIC_CONSTRUCTOR_PATTERN = /\bnew\s+([A-Za-z_$][\w$]*)\s*\(/g;
const GENERIC_FUNCTION_CALL_PATTERN = /\b([A-Za-z_$][\w$]*)\s*\(/g;

const BUILTIN_OUTDATED_RULES: OutdatedApiRule[] = [
  {
    id: "openai-chat-completions",
    title: "OpenAI Chat Completions pattern detected",
    pattern: /\b(?:openai|client)\.chat\.completions\.create\s*\(/g,
    replacement: "client.responses.create(",
    quickFixLabel: "Switch to Responses API",
    guidance:
      "Use the Responses API for modern implementations and better tool/multimodal support.",
    docsUrl: "https://platform.openai.com/docs/api-reference/responses",
  },
  {
    id: "openai-create-chat-completion",
    title: "Legacy createChatCompletion call detected",
    pattern: /\bcreateChatCompletion\s*\(/g,
    replacement: "responses.create(",
    quickFixLabel: "Replace with responses.create",
    guidance:
      "This call shape is from older SDK versions. Prefer responses.create with current SDKs.",
    docsUrl: "https://platform.openai.com/docs/api-reference/responses",
  },
  {
    id: "reactdom-render",
    title: "ReactDOM.render is legacy in modern React",
    pattern: /\bReactDOM\.render\s*\(/g,
    replacement: "createRoot(",
    quickFixLabel: "Use createRoot(...)",
    guidance:
      "Use createRoot from react-dom/client for modern React apps.",
    docsUrl: "https://react.dev/reference/react-dom/client/createRoot",
  },
  {
    id: "axios-cancel-token",
    title: "Axios CancelToken is deprecated",
    pattern: /\bCancelToken\b/g,
    replacement: "AbortController",
    quickFixLabel: "Use AbortController",
    guidance:
      "Use AbortController and pass signal to axios requests instead of CancelToken.",
    docsUrl: "https://axios-http.com/docs/cancellation",
  },
  {
    id: "node-buffer-constructor",
    title: "Unsafe Buffer constructor detected",
    pattern: /\bnew\s+Buffer\s*\(/g,
    replacement: "Buffer.from(",
    quickFixLabel: "Use Buffer.from(...)",
    guidance:
      "Use Buffer.from or Buffer.alloc. new Buffer is legacy and discouraged.",
    docsUrl: "https://nodejs.org/api/buffer.html",
  },
];

let RULES_BY_ID = new Map<string, OutdatedApiRule>(
  BUILTIN_OUTDATED_RULES.map((rule) => [rule.id, rule]),
);

function rememberRules(rules: OutdatedApiRule[]): void {
  if (!rules.length) {
    return;
  }

  const merged = new Map<string, OutdatedApiRule>(RULES_BY_ID);
  for (const rule of rules) {
    merged.set(rule.id, rule);
  }
  RULES_BY_ID = merged;
}

function normalizePatternFlags(flags?: string): string {
  const raw = (flags || "").trim();
  return raw.includes("g") ? raw : `${raw}g`;
}

function sanitizeRuleId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeCallableName(input: string): string {
  return input.replace(/\s+/g, "").toLowerCase();
}

function loadDetectionSettings(): DetectionSettings {
  const config = vscode.workspace.getConfiguration("autochub");
  const enableGenericLegacyDetector =
    (config.get("enableGenericLegacyDetector") as boolean | undefined) ?? true;
  const configuredMethodNames = config.get(
    "genericLegacyMethodNames",
  ) as string[] | undefined;
  const genericLegacyMethodNames =
    Array.isArray(configuredMethodNames) && configuredMethodNames.length > 0
      ? configuredMethodNames.filter((item) => typeof item === "string" && item.trim().length > 0)
      : DEFAULT_GENERIC_LEGACY_METHOD_NAMES;

  const customRules = buildCustomRulesFromConfig(
    config.get("customOutdatedPatterns") as CustomOutdatedPatternDefinition[] | undefined,
  );

  return {
    activeRules: [...BUILTIN_OUTDATED_RULES, ...customRules],
    enableGenericLegacyDetector,
    genericLegacyMethodNames,
  };
}

function getContextHubOnlyDetectionSettings(): DetectionSettings {
  return {
    activeRules: [],
    enableGenericLegacyDetector: false,
    genericLegacyMethodNames: [],
  };
}

function loadChubCliSettings(): ChubCliSettings {
  const config = vscode.workspace.getConfiguration("autochub");
  const useContextHubCli =
    (config.get("useContextHubCli") as boolean | undefined) ?? true;
  const chubBinaryPath =
    (config.get("chubBinaryPath") as string | undefined)?.trim() || "chub";
  const contextHubMaxQueriesRaw = config.get("contextHubMaxQueries") as
    | number
    | undefined;
  const contextHubMaxDocsRaw = config.get("contextHubMaxDocs") as
    | number
    | undefined;

  return {
    useContextHubCli,
    chubBinaryPath,
    contextHubMaxQueries: Math.max(1, Math.min(10, contextHubMaxQueriesRaw ?? 4)),
    contextHubMaxDocs: Math.max(1, Math.min(10, contextHubMaxDocsRaw ?? 3)),
  };
}

function loadLlmFixesSettings(): LlmFixesSettings {
  const config = vscode.workspace.getConfiguration("autochub");
  const enabled =
    (config.get("enableLlmFixes") as boolean | undefined) ?? true;
  const configuredKey =
    (config.get("openRouterApiKey") as string | undefined)?.trim() || "";
  const envKey = (process.env.OPENROUTER_API_KEY || "").trim();
  const workspaceEnvKey = readKeyFromWorkspaceDotEnv("OPENROUTER_API_KEY") || "";
  const openRouterApiKey = configuredKey || envKey || workspaceEnvKey;

  return {
    enabled,
    openRouterApiKey,
    openRouterModel:
      (config.get("openRouterModel") as string | undefined)?.trim() ||
      "openrouter/auto",
    openRouterApiUrl:
      (config.get("openRouterApiUrl") as string | undefined)?.trim() ||
      "https://openrouter.ai/api/v1/chat/completions",
    maxInputChars: Math.max(
      8_000,
      Math.min(
        140_000,
        (config.get("llmFixesMaxInputChars") as number | undefined) || 80_000,
      ),
    ),
  };
}

function executeCli(
  binaryPath: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      CHUB_DISABLE_TELEMETRY: "1",
      CHUB_TELEMETRY_DISABLED: "1",
      DO_NOT_TRACK: "1",
    };

    execFile(
      binaryPath,
      args,
      { windowsHide: true, maxBuffer: 1024 * 1024 * 4, timeout: 30000, env },
      (error, stdout, stderr) => {
        const out = String(stdout || "");
        const err = String(stderr || "");

        if (error) {
          // CHUB can emit valid JSON and then fail while flushing telemetry.
          if (out.trim().length > 0 && /[\{\[]/.test(out)) {
            resolve({ stdout: out, stderr: err || String(error.message || "") });
            return;
          }

          const details = err || error.message || "Unknown CLI error";
          reject(new Error(details));
          return;
        }
        resolve({
          stdout: out,
          stderr: err,
        });
      },
    );
  });
}

function extractCliJsonText(raw: string): string {
  const trimmed = raw.trim();
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");

  let start = -1;
  if (firstBrace === -1) {
    start = firstBracket;
  } else if (firstBracket === -1) {
    start = firstBrace;
  } else {
    start = Math.min(firstBrace, firstBracket);
  }

  if (start === -1) {
    return trimmed;
  }

  const lastBrace = trimmed.lastIndexOf("}");
  const lastBracket = trimmed.lastIndexOf("]");
  const end = Math.max(lastBrace, lastBracket);

  if (end === -1 || end < start) {
    return trimmed;
  }

  return trimmed.slice(start, end + 1);
}

function parseCliJson<T>(raw: string): T | null {
  try {
    return JSON.parse(extractCliJsonText(raw)) as T;
  } catch {
    return null;
  }
}

function readKeyFromWorkspaceDotEnv(key: string): string | undefined {
  const folders = vscode.workspace.workspaceFolders || [];
  for (const folder of folders) {
    const envPath = path.join(folder.uri.fsPath, ".env");
    if (!fs.existsSync(envPath)) {
      continue;
    }

    try {
      const raw = fs.readFileSync(envPath, "utf8");
      const lines = raw.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          continue;
        }

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex <= 0) {
          continue;
        }

        const lhs = trimmed.slice(0, separatorIndex).trim();
        if (lhs !== key) {
          continue;
        }

        let rhs = trimmed.slice(separatorIndex + 1).trim();
        if (
          (rhs.startsWith('"') && rhs.endsWith('"')) ||
          (rhs.startsWith("'") && rhs.endsWith("'"))
        ) {
          rhs = rhs.slice(1, -1);
        }
        if (rhs.length > 0) {
          return rhs;
        }
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type LlmRewriteResult = {
  updatedCode: string;
  changes?: string[];
};

function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlock?.[1]) {
    return codeBlock[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function parseLlmRewriteResult(raw: string): LlmRewriteResult | null {
  try {
    const parsed = JSON.parse(extractJsonBlock(raw)) as Partial<LlmRewriteResult>;
    if (!parsed || typeof parsed.updatedCode !== "string") {
      return null;
    }

    return {
      updatedCode: parsed.updatedCode,
      changes: Array.isArray(parsed.changes)
        ? parsed.changes
            .filter((item): item is string => typeof item === "string")
            .slice(0, 12)
        : [],
    };
  } catch {
    return null;
  }
}

function summarizeDocForPrompt(doc: ContextHubDoc): string {
  const lines = doc.content.split(/\r?\n/);
  const interesting: string[] = [];

  for (const line of lines) {
    if (
      /\b(deprecat|legacy|obsolete|replaced|preferred|recommended|migrate|responses|chat\.completions|generateContent|GoogleGenAI)\b/i.test(
        line,
      )
    ) {
      const compact = line.replace(/\s+/g, " ").trim();
      if (compact.length > 0) {
        interesting.push(compact);
      }
    }
    if (interesting.length >= 14) {
      break;
    }
  }

  const snippet = (interesting.join("\n") || lines.slice(0, 20).join("\n")).slice(
    0,
    2500,
  );
  return `Doc: ${doc.id}\nCitation: ${doc.githubUrl || "https://github.com/andrewyng/context-hub"}\n${snippet}`;
}

function summarizeFindingForPrompt(finding: OutdatedApiFinding): string {
  return [
    `- line: ${finding.range.start.line + 1}`,
    `  title: ${finding.rule.title}`,
    `  match: ${finding.matchText}`,
    `  suggestedReplacement: ${finding.rule.replacement || "manual migration"}`,
    `  guidance: ${finding.rule.guidance}`,
    `  citation: ${finding.rule.docsUrl || "none"}`,
  ].join("\n");
}

async function callOpenRouterForLlmFixes(
  settings: LlmFixesSettings,
  messages: OpenRouterMessage[],
): Promise<string> {
  const response = await fetch(settings.openRouterApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://vscode.dev",
      "X-Title": "Auto-CHUB VSCode Extension",
    },
    body: JSON.stringify({
      model: settings.openRouterModel,
      temperature: 0.1,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `OpenRouter call failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  const payload = (await response.json()) as OpenRouterChatResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content;
  }

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  throw new Error("OpenRouter returned an empty response body.");
}

function parseChubSearchEntries(payload: unknown): ContextHubSearchEntry[] {
  const entries: ContextHubSearchEntry[] = [];

  const normalizeLanguage = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .replace(/#/g, "sharp")
      .replace(/\s+/g, "");

  const toLanguageList = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    const langs: string[] = [];
    for (const item of value) {
      if (typeof item === "string" && item.trim().length > 0) {
        langs.push(normalizeLanguage(item));
        continue;
      }

      if (!item || typeof item !== "object") {
        continue;
      }

      const record = item as Record<string, unknown>;
      const rawLang =
        (typeof record.language === "string" && record.language) ||
        (typeof record.name === "string" && record.name) ||
        (typeof record.id === "string" && record.id) ||
        "";
      if (rawLang.trim().length > 0) {
        langs.push(normalizeLanguage(rawLang));
      }
    }
    return langs;
  };

  const toTagList = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.toLowerCase());
  };

  const pushFromEntry = (entry: unknown): void => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const record = entry as Record<string, unknown>;
    const rawId =
      (typeof record.id === "string" && record.id) ||
      (typeof record.docId === "string" && record.docId) ||
      (typeof record.doc_id === "string" && record.doc_id) ||
      (typeof record.slug === "string" && record.slug) ||
      "";
    const id = rawId;
    if (typeof id !== "string" || id.trim().length === 0) {
      return;
    }

    entries.push({
      id: id.trim(),
      name:
        (typeof record.name === "string" && record.name) ||
        (typeof record.title === "string" && record.title) ||
        undefined,
      tags: toTagList(record.tags),
      languages: toLanguageList(record.languages),
      score:
        (typeof record._score === "number" && Number.isFinite(record._score)
          ? record._score
          : typeof record.score === "number" && Number.isFinite(record.score)
            ? record.score
            : 0),
    });
  };

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      pushFromEntry(entry);
    }
  } else if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.results)) {
      for (const entry of record.results) {
        pushFromEntry(entry);
      }
    } else if (record.id) {
      pushFromEntry(record);
    }
  }

  const deduped = new Map<string, ContextHubSearchEntry>();
  for (const entry of entries) {
    const existing = deduped.get(entry.id);
    if (!existing || entry.score > existing.score) {
      deduped.set(entry.id, entry);
    }
  }

  return Array.from(deduped.values());
}

function parseChubGetContent(docId: string, payload: unknown): ContextHubDoc | null {
  if (!payload) {
    return null;
  }

  if (typeof payload === "string") {
    return {
      id: docId,
      content: payload,
    };
  }

  if (Array.isArray(payload)) {
    const merged = payload
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object") {
          const content = (item as Record<string, unknown>).content;
          if (typeof content === "string") {
            return content;
          }
        }
        return "";
      })
      .filter((item) => item.length > 0)
      .join("\n\n");

    if (!merged) {
      return null;
    }

    return {
      id: docId,
      content: merged,
    };
  }

  const data = payload as Record<string, unknown>;
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : undefined;
  const path =
    (typeof data.path === "string" && data.path) ||
    (typeof data.filePath === "string" && data.filePath) ||
    (typeof data.sourcePath === "string" && data.sourcePath) ||
    (typeof data.docPath === "string" && data.docPath) ||
    (metadata && typeof metadata.path === "string" ? metadata.path : undefined);
  const githubUrl = buildContextHubGitHubUrl(path);
  const directContent =
    (typeof data.content === "string" && data.content) ||
    (typeof data.markdown === "string" && data.markdown) ||
    (typeof data.text === "string" && data.text) ||
    (typeof data.body === "string" && data.body) ||
    "";
  if (typeof directContent === "string" && directContent.length > 0) {
    return {
      id: docId,
      title: typeof data.title === "string" ? data.title : undefined,
      content: directContent,
      path,
      githubUrl,
    };
  }

  if (Array.isArray(data.files)) {
    const merged = data.files
      .map((file) => {
        if (!file || typeof file !== "object") {
          return "";
        }
        const content = (file as Record<string, unknown>).content;
        return typeof content === "string" ? content : "";
      })
      .filter((item) => item.length > 0)
      .join("\n\n");

    if (!merged) {
      return null;
    }

    return {
      id: docId,
      title: typeof data.title === "string" ? data.title : undefined,
      content: merged,
      path,
      githubUrl,
    };
  }

  return null;
}

function buildContextHubGitHubUrl(path?: string): string | undefined {
  if (!path) {
    return undefined;
  }
  const normalizedPath = path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^content\//i, "");
  if (!normalizedPath) {
    return undefined;
  }
  return `https://github.com/andrewyng/context-hub/blob/main/content/${normalizedPath}`;
}

function extractContextHubQueries(
  documentText: string,
  maxQueries: number,
): string[] {
  const importPattern =
    /(?:import\s+[^'"]*from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
  const memberPattern =
    /\b([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*){1,4})\s*\(/g;

  const scored = new Map<string, { query: string; score: number }>();
  const pushScored = (query: string, boost = 0): void => {
    const clean = normalizeContextHubQueryToken(query);
    if (!clean) {
      return;
    }
    const key = clean.toLowerCase();
    const nextScore = scoreContextHubQuery(clean) + boost;
    const existing = scored.get(key);
    if (!existing || nextScore > existing.score) {
      scored.set(key, { query: clean, score: nextScore });
    }
  };

  let importMatch: RegExpExecArray | null = null;
  while ((importMatch = importPattern.exec(documentText)) !== null) {
    const pkg = importMatch[1];
    if (!pkg || pkg.startsWith(".") || pkg.startsWith("/")) {
      continue;
    }
    for (const candidate of expandImportQueryCandidates(pkg)) {
      pushScored(candidate, 3);
    }
  }

  let memberMatch: RegExpExecArray | null = null;
  while ((memberMatch = memberPattern.exec(documentText)) !== null) {
    const member = memberMatch[1];
    if (!member) {
      continue;
    }
    for (const candidate of expandMemberQueryCandidates(member)) {
      pushScored(candidate, 2);
    }
  }

  for (const providerHint of detectContextHubProviderHints(documentText)) {
    for (const queryHint of providerHint.queryHints) {
      pushScored(queryHint, 9);
    }
  }

  for (const signalQuery of deriveSignalContextHubQueries(documentText)) {
    pushScored(signalQuery, 7);
  }

  return Array.from(scored.values())
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return a.query.localeCompare(b.query);
    })
    .slice(0, maxQueries)
    .map((item) => item.query);
}

function detectContextHubProviderHints(
  documentText: string,
): Array<{ provider: string; docIds: string[]; queryHints: string[] }> {
  const hints: Array<{ provider: string; docIds: string[]; queryHints: string[] }> = [];
  for (const [provider, config] of Object.entries(CONTEXT_HUB_PROVIDER_DOC_HINTS)) {
    if (!config.detector.test(documentText)) {
      continue;
    }
    hints.push({
      provider,
      docIds: config.docIds.slice(),
      queryHints: config.queryHints.slice(),
    });
  }
  return hints;
}

function extractDeprecatedSignaturesFromDoc(content: string): DeprecatedSignatureEvidence[] {
  const lines = content.split(/\r?\n/);
  const evidences: DeprecatedSignatureEvidence[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/\b(deprecat|legacy|obsolete|sunset|replaced|instead|migrate|preferred|recommended)\b/i.test(line)) {
      continue;
    }

    const candidateSignatures = collectDeprecatedSignaturesAroundIndex(lines, i);
    if (candidateSignatures.length === 0) {
      continue;
    }

    const deprecationSummary = compactLine(line);
    const efficiencySummary = findNearbyEfficiencySummary(lines, i);

    for (const signature of candidateSignatures.slice(0, 4)) {
      const replacement = inferReplacementFromNearbyLines(lines, i, signature);
      evidences.push({
        signature,
        replacement,
        deprecationSummary,
        efficiencySummary,
        lineNumber: i + 1,
      });
    }
  }

  const deduped = new Map<string, DeprecatedSignatureEvidence>();
  for (const evidence of evidences) {
    const key = evidence.signature.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, evidence);
    }
  }

  return Array.from(deduped.values());
}

function extractCodeSpans(line: string): string[] {
  const spans: string[] = [];
  const codeSpanPattern = /`([^`]{2,220})`/g;
  let match: RegExpExecArray | null = null;
  while ((match = codeSpanPattern.exec(line)) !== null) {
    const token = match[1].trim();
    if (token.length >= 2) {
      spans.push(token);
    }
  }
  return spans;
}

function extractMethodLikeSignatures(line: string): string[] {
  const signatures: string[] = [];

  const dottedCallPattern =
    /\b([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*){1,6})\s*\(/g;
  let dottedMatch: RegExpExecArray | null = null;
  while ((dottedMatch = dottedCallPattern.exec(line)) !== null) {
    const token = dottedMatch[1]?.trim();
    if (token) {
      signatures.push(token);
    }
  }

  const constructorPattern = /\bnew\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let ctorMatch: RegExpExecArray | null = null;
  while ((ctorMatch = constructorPattern.exec(line)) !== null) {
    const token = ctorMatch[1]?.trim();
    if (token) {
      signatures.push(`new ${token}`);
    }
  }

  return signatures;
}

function normalizeSignatureForComparison(signature: string): string {
  return signature
    .replace(/`/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/^new\s+/i, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function isUsefulSignatureCandidate(signature: string): boolean {
  const normalized = normalizeSignatureForComparison(signature);
  if (normalized.length < 3 || normalized.length > 180) {
    return false;
  }
  if (/^[a-z]+$/.test(normalized)) {
    return false;
  }
  if (/^(model|models|client|sdk|api)$/.test(normalized)) {
    return false;
  }
  return true;
}

function collectDeprecatedSignaturesAroundIndex(lines: string[], index: number): string[] {
  const start = Math.max(0, index - 2);
  const end = Math.min(lines.length - 1, index + 18);
  const collected: string[] = [];

  for (let i = start; i <= end; i += 1) {
    const line = lines[i];
    const spans = extractCodeSpans(line);
    const methods = extractMethodLikeSignatures(line);
    for (const token of [...spans, ...methods]) {
      if (!isUsefulSignatureCandidate(token)) {
        continue;
      }
      collected.push(token);
    }
  }

  return Array.from(new Set(collected));
}

function inferReplacementFromNearbyLines(
  lines: string[],
  index: number,
  primary: string,
): string | undefined {
  const start = Math.max(0, index - 6);
  const end = Math.min(lines.length - 1, index + 28);
  const normalizedPrimary = normalizeSignatureForComparison(primary);

  for (let i = start; i <= end; i += 1) {
    const line = lines[i];
    if (!/\b(use|prefer|instead|replace|migrate|recommended|primary|current|modern)\b/i.test(line)) {
      continue;
    }

    const tokens = [...extractCodeSpans(line), ...extractMethodLikeSignatures(line)];
    for (const token of tokens) {
      if (!isUsefulSignatureCandidate(token)) {
        continue;
      }

      if (normalizeSignatureForComparison(token) === normalizedPrimary) {
        continue;
      }
      return token;
    }
  }

  return undefined;
}

function compactLine(line: string): string {
  return line.replace(/\s+/g, " ").trim().slice(0, 240);
}

function findNearbyEfficiencySummary(lines: string[], index: number): string | undefined {
  const start = Math.max(0, index - 4);
  const end = Math.min(lines.length - 1, index + 4);

  for (let i = start; i <= end; i += 1) {
    const line = lines[i];
    if (!/\b(fast|faster|latency|cost|token|efficient|performance|throughput|cheap|cheaper)\b/i.test(line)) {
      continue;
    }

    return compactLine(line);
  }

  return undefined;
}

function buildLooseSignatureRegex(signature: string): RegExp | null {
  const text = signature
    .trim()
    .replace(/`/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/^await\s+/i, "")
    .replace(/\s+/g, " ");
  if (text.length < 2 || text.length > 180) {
    return null;
  }

  const newMatch = text.match(/^new\s+([A-Za-z_$][\w$]*)$/i);
  if (newMatch) {
    const className = newMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\bnew\\s+${className}\\s*\\(`, "g");
  }

  const segments = text
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => /^[A-Za-z_$][\w$]*$/.test(segment));

  if (segments.length >= 2) {
    const tail = segments.slice(-Math.min(3, segments.length));
    const tailPattern = tail
      .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s*\\.\\s*");

    return new RegExp(
      `(?:[A-Za-z_$][\\w$]*\\s*\\.\\s*)*${tailPattern}\\s*\\(`,
      "g",
    );
  }

  const functionName = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${functionName}\\s*\\(`, "g");
}

function normalizeContextHubQueryToken(input: string): string {
  const normalized = input.replace(/["'`]/g, "").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length < 2 || normalized.length > 120) {
    return "";
  }
  return normalized;
}

function scoreContextHubQuery(query: string): number {
  const lower = query.toLowerCase();
  let score = 0;

  for (const term of CONTEXT_HUB_SIGNAL_TERMS) {
    if (lower.includes(term)) {
      score += 4;
    }
  }

  if (lower.includes(".")) {
    score += 2;
  }
  if (lower.includes("/")) {
    score += 1;
  }
  if (lower.includes(" ")) {
    score += 1;
  }
  if (/\b(deprec|legacy|migrat|recommended)\b/.test(lower)) {
    score += 4;
  }
  if (CONTEXT_HUB_NOISY_TERMS.has(lower)) {
    score -= 6;
  }
  if (query.length >= 4 && query.length <= 50) {
    score += 1;
  }
  return score;
}

function expandImportQueryCandidates(pkg: string): string[] {
  const candidates = new Set<string>();
  const clean = pkg.trim();
  if (!clean) {
    return [];
  }

  candidates.add(clean);
  candidates.add(clean.replace(/\//g, " "));

  const scopeMatch = clean.match(/^@([^/]+)\/(.+)$/);
  if (scopeMatch) {
    const scope = scopeMatch[1];
    const name = scopeMatch[2];
    candidates.add(name);
    candidates.add(`${scope} ${name}`);
  }

  const compact = clean
    .replace(/^@/, "")
    .replace(/[-_/](sdk|client|js|node)$/i, "")
    .replace(/[-_/]v?\d+$/i, "");
  if (compact !== clean) {
    candidates.add(compact);
    candidates.add(compact.replace(/\//g, " "));
  }

  const tokens = clean
    .replace(/^@/, "")
    .split(/[\/._-]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
  for (const token of tokens) {
    candidates.add(token);
  }

  if (/genai|gemini/i.test(clean)) {
    candidates.add("gemini genai");
  }
  if (/openai/i.test(clean)) {
    candidates.add("openai chat");
  }
  if (/groq/i.test(clean)) {
    candidates.add("groq");
  }

  return Array.from(candidates);
}

function expandMemberQueryCandidates(member: string): string[] {
  const candidates = new Set<string>();
  const clean = member.trim();
  if (!clean) {
    return [];
  }

  candidates.add(clean);
  candidates.add(clean.replace(/\./g, " "));
  const segments = clean.split(".").filter((segment) => segment.length > 0);
  if (segments.length >= 2) {
    candidates.add(segments.slice(-2).join("."));
  }
  if (segments.length >= 3) {
    candidates.add(segments.slice(-3).join("."));
  }
  if (segments.length >= 1) {
    candidates.add(segments[segments.length - 1]);
  }

  const lower = clean.toLowerCase();
  if (lower.includes("chat.completions.create")) {
    candidates.add("openai chat completions");
  }
  if (lower.includes("generatecontent")) {
    candidates.add("gemini genai");
  }
  if (lower.includes("canceltoken")) {
    candidates.add("axios cancellation");
  }
  if (lower.includes("reactdom.render")) {
    candidates.add("react createRoot");
  }
  if (lower.includes("buffer")) {
    candidates.add("node buffer");
  }

  return Array.from(candidates);
}

function deriveSignalContextHubQueries(documentText: string): string[] {
  const signals: string[] = [];

  if (/\bchat\.completions\.create\b/i.test(documentText) || /\bcreateChatCompletion\b/i.test(documentText)) {
    signals.push("openai chat completions");
    signals.push("openai responses migration");
  }
  if (/\bGoogleGenAI\b/i.test(documentText) || /@google\/genai/i.test(documentText) || /\bgenerateContent\b/i.test(documentText)) {
    signals.push("gemini genai");
    signals.push("gemini migration");
  }
  if (/\bgroq\b/i.test(documentText)) {
    signals.push("groq sdk");
  }
  if (/\bCancelToken\b/i.test(documentText) || /\baxios\b/i.test(documentText)) {
    signals.push("axios cancellation");
  }
  if (/\bReactDOM\.render\b/i.test(documentText)) {
    signals.push("react createRoot");
  }
  if (/\bnew\s+Buffer\s*\(/i.test(documentText)) {
    signals.push("node buffer");
  }

  return Array.from(new Set(signals));
}

function supportsPreferredDocLang(
  entry: ContextHubSearchEntry,
  preferredLangs: string[],
): boolean {
  const preferred = new Set(
    preferredLangs
      .map((lang) =>
        lang
          .trim()
          .toLowerCase()
          .replace(/#/g, "sharp")
          .replace(/\s+/g, ""),
      )
      .filter((lang) => lang.length > 0),
  );

  if (preferred.size === 0) {
    return false;
  }

  const aliasGroups = [
    ["js", "javascript", "ts", "typescript"],
    ["py", "python"],
    ["cs", "csharp", "dotnet"],
    ["go", "golang"],
  ];

  for (const group of aliasGroups) {
    if (group.some((alias) => preferred.has(alias))) {
      group.forEach((alias) => preferred.add(alias));
    }
  }

  return entry.languages.some((lang) => preferred.has(lang));
}

function scoreSearchEntryForQuery(
  entry: ContextHubSearchEntry,
  query: string,
  preferredLangs: string[],
  index: number,
): number {
  const lowerQuery = query.toLowerCase();
  const lowerId = entry.id.toLowerCase();
  const lowerName = (entry.name || "").toLowerCase();
  const haystack = `${lowerId} ${lowerName} ${entry.tags.join(" ")}`;
  const tokens = lowerQuery
    .split(/[^a-z0-9]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);

  let score = entry.score;

  // Earlier ranked results should matter.
  score += Math.max(0, 20 - index);

  if (supportsPreferredDocLang(entry, preferredLangs)) {
    score += 40;
  }

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 8;
    }
  }

  if (lowerQuery.includes("openai") && lowerId.startsWith("openai/")) {
    score += 30;
  }
  if (lowerQuery.includes("groq") && lowerId.startsWith("groq/")) {
    score += 30;
  }
  if ((lowerQuery.includes("gemini") || lowerQuery.includes("genai")) && lowerId.startsWith("gemini/")) {
    score += 30;
  }

  if (
    (lowerQuery.includes("chat") || lowerQuery.includes("completion")) &&
    /\/chat\b/.test(lowerId)
  ) {
    score += 20;
  }

  if (/\/package\b/.test(lowerId) && (lowerQuery.includes("chat") || lowerQuery.includes("completion"))) {
    score -= 12;
  }

  return score;
}

function escapeForRegexLiteral(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHeuristicPatternFromToken(token: string): RegExp | null {
  const clean = token.trim();
  if (!clean) {
    return null;
  }

  if (/^new\s+/i.test(clean)) {
    const className = clean.replace(/^new\s+/i, "").trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(className)) {
      return null;
    }
    return new RegExp(`\\bnew\\s+${escapeForRegexLiteral(className)}\\s*\\(`, "g");
  }

  if (clean.includes(".")) {
    const segments = clean
      .split(".")
      .map((segment) => segment.trim())
      .filter((segment) => /^[A-Za-z_$][\w$]*$/.test(segment));
    if (segments.length === 0) {
      return null;
    }

    const tail = segments.slice(-Math.min(3, segments.length));
    const tailPattern = tail.map((segment) => escapeForRegexLiteral(segment)).join("\\s*\\.\\s*");
    return new RegExp(`(?:[A-Za-z_$][\\w$]*\\s*\\.\\s*)*${tailPattern}\\s*\\(`, "g");
  }

  if (/^[A-Za-z_$][\w$]*$/.test(clean)) {
    return new RegExp(`\\b${escapeForRegexLiteral(clean)}\\b`, "g");
  }

  return null;
}

function inferHeuristicReplacement(token: string): string | undefined {
  const key = token.toLowerCase().replace(/\s+/g, "");
  for (const [k, replacement] of CONTEXT_HUB_HEURISTIC_REPLACEMENTS.entries()) {
    if (key.includes(k)) {
      return replacement;
    }
  }
  return undefined;
}

function inferFallbackDocsUrl(token: string): string {
  const key = token.toLowerCase().replace(/\s+/g, "");
  for (const [k, url] of GENERIC_FALLBACK_DOC_LINKS.entries()) {
    if (key.includes(k)) {
      return url;
    }
  }
  return `https://github.com/andrewyng/context-hub/search?q=${encodeURIComponent(
    token,
  )}&type=code`;
}

function pickBestDocForToken(token: string, docs: ContextHubDoc[]): ContextHubDoc | undefined {
  if (docs.length === 0) {
    return undefined;
  }

  const lower = token.toLowerCase();
  const scored = docs.map((doc) => {
    const docId = doc.id.toLowerCase();
    const content = doc.content.toLowerCase();
    let score = 0;
    if (docId.includes("openai") && (lower.includes("completion") || lower.includes("chat"))) {
      score += 8;
    }
    if (docId.includes("gemini") && (lower.includes("genai") || lower.includes("generatecontent"))) {
      score += 8;
    }
    if (docId.includes("groq") && lower.includes("groq")) {
      score += 8;
    }
    if (content.includes(lower.replace(/\s+/g, ""))) {
      score += 4;
    }
    if (content.includes(lower)) {
      score += 6;
    }
    if (doc.githubUrl) {
      score += 1;
    }
    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.doc || docs[0];
}

function findLineForTokenInDoc(doc: ContextHubDoc, token: string): number {
  const lines = doc.content.split(/\r?\n/);
  const normalizedToken = token.toLowerCase().replace(/\s+/g, "");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].toLowerCase();
    if (line.includes(token.toLowerCase()) || line.replace(/\s+/g, "").includes(normalizedToken)) {
      return i + 1;
    }
  }

  return 1;
}

function buildCitationBackedHeuristicRules(
  documentText: string,
  docs: ContextHubDoc[],
  genericLegacyMethodNames: string[],
): OutdatedApiRule[] {
  const rules: OutdatedApiRule[] = [];
  const seen = new Set<string>();

  for (const token of genericLegacyMethodNames) {
    const pattern = buildHeuristicPatternFromToken(token);
    if (!pattern) {
      continue;
    }
    pattern.lastIndex = 0;
    if (!pattern.test(documentText)) {
      continue;
    }

    const doc = pickBestDocForToken(token, docs);
    if (!doc) {
      continue;
    }
    const lineNumber = findLineForTokenInDoc(doc, token);
    const citationUrl = doc.githubUrl
      ? `${doc.githubUrl}#L${lineNumber}`
      : "https://github.com/andrewyng/context-hub";
    const id = `chub-heuristic-${sanitizeRuleId(`${doc.id}-${token}`)}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);

    rules.push({
      id,
      title: `Context Hub heuristic legacy API (${token})`,
      pattern,
      replacement: inferHeuristicReplacement(token),
      quickFixLabel: inferHeuristicReplacement(token)
        ? "Apply heuristic modern replacement"
        : undefined,
      guidance:
        `Detected potentially outdated usage "${token}" with Context Hub evidence from "${doc.id}". Validate and migrate to latest recommended API.`,
      docsUrl: citationUrl,
      efficiencyComparison:
        `Legacy: ${token} | Recommended: ${inferHeuristicReplacement(token) || "see cited docs"} | Use latest API path to improve supportability and long-term efficiency.`,
      sourceDocId: doc.id,
      isHeuristic: true,
    });
  }

  return rules;
}

function detectDocLangCandidates(document: vscode.TextDocument): string[] {
  switch (document.languageId) {
    case "python":
      return ["python", "py"];
    case "javascript":
    case "javascriptreact":
      return ["javascript", "js", "typescript", "ts"];
    case "typescript":
    case "typescriptreact":
      return ["typescript", "ts", "javascript", "js"];
    case "go":
      return ["go", "golang"];
    case "java":
      return ["java"];
    case "csharp":
      return ["csharp", "cs", "dotnet"];
    default:
      return ["javascript", "js"];
  }
}

function buildCustomRulesFromConfig(
  customPatterns: CustomOutdatedPatternDefinition[] | undefined,
): OutdatedApiRule[] {
  if (!Array.isArray(customPatterns) || customPatterns.length === 0) {
    return [];
  }

  const rules: OutdatedApiRule[] = [];
  for (let index = 0; index < customPatterns.length; index += 1) {
    const entry = customPatterns[index];
    const patternText = typeof entry?.pattern === "string" ? entry.pattern.trim() : "";

    if (!patternText) {
      continue;
    }

    const rawId =
      (typeof entry.id === "string" && entry.id.trim().length > 0
        ? entry.id.trim()
        : `custom-rule-${index + 1}`);

    try {
      const compiled = new RegExp(patternText, normalizePatternFlags(entry.flags));
      rules.push({
        id: sanitizeRuleId(rawId) || `custom-rule-${index + 1}`,
        title:
          (typeof entry.title === "string" && entry.title.trim().length > 0
            ? entry.title.trim()
            : `Custom outdated API pattern #${index + 1}`),
        pattern: compiled,
        replacement:
          typeof entry.replacement === "string" && entry.replacement.length > 0
            ? entry.replacement
            : undefined,
        quickFixLabel:
          typeof entry.quickFixLabel === "string" && entry.quickFixLabel.length > 0
            ? entry.quickFixLabel
            : undefined,
        guidance:
          typeof entry.guidance === "string" && entry.guidance.trim().length > 0
            ? entry.guidance.trim()
            : "Custom rule matched. Verify latest docs and migrate this API usage.",
        docsUrl:
          typeof entry.docsUrl === "string" && entry.docsUrl.trim().length > 0
            ? entry.docsUrl.trim()
            : undefined,
      });
    } catch (error) {
      // Ignore invalid custom regex patterns so one bad entry does not disable diagnostics.
      continue;
    }
  }

  return rules;
}

function buildGenericHeuristicRule(token: string): OutdatedApiRule {
  const cleaned = token.trim();
  const replacement = inferHeuristicReplacement(cleaned);
  const docsUrl = inferFallbackDocsUrl(cleaned);
  return {
    id: `generic-heuristic-${sanitizeRuleId(cleaned || "api-call")}`,
    title: `Potential outdated API call: ${cleaned}`,
    pattern: /$^/g,
    replacement,
    quickFixLabel: replacement ? "Apply heuristic modern replacement" : undefined,
    guidance:
      "Generic legacy detector matched this call. Context Hub fallback docs are attached; verify and migrate to the latest API.",
    docsUrl,
    isHeuristic: true,
  };
}

async function getContextHubRulesForDocument(
  document: vscode.TextDocument,
  output: vscode.OutputChannel,
): Promise<ContextHubRuleResult> {
  const settings = loadChubCliSettings();
  if (!settings.useContextHubCli) {
    return { rules: [], docs: [] };
  }

  const docText = document.getText();
  const providerHints = detectContextHubProviderHints(docText);
  const queries = extractContextHubQueries(docText, settings.contextHubMaxQueries);
  const preferredLangs = detectDocLangCandidates(document);

  if (providerHints.length > 0) {
    const summary = providerHints
      .map((hint) => `${hint.provider}: ${hint.docIds.join(", ")}`)
      .join(" | ");
    output.appendLine(`[Context Hub] provider hints: ${summary}`);
  }

  if (queries.length === 0 && providerHints.length === 0) {
    output.appendLine(
      `[Context Hub] No search queries inferred for ${document.fileName}.`,
    );
    return { rules: [], docs: [] };
  }
  if (queries.length > 0) {
    output.appendLine(
      `[Context Hub] ${document.fileName} -> queries: ${queries.join(" | ")}`,
    );
  }

  const candidateScores = new Map<string, number>();

  let seededCount = 0;
  for (const hint of providerHints) {
    hint.docIds.forEach((docId, index) => {
      const boost = 200 - index * 5;
      const current = candidateScores.get(docId) ?? Number.NEGATIVE_INFINITY;
      if (boost > current) {
        candidateScores.set(docId, boost);
        seededCount += 1;
      }
    });
  }
  if (seededCount > 0) {
    output.appendLine(
      `[Context Hub] seeded ${seededCount} provider doc id(s) before search.`,
    );
  }

  for (const query of queries) {
    try {
      output.appendLine(
        `[Context Hub] running: ${settings.chubBinaryPath} search "${query}" --json`,
      );
      const result = await executeCli(settings.chubBinaryPath, [
        "search",
        query,
        "--json",
      ]);
      const payload = parseCliJson<unknown>(result.stdout);
      const entries = parseChubSearchEntries(payload);

      if (entries.length === 0) {
        output.appendLine(`[Context Hub] search "${query}" -> 0 hits`);
        continue;
      }

      output.appendLine(
        `[Context Hub] search "${query}" -> ${entries
          .slice(0, 4)
          .map((entry) => entry.id)
          .join(", ")}`,
      );

      entries.forEach((entry, index) => {
        let score = scoreSearchEntryForQuery(
          entry,
          query,
          preferredLangs,
          index,
        );
        if (
          providerHints.some((hint) =>
            entry.id.toLowerCase().startsWith(`${hint.provider.toLowerCase()}/`),
          )
        ) {
          score += 20;
        }
        const existingScore = candidateScores.get(entry.id) ?? Number.NEGATIVE_INFINITY;
        if (score > existingScore) {
          candidateScores.set(entry.id, score);
        }
      });
    } catch (error) {
      output.appendLine(`Context Hub search failed for "${query}": ${String(error)}`);
    }
  }

  const matchedIds = Array.from(candidateScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, settings.contextHubMaxDocs)
    .map(([id]) => id);

  if (matchedIds.length > 0) {
    output.appendLine(
      `[Context Hub] selected docs: ${matchedIds
        .map((id) => `${id}(${Math.round(candidateScores.get(id) || 0)})`)
        .join(", ")}`,
    );
  }

  if (matchedIds.length === 0) {
    output.appendLine(
      `[Context Hub] No doc ids resolved from search for ${document.fileName}.`,
    );
    return { rules: [], docs: [] };
  }
  const docs: ContextHubDoc[] = [];

  for (const id of matchedIds) {
    if (docs.length >= settings.contextHubMaxDocs) {
      break;
    }

    let fetchedDoc: ContextHubDoc | null = null;
    for (const lang of preferredLangs) {
      try {
        output.appendLine(
          `[Context Hub] running: ${settings.chubBinaryPath} get ${id} --lang ${lang} --json`,
        );
        const langResult = await executeCli(settings.chubBinaryPath, [
          "get",
          id,
          "--lang",
          lang,
          "--json",
        ]);
        const langPayload = parseCliJson<unknown>(langResult.stdout);
        const langDoc = parseChubGetContent(id, langPayload);
        if (langDoc) {
          fetchedDoc = langDoc;
          output.appendLine(
            `[Context Hub] fetched "${id}" (lang=${lang}, path=${langDoc.path || "n/a"})`,
          );
          break;
        }
      } catch (error) {
        output.appendLine(
          `Context Hub get failed for "${id}" with lang "${lang}": ${String(error)}`,
        );
      }
    }

    if (fetchedDoc) {
      docs.push(fetchedDoc);
    } else {
      output.appendLine(
        `[Context Hub] skipped "${id}" because no lang-specific get returned content.`,
      );
    }
  }

  if (docs.length === 0) {
    output.appendLine(
      `[Context Hub] 0 docs fetched for ${document.fileName}. Check 'autochub.chubBinaryPath' and ensure the Extension Host can run the chub CLI.`,
    );
  }

  const dynamicRules: OutdatedApiRule[] = [];
  for (const doc of docs) {
    const evidences = extractDeprecatedSignaturesFromDoc(doc.content);
    for (const evidence of evidences) {
      const regex = buildLooseSignatureRegex(evidence.signature);
      if (!regex) {
        continue;
      }

      const citationUrl = doc.githubUrl
        ? `${doc.githubUrl}#L${evidence.lineNumber}`
        : `https://github.com/andrewyng/context-hub/search?q=${encodeURIComponent(
            doc.id,
          )}&type=code`;

      const efficiencyComparison = evidence.efficiencySummary
        ? `Legacy: ${evidence.signature} | Recommended: ${evidence.replacement || "see cited docs"} | ${evidence.efficiencySummary}`
        : `Legacy: ${evidence.signature} | Recommended: ${evidence.replacement || "see cited docs"} | Docs indicate moving to the recommended/latest path for better long-term efficiency and support.`;

      dynamicRules.push({
        id: `chub-doc-${sanitizeRuleId(`${doc.id}-${evidence.signature}`)}`,
        title: `Context Hub deprecated API (${doc.id})`,
        pattern: regex,
        replacement: evidence.replacement,
        quickFixLabel: evidence.replacement
          ? "Apply Context Hub recommended replacement"
          : undefined,
        guidance: `Context Hub docs "${doc.id}" indicate this call is legacy/deprecated. Evidence: ${evidence.deprecationSummary}`,
        docsUrl: citationUrl,
        efficiencyComparison,
        sourceDocId: doc.id,
      });
    }
  }

  const uniqueRules = new Map<string, OutdatedApiRule>();
  for (const rule of dynamicRules) {
    uniqueRules.set(rule.id, rule);
  }

  output.appendLine(
    `[Context Hub] extracted ${Array.from(uniqueRules.values()).length} citation-backed rule(s) from ${docs.length} doc(s).`,
  );

  return {
    rules: Array.from(uniqueRules.values()),
    docs,
  };
}

class AutoChubCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== EXTENSION_SOURCE || typeof diagnostic.code !== "string") {
        continue;
      }

      const rule = RULES_BY_ID.get(diagnostic.code);
      if (!rule) {
        continue;
      }

      if (rule.replacement) {
        const fixAction = new vscode.CodeAction(
          rule.quickFixLabel || `Apply ${rule.id} update`,
          vscode.CodeActionKind.QuickFix,
        );
        fixAction.isPreferred = true;
        fixAction.diagnostics = [diagnostic];
        fixAction.edit = new vscode.WorkspaceEdit();
        fixAction.edit.replace(document.uri, diagnostic.range, rule.replacement);
        actions.push(fixAction);
      }

      const explainAction = new vscode.CodeAction(
        "Explain with Auto-CHUB",
        vscode.CodeActionKind.QuickFix,
      );
      explainAction.diagnostics = [diagnostic];
      explainAction.command = {
        command: COMMAND_DEBUG_SELECTION,
        title: "Explain deprecated pattern",
        arguments: [document.uri, diagnostic.range, rule.id],
      };
      actions.push(explainAction);
    }

    return actions;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const diagnostics = vscode.languages.createDiagnosticCollection("autochub");
  const output = vscode.window.createOutputChannel("Auto-CHUB");
  const debounceByUri = new Map<string, NodeJS.Timeout>();
  const contextHubOnlySettings = getContextHubOnlyDetectionSettings();
  let detectionSettings = loadDetectionSettings();

  const refreshDetectionSettings = (): void => {
    detectionSettings = loadDetectionSettings();
    RULES_BY_ID = new Map<string, OutdatedApiRule>(
      detectionSettings.activeRules.map((rule) => [rule.id, rule]),
    );
  };

  context.subscriptions.push(diagnostics, output);
  refreshDetectionSettings();

  const runDiagnostics = async (document: vscode.TextDocument): Promise<void> => {
    if (!isSupportedDocument(document)) {
      diagnostics.delete(document.uri);
      return;
    }

    const contextHub = await getContextHubRulesForDocument(document, output);
    rememberRules(contextHub.rules);
    if (contextHub.rules.length === 0) {
      output.appendLine(
        `[Context Hub] No citation-backed rules extracted for diagnostics on ${document.fileName}.`,
      );
    }
    const findings = findOutdatedApiPatterns(
      document,
      undefined,
      contextHubOnlySettings,
      contextHub.rules,
    );
    const diagnosticItems = findings.map((finding) => toDiagnostic(finding));
    diagnostics.set(document.uri, diagnosticItems);
  };

  const scheduleDiagnostics = (document: vscode.TextDocument): void => {
    const key = document.uri.toString();
    const existing = debounceByUri.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
      debounceByUri.delete(key);
      void runDiagnostics(document);
    }, 1200);

    debounceByUri.set(key, timeout);
  };

  const registerDisposable = <T extends vscode.Disposable>(disposable: T): T => {
    context.subscriptions.push(disposable);
    return disposable;
  };

  registerDisposable(
    vscode.languages.registerCodeActionsProvider(
      [
        { language: "typescript" },
        { language: "typescriptreact" },
        { language: "javascript" },
        { language: "javascriptreact" },
        { language: "python" },
        { language: "go" },
        { language: "java" },
        { language: "csharp" },
      ],
      new AutoChubCodeActionProvider(),
      { providedCodeActionKinds: AutoChubCodeActionProvider.providedCodeActionKinds },
    ),
  );

  registerDisposable(
    vscode.workspace.onDidOpenTextDocument((document) => {
      void runDiagnostics(document);
    }),
  );

  registerDisposable(
    vscode.workspace.onDidChangeTextDocument((event) => {
      scheduleDiagnostics(event.document);
    }),
  );

  registerDisposable(
    vscode.workspace.onDidCloseTextDocument((document) => {
      diagnostics.delete(document.uri);
    }),
  );

  registerDisposable(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("autochub")) {
        return;
      }

      refreshDetectionSettings();
      for (const editor of vscode.window.visibleTextEditors) {
        void runDiagnostics(editor.document);
      }
    }),
  );

  registerDisposable(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        void runDiagnostics(editor.document);
      }
    }),
  );

  registerDisposable(
    vscode.commands.registerCommand(COMMAND_OPEN, () => {
      openMainPanel(context);
    }),
  );

  registerDisposable(
    vscode.commands.registerCommand(COMMAND_ANALYZE_CURRENT_FILE, async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor. Open a file and retry.");
        return;
      }
      startRealtimeLogs(output, "Analyze Current File", editor.document);
      if (!ensureSupportedForAnalysis(editor.document, "Analyze Current File")) {
        return;
      }

      const contextHub = await getContextHubRulesForDocument(editor.document, output);
      rememberRules(contextHub.rules);
      if (contextHub.docs.length === 0) {
        vscode.window.showWarningMessage(
          "Context Hub returned no docs for this file. No fallback detector is used in strict Context Hub mode.",
        );
      }
      const findings = findOutdatedApiPatterns(
        editor.document,
        undefined,
        contextHubOnlySettings,
        contextHub.rules,
      );
      diagnostics.set(editor.document.uri, findings.map((finding) => toDiagnostic(finding)));

      if (findings.length === 0) {
        vscode.window.showInformationMessage("No outdated API patterns detected in this file.");
        return;
      }

      const selected = await vscode.window.showInformationMessage(
        `Auto-CHUB found ${findings.length} outdated API pattern(s).`,
        "Open Assistant",
        "Apply All Fixes",
        "Apply LLM Fixes",
      );

      if (selected === "Open Assistant") {
        showDebugPanel(
          context,
          editor.document,
          editor.selection,
          findings,
          "Analysis completed for current file.",
        );
      } else if (selected === "Apply All Fixes") {
        await applyAllFixes(editor, findings, output);
      } else if (selected === "Apply LLM Fixes") {
        await applyLlmAssistedFixes(editor, findings, contextHub.docs, output);
      }
    }),
  );

  registerDisposable(
    vscode.commands.registerCommand(COMMAND_ANALYZE_SELECTION, async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor. Open a file and retry.");
        return;
      }
      startRealtimeLogs(output, "Analyze Selection", editor.document);
      if (!ensureSupportedForAnalysis(editor.document, "Analyze Selection")) {
        return;
      }

      if (editor.selection.isEmpty) {
        vscode.window.showInformationMessage(
          "Select a code block first, then run Analyze Selection.",
        );
        return;
      }

      const contextHub = await getContextHubRulesForDocument(editor.document, output);
      rememberRules(contextHub.rules);
      if (contextHub.docs.length === 0) {
        vscode.window.showWarningMessage(
          "Context Hub returned no docs for this selection. No fallback detector is used in strict Context Hub mode.",
        );
      }
      const findings = findOutdatedApiPatterns(
        editor.document,
        editor.selection,
        contextHubOnlySettings,
        contextHub.rules,
      );
      showDebugPanel(
        context,
        editor.document,
        editor.selection,
        findings,
        "Selection-focused analysis.",
      );
    }),
  );

  registerDisposable(
    vscode.commands.registerCommand(
      COMMAND_DEBUG_SELECTION,
      async (uri?: vscode.Uri, range?: vscode.Range, ruleId?: string) => {
        const editor = resolveEditor(uri) || vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("No active editor found for debug suggestions.");
          return;
        }
        startRealtimeLogs(output, "Debug Selection", editor.document);
        if (!ensureSupportedForAnalysis(editor.document, "Debug Selection")) {
          return;
        }

        const contextHub = await getContextHubRulesForDocument(editor.document, output);
        rememberRules(contextHub.rules);
        if (contextHub.docs.length === 0) {
          vscode.window.showWarningMessage(
            "Context Hub returned no docs for this file. Debug panel only shows strict Context Hub findings.",
          );
        }
        const targetRange = range || editor.selection;
        const findings = targetRange.isEmpty
          ? findOutdatedApiPatterns(
              editor.document,
              undefined,
              contextHubOnlySettings,
              contextHub.rules,
            )
          : findOutdatedApiPatterns(
              editor.document,
              targetRange,
              contextHubOnlySettings,
              contextHub.rules,
            );

        if (ruleId && targetRange && targetRange.isEmpty === false) {
          const targetedRule = RULES_BY_ID.get(ruleId);
          if (targetedRule) {
            output.appendLine(
              `Manual explain invoked for rule ${targetedRule.id} in ${editor.document.uri.fsPath}`,
            );
          }
        }

        showDebugPanel(
          context,
          editor.document,
          targetRange,
          findings,
          "Debug assistant suggestions for selected context.",
        );
      },
    ),
  );

  registerDisposable(
    vscode.commands.registerCommand(COMMAND_APPLY_ALL_FIXES, async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor. Open a file and retry.");
        return;
      }
      startRealtimeLogs(output, "Apply All Latest Fixes", editor.document);
      if (!ensureSupportedForAnalysis(editor.document, "Apply All Latest Fixes")) {
        return;
      }

      const contextHub = await getContextHubRulesForDocument(editor.document, output);
      rememberRules(contextHub.rules);
      if (contextHub.docs.length === 0) {
        vscode.window.showWarningMessage(
          "Context Hub returned no docs for this file. No fallback auto-fixes are available in strict Context Hub mode.",
        );
      }
      const findings = findOutdatedApiPatterns(
        editor.document,
        undefined,
        contextHubOnlySettings,
        contextHub.rules,
      );
      if (findings.length === 0) {
        vscode.window.showInformationMessage("No automatic replacements available.");
        return;
      }

      await applyAllFixes(editor, findings, output);
    }),
  );

  registerDisposable(
    vscode.commands.registerCommand(COMMAND_APPLY_LLM_FIXES, async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor. Open a file and retry.");
        return;
      }
      startRealtimeLogs(output, "Apply LLM-Assisted Fixes", editor.document);
      if (!ensureSupportedForAnalysis(editor.document, "Apply LLM-Assisted Fixes")) {
        return;
      }

      const contextHub = await getContextHubRulesForDocument(editor.document, output);
      rememberRules(contextHub.rules);
      const findings = findOutdatedApiPatterns(
        editor.document,
        undefined,
        contextHubOnlySettings,
        contextHub.rules,
      );
      if (findings.length === 0) {
        vscode.window.showInformationMessage("No outdated API patterns detected to migrate.");
        return;
      }

      await applyLlmAssistedFixes(editor, findings, contextHub.docs, output);
    }),
  );

  if (vscode.window.activeTextEditor) {
    void runDiagnostics(vscode.window.activeTextEditor.document);
  }
}

export function deactivate() {}

function resolveEditor(uri?: vscode.Uri): vscode.TextEditor | undefined {
  if (!uri) {
    return undefined;
  }

  return vscode.window.visibleTextEditors.find(
    (editor) => editor.document.uri.toString() === uri.toString(),
  );
}

function isSupportedDocument(document: vscode.TextDocument): boolean {
  const supportedLanguages = new Set([
    "typescript",
    "typescriptreact",
    "javascript",
    "javascriptreact",
    "python",
    "go",
    "java",
    "csharp",
  ]);

  if (document.uri.scheme !== "file") {
    return false;
  }

  return supportedLanguages.has(document.languageId);
}

function ensureSupportedForAnalysis(
  document: vscode.TextDocument,
  commandTitle: string,
): boolean {
  if (isSupportedDocument(document)) {
    return true;
  }

  vscode.window.showWarningMessage(
    `${commandTitle} supports: TypeScript, TSX, JavaScript, JSX, Python, Go, Java, and C#. Current file language "${document.languageId}" is not supported.`,
  );
  return false;
}

function findOutdatedApiPatterns(
  document: vscode.TextDocument,
  selection?: vscode.Range,
  settings?: DetectionSettings,
  dynamicRules: OutdatedApiRule[] = [],
): OutdatedApiFinding[] {
  const findings: OutdatedApiFinding[] = [];
  const sourceText = selection ? document.getText(selection) : document.getText();
  const offsetStart = selection ? document.offsetAt(selection.start) : 0;
  const activeSettings = settings || loadDetectionSettings();
  const activeRules = [...activeSettings.activeRules, ...dynamicRules];

  for (const rule of activeRules) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null = null;

    while ((match = rule.pattern.exec(sourceText)) !== null) {
      const matchStart = offsetStart + match.index;
      const matchEnd = matchStart + match[0].length;
      const range = new vscode.Range(
        document.positionAt(matchStart),
        document.positionAt(matchEnd),
      );

      findings.push({
        rule,
        range,
        matchText: match[0],
      });

      if (rule.pattern.lastIndex === match.index) {
        rule.pattern.lastIndex += 1;
      }
    }
  }

  if (activeSettings.enableGenericLegacyDetector) {
    const exactRangeKeys = new Set(
      findings.map((finding) =>
        [
          finding.range.start.line,
          finding.range.start.character,
          finding.range.end.line,
          finding.range.end.character,
        ].join(":"),
      ),
    );

    const genericFindings = findGenericLegacyCallFindings(
      document,
      sourceText,
      offsetStart,
      activeSettings.genericLegacyMethodNames,
    );

    for (const genericFinding of genericFindings) {
      const key = [
        genericFinding.range.start.line,
        genericFinding.range.start.character,
        genericFinding.range.end.line,
        genericFinding.range.end.character,
      ].join(":");

      if (exactRangeKeys.has(key)) {
        continue;
      }

      findings.push(genericFinding);
    }
  }

  return dedupeFindings(findings);
}

function findGenericLegacyCallFindings(
  document: vscode.TextDocument,
  sourceText: string,
  offsetStart: number,
  genericMethodNames: string[],
): OutdatedApiFinding[] {
  const findings: OutdatedApiFinding[] = [];
  const tokens = genericMethodNames
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => ({
      raw: token,
      normalized: normalizeCallableName(token),
      simple: !token.includes(".") && !token.includes(" "),
    }));

  if (tokens.length === 0) {
    return findings;
  }

  const pushFinding = (
    token: string,
    matchText: string,
    absoluteStart: number,
    absoluteEnd: number,
  ): void => {
    const range = new vscode.Range(
      document.positionAt(absoluteStart),
      document.positionAt(absoluteEnd),
    );
    findings.push({
      rule: buildGenericHeuristicRule(token),
      range,
      matchText,
    });
  };

  GENERIC_MEMBER_CALL_PATTERN.lastIndex = 0;
  let memberMatch: RegExpExecArray | null = null;
  while ((memberMatch = GENERIC_MEMBER_CALL_PATTERN.exec(sourceText)) !== null) {
    const chain = memberMatch[1];
    const normalizedChain = normalizeCallableName(chain);

    for (const token of tokens) {
      if (!normalizedChain.includes(token.normalized)) {
        continue;
      }

      const start = offsetStart + memberMatch.index;
      const end = start + memberMatch[0].length;
      pushFinding(token.raw, memberMatch[0], start, end);
    }

    if (GENERIC_MEMBER_CALL_PATTERN.lastIndex === memberMatch.index) {
      GENERIC_MEMBER_CALL_PATTERN.lastIndex += 1;
    }
  }

  GENERIC_CONSTRUCTOR_PATTERN.lastIndex = 0;
  let constructorMatch: RegExpExecArray | null = null;
  while ((constructorMatch = GENERIC_CONSTRUCTOR_PATTERN.exec(sourceText)) !== null) {
    const className = constructorMatch[1];
    const normalizedClassName = normalizeCallableName(className);

    for (const token of tokens) {
      if (!token.simple) {
        continue;
      }
      if (!normalizedClassName.includes(token.normalized)) {
        continue;
      }

      const start = offsetStart + constructorMatch.index;
      const end = start + constructorMatch[0].length;
      pushFinding(token.raw, constructorMatch[0], start, end);
    }

    if (GENERIC_CONSTRUCTOR_PATTERN.lastIndex === constructorMatch.index) {
      GENERIC_CONSTRUCTOR_PATTERN.lastIndex += 1;
    }
  }

  GENERIC_FUNCTION_CALL_PATTERN.lastIndex = 0;
  let functionMatch: RegExpExecArray | null = null;
  while ((functionMatch = GENERIC_FUNCTION_CALL_PATTERN.exec(sourceText)) !== null) {
    const functionName = functionMatch[1];
    const normalizedFunctionName = normalizeCallableName(functionName);

    for (const token of tokens) {
      if (!token.simple) {
        continue;
      }
      if (normalizedFunctionName !== token.normalized) {
        continue;
      }

      const start = offsetStart + functionMatch.index;
      const end = start + functionMatch[0].length;
      pushFinding(token.raw, functionMatch[0], start, end);
    }

    if (GENERIC_FUNCTION_CALL_PATTERN.lastIndex === functionMatch.index) {
      GENERIC_FUNCTION_CALL_PATTERN.lastIndex += 1;
    }
  }

  return findings;
}

function dedupeFindings(findings: OutdatedApiFinding[]): OutdatedApiFinding[] {
  // 1) Remove exact duplicates first.
  const exactDeduped: OutdatedApiFinding[] = [];
  const seen = new Set<string>();

  for (const finding of findings) {
    const key = [
      finding.rule.id,
      finding.range.start.line,
      finding.range.start.character,
      finding.range.end.line,
      finding.range.end.character,
      normalizeConflictToken(finding),
    ].join(":");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    exactDeduped.push(finding);
  }

  // 2) Resolve overlap conflicts (especially backup heuristic repeats).
  const prioritized = [...exactDeduped].sort((a, b) => {
    const scoreDiff = scoreFindingForDedupe(b) - scoreFindingForDedupe(a);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const rangeLenA = rangeLength(a.range);
    const rangeLenB = rangeLength(b.range);
    if (rangeLenA !== rangeLenB) {
      return rangeLenB - rangeLenA;
    }

    return b.matchText.length - a.matchText.length;
  });

  const selected: OutdatedApiFinding[] = [];
  for (const candidate of prioritized) {
    const hasConflict = selected.some((existing) =>
      findingsConflict(candidate, existing),
    );
    if (hasConflict) {
      continue;
    }
    selected.push(candidate);
  }

  // 3) Stable order for display/output.
  return selected.sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) {
      return a.range.start.line - b.range.start.line;
    }
    return a.range.start.character - b.range.start.character;
  });
}

function rangeLength(range: vscode.Range): number {
  if (range.start.line === range.end.line) {
    return Math.max(0, range.end.character - range.start.character);
  }
  // Favor cross-line ranges slightly in prioritization.
  return 10_000 + (range.end.line - range.start.line) * 500 + range.end.character;
}

function scoreFindingForDedupe(finding: OutdatedApiFinding): number {
  let score = 0;
  if (!finding.rule.isHeuristic) {
    score += 200;
  }
  if (finding.rule.sourceDocId) {
    score += 80;
  }
  if (finding.rule.docsUrl) {
    score += 40;
  }
  if (finding.rule.replacement) {
    score += 25;
  }
  score += Math.min(25, normalizeConflictToken(finding).length);
  score += Math.min(20, rangeLength(finding.range));
  return score;
}

function rangesOverlap(a: vscode.Range, b: vscode.Range): boolean {
  if (a.end.line < b.start.line || b.end.line < a.start.line) {
    return false;
  }

  if (a.end.line === b.start.line && a.end.character <= b.start.character) {
    return false;
  }
  if (b.end.line === a.start.line && b.end.character <= a.start.character) {
    return false;
  }

  return true;
}

function extractHeuristicToken(ruleTitle: string): string | undefined {
  const prefix = "Potential outdated API call:";
  if (!ruleTitle.startsWith(prefix)) {
    return undefined;
  }
  return ruleTitle.slice(prefix.length).trim();
}

function extractCallableFromMatch(matchText: string): string {
  const match = matchText.match(
    /\b(?:new\s+)?([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*\(/,
  );
  if (!match || !match[1]) {
    return matchText;
  }
  return match[1];
}

function normalizeTokenText(token: string): string {
  return token
    .toLowerCase()
    .replace(/^new\s+/i, "")
    .replace(/\s+/g, "")
    .replace(/\(+$/, "")
    .trim();
}

function normalizeConflictToken(finding: OutdatedApiFinding): string {
  const heuristicToken = extractHeuristicToken(finding.rule.title);
  const rawToken = heuristicToken || extractCallableFromMatch(finding.matchText);
  return normalizeTokenText(rawToken);
}

function findingsConflict(
  candidate: OutdatedApiFinding,
  existing: OutdatedApiFinding,
): boolean {
  if (!rangesOverlap(candidate.range, existing.range)) {
    return false;
  }

  const candidateToken = normalizeConflictToken(candidate);
  const existingToken = normalizeConflictToken(existing);

  if (!candidateToken || !existingToken) {
    return candidate.matchText === existing.matchText;
  }

  if (candidateToken === existingToken) {
    return true;
  }

  if (
    candidateToken.includes(existingToken) ||
    existingToken.includes(candidateToken)
  ) {
    return true;
  }

  // For same-call overlaps like `chat.completions.create` vs `completions.create`,
  // collapse on last method segment.
  const candidateLast = candidateToken.split(".").pop() || candidateToken;
  const existingLast = existingToken.split(".").pop() || existingToken;
  return candidateLast === existingLast;
}

function toDiagnostic(finding: OutdatedApiFinding): vscode.Diagnostic {
  const citation = finding.rule.docsUrl ? ` Citation: ${finding.rule.docsUrl}` : "";
  const message = `${finding.rule.title}. ${finding.rule.guidance}${citation}`;
  const severity = finding.rule.isHeuristic
    ? vscode.DiagnosticSeverity.Information
    : vscode.DiagnosticSeverity.Warning;
  const diagnostic = new vscode.Diagnostic(
    finding.range,
    message,
    severity,
  );

  diagnostic.source = EXTENSION_SOURCE;
  diagnostic.code = finding.rule.id;
  return diagnostic;
}

async function applyAllFixes(
  editor: vscode.TextEditor,
  findings: OutdatedApiFinding[],
  output: vscode.OutputChannel,
): Promise<void> {
  const fixable = findings
    .filter((finding) => Boolean(finding.rule.replacement))
    .sort((a, b) => {
      if (a.range.start.line !== b.range.start.line) {
        return b.range.start.line - a.range.start.line;
      }
      return b.range.start.character - a.range.start.character;
    });

  if (fixable.length === 0) {
    vscode.window.showInformationMessage("No automatic replacements available.");
    return;
  }

  const applyOk = await editor.edit((editBuilder) => {
    for (const finding of fixable) {
      if (!finding.rule.replacement) {
        continue;
      }
      editBuilder.replace(finding.range, finding.rule.replacement);
    }
  });

  if (!applyOk) {
    vscode.window.showErrorMessage(
      "Auto-CHUB could not apply all replacements. Try quick fixes one by one.",
    );
    return;
  }

  await runPostFixContextHubFlow(editor.document, fixable, output);

  vscode.window.showInformationMessage(
    `Applied ${fixable.length} replacement(s) to modernize APIs.`,
  );
}

async function applyLlmAssistedFixes(
  editor: vscode.TextEditor,
  findings: OutdatedApiFinding[],
  docs: ContextHubDoc[],
  output: vscode.OutputChannel,
): Promise<void> {
  const settings = loadLlmFixesSettings();
  if (!settings.enabled) {
    vscode.window.showWarningMessage(
      "LLM-assisted fixes are disabled. Enable 'autochub.enableLlmFixes' in settings.",
    );
    return;
  }

  if (!settings.openRouterApiKey) {
    vscode.window.showErrorMessage(
      "OpenRouter key is missing. Set 'autochub.openRouterApiKey' or OPENROUTER_API_KEY in workspace .env.",
    );
    return;
  }

  const document = editor.document;
  const currentText = document.getText();
  if (currentText.length > settings.maxInputChars) {
    vscode.window.showWarningMessage(
      `File is too large for LLM-assisted migration (${currentText.length} chars). Limit: ${settings.maxInputChars}.`,
    );
    return;
  }

  const scopedFindings = findings.slice(0, 40);
  if (scopedFindings.length === 0) {
    vscode.window.showInformationMessage("No outdated API findings to send to LLM.");
    return;
  }

  const findingsText = scopedFindings
    .map((finding) => summarizeFindingForPrompt(finding))
    .join("\n");
  const docsText = docs.length
    ? docs.slice(0, 4).map((doc) => summarizeDocForPrompt(doc)).join("\n\n---\n\n")
    : "No Context Hub docs were fetched in this run. Use finding citations and preserve behavior conservatively.";

  output.appendLine(
    `[LLM Fixes] Sending ${scopedFindings.length} finding(s) and ${Math.min(docs.length, 4)} doc summary block(s) to OpenRouter model "${settings.openRouterModel}".`,
  );

  const responseText = await callOpenRouterForLlmFixes(settings, [
    {
      role: "system",
      content:
        "You are a senior code migration assistant. Return only strict JSON with updatedCode and optional changes array.",
    },
    {
      role: "user",
      content: [
        `Task: modernize outdated API usage in this file with minimal safe edits.`,
        `Language: ${document.languageId}`,
        ``,
        `Findings to fix:`,
        findingsText,
        ``,
        `Context Hub docs / evidence:`,
        docsText,
        ``,
        `Current file content:`,
        "```",
        currentText,
        "```",
        ``,
        `Constraints:`,
        `1) Preserve behavior and formatting style as much as possible.`,
        `2) Only modify code related to listed outdated API findings.`,
        `3) Prefer replacements suggested in findings/docs when available.`,
        `4) Keep imports/types consistent after migrations.`,
        `5) Return valid JSON only: {"updatedCode":"...", "changes":["..."]}`,
      ].join("\n"),
    },
  ]);

  const parsed = parseLlmRewriteResult(responseText);
  if (!parsed) {
    output.appendLine(`[LLM Fixes] Failed to parse LLM JSON response: ${responseText.slice(0, 500)}`);
    vscode.window.showErrorMessage(
      "LLM-assisted migration failed: could not parse model response.",
    );
    return;
  }

  const nextText = parsed.updatedCode;
  if (!nextText || nextText.trim().length === 0) {
    vscode.window.showWarningMessage("LLM-assisted migration produced empty output; no changes applied.");
    return;
  }

  if (nextText === currentText) {
    vscode.window.showInformationMessage("LLM-assisted migration produced no changes.");
    return;
  }

  const previewSummary = (parsed.changes || []).slice(0, 4).join(" | ");
  const applyChoice = await vscode.window.showInformationMessage(
    previewSummary
      ? `LLM prepared file migration updates. ${previewSummary}`
      : "LLM prepared file migration updates for outdated APIs.",
    "Apply LLM Fixes",
    "Cancel",
  );
  if (applyChoice !== "Apply LLM Fixes") {
    output.appendLine("[LLM Fixes] User canceled apply.");
    return;
  }

  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(currentText.length),
  );
  const applied = await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, nextText);
  });
  if (!applied) {
    vscode.window.showErrorMessage("Failed to apply LLM-assisted migration edits.");
    return;
  }

  await runPostFixContextHubFlow(document, scopedFindings, output);
  vscode.window.showInformationMessage(
    `Applied LLM-assisted migration for ${scopedFindings.length} finding(s).`,
  );
}

function buildPostFixAnnotationNote(
  document: vscode.TextDocument,
  fixableFindings: OutdatedApiFinding[],
): string {
  const uniqueRules = Array.from(
    new Set(fixableFindings.map((finding) => finding.rule.id)),
  ).slice(0, 6);
  const ruleSummary = uniqueRules.join(", ");
  return [
    `Auto-CHUB applied ${fixableFindings.length} fix(es) in ${document.fileName}.`,
    `Rules: ${ruleSummary}.`,
  ].join(" ");
}

async function runPostFixContextHubFlow(
  document: vscode.TextDocument,
  fixableFindings: OutdatedApiFinding[],
  output: vscode.OutputChannel,
): Promise<void> {
  const settings = loadChubCliSettings();
  if (!settings.useContextHubCli) {
    return;
  }

  const sourceDocIds = Array.from(
    new Set(
      fixableFindings
        .map((finding) => finding.rule.sourceDocId)
        .filter((id): id is string => Boolean(id && id.trim().length > 0)),
    ),
  );

  if (sourceDocIds.length === 0) {
    output.appendLine(
      "Skipped Context Hub annotate/feedback post-fix flow because no source doc ids were attached to applied fixes.",
    );
    return;
  }

  const annotationNote = buildPostFixAnnotationNote(document, fixableFindings);
  let annotatedDocs = 0;

  for (const docId of sourceDocIds) {
    try {
      await executeCli(settings.chubBinaryPath, [
        "annotate",
        docId,
        annotationNote,
      ]);
      annotatedDocs += 1;
    } catch (error) {
      output.appendLine(
        `Context Hub annotate failed for "${docId}": ${String(error)}`,
      );
    }
  }

  if (annotatedDocs > 0) {
    output.appendLine(
      `Annotated ${annotatedDocs} Context Hub doc(s) after applying fixes.`,
    );
  }

  const feedbackChoice = await vscode.window.showInformationMessage(
    "Auto-CHUB: Were these Context Hub based fixes helpful? Your feedback improves future suggestions.",
    "Helpful",
    "Needs Improvement",
    "Skip",
  );

  if (!feedbackChoice || feedbackChoice === "Skip") {
    output.appendLine("User skipped Context Hub feedback prompt.");
    return;
  }

  const rating = feedbackChoice === "Helpful" ? "up" : "down";
  const userComment = await vscode.window.showInputBox({
    title: "Auto-CHUB Feedback",
    prompt:
      "Optional note for Context Hub docs (what worked or what should improve).",
    placeHolder: "Example: Replacement worked but needed more migration context.",
  });
  const normalizedComment = (userComment || "").trim();
  const fallbackComment =
    rating === "up"
      ? `Applied ${fixableFindings.length} fixes successfully.`
      : `Applied ${fixableFindings.length} fixes but guidance can improve.`;
  const commentToSend = normalizedComment || fallbackComment;

  let feedbackSent = 0;
  for (const docId of sourceDocIds) {
    try {
      await executeCli(settings.chubBinaryPath, [
        "feedback",
        docId,
        rating,
        commentToSend,
      ]);
      feedbackSent += 1;
    } catch (error) {
      output.appendLine(
        `Context Hub feedback failed for "${docId}": ${String(error)}`,
      );
    }
  }

  if (feedbackSent > 0) {
    vscode.window.showInformationMessage(
      `Context Hub feedback submitted for ${feedbackSent} doc(s).`,
    );
  }
}

function openMainPanel(context: vscode.ExtensionContext): void {
  const appUrl =
    (vscode.workspace.getConfiguration("autochub").get("appUrl") as
      | string
      | undefined) ||
    "http://localhost:3000";

  const panel = vscode.window.createWebviewPanel(
    "autochubView",
    "Auto-CHUB Agent",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  const webviewHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Auto-CHUB</title>
      <style>
        :root {
          color-scheme: dark;
        }
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          background: #0d1117;
          color: #c9d1d9;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
        }
        .topbar {
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          border-bottom: 1px solid #30363d;
          font-size: 12px;
          background: #0d1117;
        }
        iframe {
          width: 100%;
          height: calc(100% - 37px);
          border: none;
        }
      </style>
    </head>
    <body>
      <div class="topbar">
        <span>Auto-CHUB Context HUB</span>
        <span>${escapeHtml(appUrl)}</span>
      </div>
      <iframe src="${escapeAttribute(appUrl)}" id="autochub-frame"></iframe>
      <script>
        const vscode = acquireVsCodeApi();
        window.addEventListener("message", (event) => {
          const message = event.data;
          if (message && message.command === "insertCode") {
            vscode.postMessage(message);
          }
        });
      </script>
    </body>
    </html>
  `;

  panel.webview.html = webviewHtml;

  panel.webview.onDidReceiveMessage(
    async (message: { command?: string; code?: string }) => {
      if (message.command !== "insertCode" || !message.code) {
        return;
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found to insert generated code.");
        return;
      }

      const inserted = await editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, message.code || "");
      });

      if (inserted) {
        vscode.window.showInformationMessage("Code inserted from Auto-CHUB.");
      } else {
        vscode.window.showErrorMessage("Failed to insert code into the editor.");
      }
    },
    undefined,
    context.subscriptions,
  );
}

function showDebugPanel(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument,
  selection: vscode.Range,
  findings: OutdatedApiFinding[],
  title: string,
): void {
  const debugText = selection.isEmpty
    ? ""
    : document.getText(selection).slice(0, 3000);
  const hints = buildDebugHints(debugText, findings);

  const findingsHtml = findings.length
    ? findings
        .map((finding) => {
          const docs = finding.rule.docsUrl
            ? `<a href="${escapeAttribute(finding.rule.docsUrl)}">Docs</a>`
            : "No docs link";

          const replacement = finding.rule.replacement
            ? `<code>${escapeHtml(finding.rule.replacement)}</code>`
            : "<span>Manual migration needed</span>";
          const efficiency = finding.rule.efficiencyComparison
            ? `<span>Efficiency comparison: ${escapeHtml(finding.rule.efficiencyComparison)}</span><br/>`
            : "";
          const sourceDoc = finding.rule.sourceDocId
            ? `<span>Context Hub doc: <code>${escapeHtml(finding.rule.sourceDocId)}</code></span><br/>`
            : "";

          return `
            <li>
              <strong>${escapeHtml(finding.rule.title)}</strong><br/>
              <span>Match: <code>${escapeHtml(finding.matchText)}</code></span><br/>
              <span>Line: ${finding.range.start.line + 1}</span><br/>
              <span>Suggested replacement: ${replacement}</span><br/>
              ${sourceDoc}
              ${efficiency}
              <span>${docs}</span>
            </li>
          `;
        })
        .join("")
    : "<li>No outdated API signatures found in this scope.</li>";

  const hintsHtml = hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("");

  const panel = vscode.window.createWebviewPanel(
    "autochubDebug",
    "Auto-CHUB Debug Assistant",
    vscode.ViewColumn.Beside,
    {
      enableScripts: false,
      retainContextWhenHidden: true,
    },
  );

  panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        :root {
          color-scheme: dark;
        }
        body {
          margin: 0;
          padding: 16px;
          background: #0d1117;
          color: #c9d1d9;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
          line-height: 1.45;
        }
        .card {
          border: 1px solid #30363d;
          background: #161b22;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 12px;
        }
        h1 {
          font-size: 15px;
          margin: 0 0 8px;
        }
        h2 {
          font-size: 13px;
          margin: 0 0 8px;
          color: #79c0ff;
        }
        code {
          background: #0d1117;
          border: 1px solid #30363d;
          padding: 1px 4px;
          border-radius: 4px;
        }
        ul {
          margin: 8px 0 0;
          padding-left: 18px;
        }
        li {
          margin-bottom: 10px;
        }
        a {
          color: #58a6ff;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${escapeHtml(title)}</h1>
        <div>File: ${escapeHtml(document.uri.fsPath)}</div>
        <div>Selection lines: ${selection.start.line + 1} to ${selection.end.line + 1}</div>
        <div>Findings: ${findings.length}</div>
      </div>
      <div class="card">
        <h2>Outdated API Findings</h2>
        <ul>${findingsHtml}</ul>
      </div>
      <div class="card">
        <h2>Debug Suggestions</h2>
        <ul>${hintsHtml}</ul>
      </div>
    </body>
    </html>
  `;

  context.subscriptions.push(panel);
}

function buildDebugHints(
  debugText: string,
  findings: OutdatedApiFinding[],
): string[] {
  const hints: string[] = [];
  const lower = debugText.toLowerCase();

  if (findings.length > 0) {
    hints.push(
      "Apply quick fixes from the lightbulb menu to modernize deprecated method calls.",
    );
    hints.push(
      "After applying replacements, rerun tests to confirm payload and response shape compatibility.",
    );
  }

  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized")) {
    hints.push(
      "Authentication failure detected. Check API key validity, scope permissions, and workspace env loading.",
    );
  }

  if (lower.includes("429") || lower.includes("rate limit")) {
    hints.push(
      "Rate-limit signal detected. Add retry with backoff and reduce request burst size.",
    );
  }

  if (lower.includes("enotfound") || lower.includes("econnrefused") || lower.includes("network")) {
    hints.push(
      "Network-related issue detected. Validate endpoint URL, DNS access, proxy config, and local firewall rules.",
    );
  }

  if (lower.includes("typeerror") || lower.includes("undefined")) {
    hints.push(
      "Type/runtime mismatch detected. Verify new API response fields before dereferencing nested values.",
    );
  }

  if (lower.includes("deprecated")) {
    hints.push(
      "Deprecation wording detected in logs. Treat this as migration priority before next SDK upgrade cycle.",
    );
  }

  if (hints.length === 0) {
    hints.push(
      "No strong error signature found. Start by isolating a minimal repro and comparing request/response schema.",
    );
    hints.push(
      "Use Auto-CHUB Analyze Current File to surface potential outdated API calls in the same module.",
    );
  }

  return hints;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(input: string): string {
  return escapeHtml(input).replace(/`/g, "");
}
