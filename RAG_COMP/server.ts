import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import fs from "fs";
import { createWorker } from "tesseract.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_BASE_URL = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_DEFAULT_FALLBACK_MODELS = [
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "mixtral-8x7b-32768",
];
const GROQ_FALLBACK_MODELS = (process.env.GROQ_FALLBACK_MODELS || "")
  .split(",")
  .map((model) => model.trim())
  .filter((model) => model.length > 0);
const CHUB_GITHUB_REPO = process.env.CHUB_GITHUB_REPO || "andrewng/chub";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PDF_OCR_MAX_PAGES = Math.max(1, Number(process.env.PDF_OCR_MAX_PAGES || "8"));
const PDF_OCR_DOC_TEXT_THRESHOLD = Math.max(1, Number(process.env.PDF_OCR_DOC_TEXT_THRESHOLD || "300"));
const PDF_OCR_PAGE_TEXT_THRESHOLD = Math.max(1, Number(process.env.PDF_OCR_PAGE_TEXT_THRESHOLD || "80"));
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;

let cachedGroqModel = GROQ_MODEL;
let cachedGroqModelAt = 0;

if (!GROQ_API_KEY) {
  console.warn("GROQ_API_KEY is not set. Chat responses will return a config warning.");
}

app.use(express.json());

// In-memory document store
let documents: { id: string; name: string; content: string }[] = [];

const UPLOAD_DIR = "uploads/";
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}
const upload = multer({ dest: UPLOAD_DIR });

// OCR Helper
async function performOCR(filePath: string) {
  const worker = await createWorker('eng');
  const { data: { text } } = await worker.recognize(filePath);
  await worker.terminate();
  return text;
}

function normalizeTextLength(value: string) {
  return value.replace(/\s+/g, " ").trim().length;
}

function normalizePageNumbers(pageNumbers: number[]) {
  const unique = new Set(
    pageNumbers
      .map((page) => Math.floor(page))
      .filter((page) => Number.isFinite(page) && page > 0)
  );
  return Array.from(unique).sort((a, b) => a - b);
}

async function performPdfOCR(
  parser: PDFParse,
  options: { partial?: number[]; first?: number } = {}
) {
  const worker = await createWorker("eng");

  try {
    const partial = normalizePageNumbers(options.partial || []).slice(0, PDF_OCR_MAX_PAGES);
    const first = Math.max(1, Math.floor(options.first || PDF_OCR_MAX_PAGES));

    const screenshots = await parser.getScreenshot({
      partial: partial.length ? partial : undefined,
      first: partial.length ? undefined : first,
      imageBuffer: true,
      imageDataUrl: false,
      desiredWidth: 1800,
    });

    const ocrByPage: string[] = [];
    const sortedPages = [...screenshots.pages].sort((a, b) => a.pageNumber - b.pageNumber);

    for (const page of sortedPages) {
      if (!page.data || page.data.length === 0) {
        continue;
      }

      const pngBuffer = Buffer.from(page.data);
      const ocrResult = await worker.recognize(pngBuffer);
      const text = ocrResult?.data?.text?.trim() || "";

      if (text) {
        ocrByPage.push(`--- OCR Page ${page.pageNumber} ---\n${text}`);
      }
    }

    return ocrByPage.join("\n\n");
  } finally {
    await worker.terminate();
  }
}

function extractRelevantSnippet(content: string, query: string) {
  const lines = content.split(/\r?\n/);
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2);

  if (!keywords.length) {
    return content.slice(0, 800);
  }

  const foundLine = lines.findIndex((line) =>
    keywords.some((word) => line.toLowerCase().includes(word))
  );

  if (foundLine === -1) {
    return content.slice(0, 800);
  }

  const start = Math.max(0, foundLine - 4);
  const end = Math.min(lines.length, foundLine + 5);
  return lines.slice(start, end).join("\n").slice(0, 1000);
}

function getRelevantDocuments(query: string) {
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2);

  if (!keywords.length) {
    return [];
  }

  return documents
    .map((doc) => {
      const lowered = doc.content.toLowerCase();
      const score = keywords.reduce((acc, word) => {
        return lowered.includes(word) ? acc + 1 : acc;
      }, 0);

      return { doc, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.doc);
}

function buildDocumentContext(matchedDocs: { name: string; content: string }[]) {
  if (!matchedDocs.length) {
    return "";
  }

  return matchedDocs
    .map((doc) => `Document: ${doc.name}\n${doc.content.slice(0, 2500)}`)
    .join("\n\n")
    .slice(0, 7000);
}

function normalizeModelContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((chunk: any) => (typeof chunk?.text === "string" ? chunk.text : ""))
      .join("\n")
      .trim();
  }

  return "";
}

type LLMResult = {
  text: string;
  model: string;
  callPath: "latest_structured" | "traditional_legacy_prompt";
  latencyMs: number;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  fallbackUsed: boolean;
};

type ImpactMetrics = {
  mode: "traditional" | "latest";
  callPath: "latest_structured" | "traditional_legacy_prompt";
  callPathLabel: string;
  model: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  answerChars: number;
  sourceCount: number;
  matchedDocCount: number;
  fallbackUsed: boolean;
  hadError: boolean;
  queryCoveragePct: number;
  contextCoveragePct: number | null;
  qualityScore: number;
  score: number;
  scoreBreakdown: string[];
};

function toNullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractUsageMetrics(payload: any) {
  const usage = payload?.usage || {};
  return {
    promptTokens: toNullableNumber(usage?.prompt_tokens),
    completionTokens: toNullableNumber(usage?.completion_tokens),
    totalTokens: toNullableNumber(usage?.total_tokens),
  };
}

function callPathLabel(callPath: "latest_structured" | "traditional_legacy_prompt") {
  return callPath === "latest_structured"
    ? "Latest structured system+user call"
    : "Traditional single-message legacy prompt call";
}

const COMMON_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "about", "after", "before",
  "your", "you", "are", "was", "were", "have", "has", "had", "will", "would", "can", "could",
  "should", "must", "may", "might", "than", "then", "them", "they", "their", "there", "here",
  "where", "when", "while", "what", "which", "who", "why", "how", "also", "only", "just", "very",
  "more", "most", "less", "over", "under", "between", "across", "through", "using", "used",
  "mode", "api", "method", "latest", "traditional", "response", "query", "document", "context",
  "based", "into", "onto", "been", "being", "able", "than", "such", "like", "these", "those",
]);

function toKeywordTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !COMMON_STOPWORDS.has(token));
}

function extractKeywords(text: string, maxKeywords: number) {
  const tokens = toKeywordTokens(text);
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([token]) => token);
}

function keywordCoverageRatio(answer: string, keywords: string[]) {
  if (!keywords.length) {
    return 0;
  }

  const answerTokens = new Set(toKeywordTokens(answer));
  const matched = keywords.filter((keyword) => answerTokens.has(keyword)).length;
  return matched / keywords.length;
}

function countSentenceLikeSegments(text: string) {
  return text
    .split(/[.!?]\s+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 20).length;
}

function countListItems(text: string) {
  const lines = text.split(/\r?\n/);
  return lines.filter((line) => /^(\s*[-*•]\s+|\s*\d+[.)]\s+)/.test(line)).length;
}

function getProviderHeaders() {
  return {
    Authorization: `Bearer ${GROQ_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getAxiosErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : String(error);
  }

  const data = error.response?.data as any;
  const dataMessage =
    (typeof data?.error?.message === "string" && data.error.message) ||
    (typeof data?.message === "string" && data.message) ||
    "";

  return dataMessage || error.message;
}

function isModelCompatibilityError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status || 0;
  const payload = safeStringify(error.response?.data).toLowerCase();
  const modelSignal =
    payload.includes("model") ||
    payload.includes("endpoint") ||
    payload.includes("not found") ||
    payload.includes("no endpoints") ||
    payload.includes("route");

  return (status === 400 || status === 404 || status === 422) && modelSignal;
}

function isAlternativeEndpointError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status || 0;
  return status === 404 || isModelCompatibilityError(error);
}

async function resolveGroqModel() {
  const now = Date.now();
  if (now - cachedGroqModelAt < MODEL_CACHE_TTL_MS) {
    return cachedGroqModel;
  }

  try {
    const response = await axios.get(`${GROQ_BASE_URL}/models`, {
      headers: getProviderHeaders(),
      timeout: 15000,
    });

    const entries = Array.isArray(response.data?.data) ? response.data.data : [];
    const ids: string[] = entries
      .map((entry: any) => entry?.id)
      .filter((id: unknown): id is string => typeof id === "string" && id.length > 0);

    if (!ids.length) {
      cachedGroqModel = GROQ_MODEL;
      cachedGroqModelAt = now;
      return cachedGroqModel;
    }

    if (ids.includes(GROQ_MODEL)) {
      cachedGroqModel = GROQ_MODEL;
      cachedGroqModelAt = now;
      return cachedGroqModel;
    }

    const configuredFallback = [...GROQ_FALLBACK_MODELS, ...GROQ_DEFAULT_FALLBACK_MODELS]
      .find((model) => ids.includes(model));
    cachedGroqModel = configuredFallback || ids[0];
    cachedGroqModelAt = now;

    if (cachedGroqModel !== GROQ_MODEL) {
      console.warn(`Configured Groq model "${GROQ_MODEL}" unavailable. Using "${cachedGroqModel}" instead.`);
    }

    return cachedGroqModel;
  } catch (error) {
    cachedGroqModel = GROQ_MODEL;
    cachedGroqModelAt = now;
    return cachedGroqModel;
  }
}

async function postGroqTraditional(model: string, systemPrompt: string, userPrompt: string): Promise<LLMResult> {
  const startedAt = Date.now();
  const legacyPrompt = `System instructions:\n${systemPrompt}\n\nUser request:\n${userPrompt}`;
  const response = await axios.post(
    `${GROQ_BASE_URL}/chat/completions`,
    {
      model,
      messages: [
        { role: "user", content: legacyPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    },
    {
      headers: getProviderHeaders(),
      timeout: 30000,
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  const normalized = normalizeModelContent(content);
  return {
    text: normalized || "No response generated by model.",
    model,
    callPath: "traditional_legacy_prompt",
    latencyMs: Date.now() - startedAt,
    usage: extractUsageMetrics(response.data),
    fallbackUsed: false,
  };
}

async function postGroqLatest(model: string, systemPrompt: string, userPrompt: string): Promise<LLMResult> {
  const startedAt = Date.now();
  const response = await axios.post(
    `${GROQ_BASE_URL}/chat/completions`,
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    },
    {
      headers: getProviderHeaders(),
      timeout: 30000,
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  const normalized = normalizeModelContent(content);
  return {
    text: normalized || "No response generated by model.",
    model,
    callPath: "latest_structured",
    latencyMs: Date.now() - startedAt,
    usage: extractUsageMetrics(response.data),
    fallbackUsed: false,
  };
}

function isRetryableProviderError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status || 0;
  const retryableStatus = [404, 408, 422, 429, 500, 502, 503, 504];
  const retryableCodes = ["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ERR_NETWORK"];
  return retryableStatus.includes(status) || retryableCodes.includes(error.code || "");
}

function isAuthOrBillingError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status || 0;
  return status === 401 || status === 402 || status === 403;
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  mode: "traditional" | "latest"
): Promise<LLMResult> {
  if (!GROQ_API_KEY) {
    return {
      text: "GROQ_API_KEY is missing. Add it to your environment to enable live LLM responses.",
      model: GROQ_MODEL,
      callPath: mode === "latest" ? "latest_structured" : "traditional_legacy_prompt",
      latencyMs: 0,
      usage: {
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      },
      fallbackUsed: true,
    };
  }

  const discoveredModel = await resolveGroqModel();
  const primaryCallPath = mode === "latest" ? "latest_structured" : "traditional_legacy_prompt";
  const candidateModels = Array.from(
    new Set([
      discoveredModel,
      GROQ_MODEL,
      ...GROQ_FALLBACK_MODELS,
      ...GROQ_DEFAULT_FALLBACK_MODELS,
    ])
  ).slice(0, 5);

  const methodOrder: Array<{
    callPath: "latest_structured" | "traditional_legacy_prompt";
    invoke: (model: string, systemPrompt: string, userPrompt: string) => Promise<LLMResult>;
  }> =
    mode === "latest"
      ? [
          { callPath: "latest_structured", invoke: postGroqLatest },
          { callPath: "traditional_legacy_prompt", invoke: postGroqTraditional },
        ]
      : [
          { callPath: "traditional_legacy_prompt", invoke: postGroqTraditional },
          { callPath: "latest_structured", invoke: postGroqLatest },
        ];

  let lastError: unknown = null;

  for (const [modelIndex, model] of candidateModels.entries()) {
    for (const [methodIndex, method] of methodOrder.entries()) {
      try {
        const result = await method.invoke(model, systemPrompt, userPrompt);
        const usedFallbackMethod = method.callPath !== primaryCallPath;
        const usedFallbackModel = modelIndex > 0;

        return {
          ...result,
          fallbackUsed: result.fallbackUsed || usedFallbackMethod || usedFallbackModel || methodIndex > 0,
        };
      } catch (error) {
        lastError = error;

        if (isAuthOrBillingError(error)) {
          break;
        }

        if (isAlternativeEndpointError(error) || isRetryableProviderError(error)) {
          continue;
        }

        break;
      }
    }

    if (isAuthOrBillingError(lastError)) {
      break;
    }

    if (lastError) {
      console.warn(`Groq candidate "${model}" failed, trying next model: ${getAxiosErrorMessage(lastError)}`);
    }
  }

  const errorMessage = getAxiosErrorMessage(lastError);
  throw new Error(`Groq request failed after retries. ${errorMessage}`);
}

async function callLLMSafe(
  systemPrompt: string,
  userPrompt: string,
  mode: "traditional" | "latest"
) {
  try {
    const result = await callLLM(systemPrompt, userPrompt, mode);
    return { result, error: null as string | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallbackText =
      mode === "latest"
        ? `Latest API method is temporarily unavailable. ${message}`
        : `Traditional API method is temporarily unavailable. ${message}`;

    return {
      result: {
        text: fallbackText,
        model: GROQ_MODEL,
        callPath: mode === "latest" ? "latest_structured" : "traditional_legacy_prompt",
        latencyMs: 0,
        usage: {
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
        },
        fallbackUsed: true,
      },
      error: message,
    };
  }
}

function buildImpactMetrics(params: {
  mode: "traditional" | "latest";
  result: LLMResult;
  hadError: boolean;
  sourceCount: number;
  matchedDocCount: number;
  queryKeywords: string[];
  contextKeywords: string[];
}): ImpactMetrics {
  const { mode, result, hadError, sourceCount, matchedDocCount, queryKeywords, contextKeywords } = params;
  const answerChars = result.text.trim().length;
  const sentenceCount = countSentenceLikeSegments(result.text);
  const listItems = countListItems(result.text);
  const queryCoverage = keywordCoverageRatio(result.text, queryKeywords);
  const contextCoverage =
    contextKeywords.length > 0 ? keywordCoverageRatio(result.text, contextKeywords) : null;

  const detailDepthRatio =
    answerChars >= 900 ? 1 :
    answerChars >= 650 ? 0.85 :
    answerChars >= 450 ? 0.7 :
    answerChars >= 280 ? 0.55 :
    answerChars >= 160 ? 0.4 :
    answerChars > 0 ? 0.2 : 0;
  const structureRatio = Math.min(1, (listItems >= 3 ? 1 : listItems >= 1 ? 0.6 : 0) + Math.min(sentenceCount / 12, 0.4));
  const qualityRatio = Math.max(
    0,
    Math.min(
      1,
      (queryCoverage * 0.38) +
      ((contextCoverage ?? queryCoverage) * 0.38) +
      (detailDepthRatio * 0.16) +
      (structureRatio * 0.08)
    )
  );
  const qualityScore = Math.round(qualityRatio * 100);
  let score = 0;
  const scoreBreakdown: string[] = [];

  if (!hadError) {
    score += 26;
    scoreBreakdown.push("+26 successful provider response");
  } else {
    score += 6;
    scoreBreakdown.push("+6 provider fallback response");
  }

  if (!result.fallbackUsed) {
    score += 8;
    scoreBreakdown.push("+8 primary call path used");
  } else {
    score += 3;
    scoreBreakdown.push("+3 fallback path/model used");
  }

  if (result.callPath === "latest_structured") {
    score += 2;
    scoreBreakdown.push("+2 structured prompt semantics");
  } else {
    score += 1;
    scoreBreakdown.push("+1 legacy prompt semantics");
  }

  if (result.latencyMs > 0) {
    const latencyPoints =
      result.latencyMs <= 1200 ? 6 :
      result.latencyMs <= 2400 ? 5 :
      result.latencyMs <= 4000 ? 3 : 1;
    score += latencyPoints;
    scoreBreakdown.push(`+${latencyPoints} latency (${result.latencyMs}ms)`);
  } else {
    score += 1;
    scoreBreakdown.push("+1 latency unavailable");
  }

  const totalTokens = result.usage.totalTokens;
  if (totalTokens !== null) {
    const tokenPoints =
      totalTokens <= 700 ? 5 :
      totalTokens <= 1200 ? 4 :
      totalTokens <= 1800 ? 3 : 1;
    score += tokenPoints;
    scoreBreakdown.push(`+${tokenPoints} token efficiency (${totalTokens} tokens)`);
  } else {
    score += 2;
    scoreBreakdown.push("+2 token usage unavailable");
  }

  const qualityPoints = Math.round(qualityRatio * 48);
  score += qualityPoints;
  scoreBreakdown.push(`+${qualityPoints} quality (${qualityScore}/100 coverage+detail)`);

  if (sourceCount > 0 || matchedDocCount > 0) {
    score += 10;
    scoreBreakdown.push("+10 grounded by sources/context");
  }

  const normalizedScore = Math.max(0, Math.min(100, score));

  return {
    mode,
    callPath: result.callPath,
    callPathLabel: callPathLabel(result.callPath),
    model: result.model,
    latencyMs: result.latencyMs,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    totalTokens: result.usage.totalTokens,
    answerChars,
    sourceCount,
    matchedDocCount,
    fallbackUsed: result.fallbackUsed,
    hadError,
    queryCoveragePct: Math.round(queryCoverage * 100),
    contextCoveragePct: contextCoverage === null ? null : Math.round(contextCoverage * 100),
    qualityScore,
    score: normalizedScore,
    scoreBreakdown,
  };
}

function compareImpactMetrics(traditional: ImpactMetrics, latest: ImpactMetrics) {
  let traditionalScore = traditional.score;
  let latestScore = latest.score;
  const highlights: string[] = [];

  if (traditional.hadError !== latest.hadError) {
    if (traditional.hadError) {
      latestScore += 16;
      highlights.push("Traditional path returned a provider error while latest path returned a usable response.");
    } else {
      traditionalScore += 16;
      highlights.push("Latest path returned a provider error while traditional path returned a usable response.");
    }
  }

  const qualityDelta = latest.qualityScore - traditional.qualityScore;
  if (Math.abs(qualityDelta) >= 5) {
    if (qualityDelta > 0) {
      latestScore += 12;
      highlights.push(`Latest answer quality is higher by ${qualityDelta} points (${latest.qualityScore} vs ${traditional.qualityScore}).`);
    } else {
      traditionalScore += 12;
      highlights.push(`Traditional answer quality is higher by ${Math.abs(qualityDelta)} points (${traditional.qualityScore} vs ${latest.qualityScore}).`);
    }
  } else {
    highlights.push("Answer quality is close between both paths.");
  }

  const tradCoverageComparable = traditional.contextCoveragePct ?? traditional.queryCoveragePct;
  const latestCoverageComparable = latest.contextCoveragePct ?? latest.queryCoveragePct;
  const hasDocumentGrounding = Math.max(traditional.matchedDocCount, latest.matchedDocCount) > 0;
  if (hasDocumentGrounding) {
    if (
      traditional.answerChars >= latest.answerChars * 1.6 &&
      tradCoverageComparable >= latestCoverageComparable - 8
    ) {
      traditionalScore += 10;
      highlights.push(
        `Traditional answer is significantly more comprehensive (${traditional.answerChars} chars vs ${latest.answerChars}) with comparable coverage.`
      );
    } else if (
      latest.answerChars >= traditional.answerChars * 1.6 &&
      latestCoverageComparable >= tradCoverageComparable - 8
    ) {
      latestScore += 10;
      highlights.push(
        `Latest answer is significantly more comprehensive (${latest.answerChars} chars vs ${traditional.answerChars}) with comparable coverage.`
      );
    }
  }

  if (traditional.latencyMs > 0 && latest.latencyMs > 0) {
    const latencyDeltaMs = traditional.latencyMs - latest.latencyMs;
    if (Math.abs(latencyDeltaMs) >= 120) {
      if (latencyDeltaMs > 0) {
        latestScore += 3;
        highlights.push(`Latest path is faster by ${latencyDeltaMs}ms (${latest.latencyMs}ms vs ${traditional.latencyMs}ms).`);
      } else {
        traditionalScore += 3;
        highlights.push(`Traditional path is faster by ${Math.abs(latencyDeltaMs)}ms (${traditional.latencyMs}ms vs ${latest.latencyMs}ms).`);
      }
    } else {
      highlights.push("Latency is effectively tied between both call paths.");
    }
  }

  if (traditional.totalTokens !== null && latest.totalTokens !== null) {
    const tokenDelta = traditional.totalTokens - latest.totalTokens;
    if (Math.abs(tokenDelta) >= 40) {
      if (tokenDelta > 0) {
        latestScore += 2;
        highlights.push(`Latest path used ${tokenDelta} fewer tokens (${latest.totalTokens} vs ${traditional.totalTokens}).`);
      } else {
        traditionalScore += 2;
        highlights.push(`Traditional path used ${Math.abs(tokenDelta)} fewer tokens (${traditional.totalTokens} vs ${latest.totalTokens}).`);
      }
    }
  }

  if (!latest.fallbackUsed && traditional.fallbackUsed) {
    latestScore += 4;
    highlights.push("Latest path stayed on its primary route while traditional required fallback.");
  } else if (latest.fallbackUsed && !traditional.fallbackUsed) {
    traditionalScore += 4;
    highlights.push("Traditional path stayed on its primary route while latest required fallback.");
  }

  if (latest.callPath === "latest_structured") {
    latestScore += 1;
  }

  const winner: "traditional" | "chub" =
    latestScore === traditionalScore
      ? latest.qualityScore >= traditional.qualityScore ? "chub" : "traditional"
      : latestScore > traditionalScore ? "chub" : "traditional";
  const reason =
    winner === "chub"
      ? "Latest API method shows stronger measured impact for this turn, with quality-first weighting."
      : "Traditional API method shows stronger measured impact for this turn, with quality-first weighting.";

  return {
    winner,
    reason,
    highlights: highlights.slice(0, 4),
    traditionalScore: Math.max(0, Math.min(100, traditionalScore)),
    latestScore: Math.max(0, Math.min(100, latestScore)),
    qualityDelta,
    latencyDeltaMs:
      traditional.latencyMs > 0 && latest.latencyMs > 0 ? traditional.latencyMs - latest.latencyMs : null,
    tokenDelta:
      traditional.totalTokens !== null && latest.totalTokens !== null
        ? traditional.totalTokens - latest.totalTokens
        : null,
  };
}

async function searchChubDocs(query: string) {
  const searchQuery = `${query} repo:${CHUB_GITHUB_REPO}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.text-match+json",
    "User-Agent": "rag-comp-server",
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    const searchRes = await axios.get("https://api.github.com/search/code", {
      params: {
        q: searchQuery,
        per_page: 4,
      },
      headers,
      timeout: 20000,
    });

    const items = Array.isArray(searchRes.data?.items) ? searchRes.data.items : [];
    const topItems = items.slice(0, 3);

    const sources = await Promise.all(
      topItems.map(async (item: any) => {
        let summary = "";

        if (Array.isArray(item?.text_matches) && item.text_matches[0]?.fragment) {
          summary = item.text_matches[0].fragment;
        }

        if (!summary && item?.url) {
          try {
            const fileRes = await axios.get(item.url, {
              headers: {
                ...headers,
                Accept: "application/vnd.github+json",
              },
              timeout: 20000,
            });

            const base64Content = fileRes.data?.content;
            if (typeof base64Content === "string") {
              const decoded = Buffer.from(base64Content, "base64").toString("utf-8");
              summary = extractRelevantSnippet(decoded, query);
            }
          } catch (error) {
            console.warn("Unable to fetch GitHub file content:", item?.path);
          }
        }

        return {
          source: item?.html_url || `https://github.com/${CHUB_GITHUB_REPO}`,
          title: item?.name || item?.path || "CHUB GitHub doc",
          path: item?.path || "",
          summary: summary || "Relevant CHUB API reference found in GitHub docs.",
        };
      })
    );

    return sources.filter((source) => !!source.source);
  } catch (error) {
    console.warn("CHUB GitHub search failed:", (error as Error).message);
    return [];
  }
}

// API Routes
app.post("/api/ingest", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    let content = "";
    const filePath = req.file.path;

    if (req.file.mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: dataBuffer });

      try {
        const textResult = await parser.getText();
        const pageTexts = textResult.pages.map((page) => ({
          num: page.num,
          text: page.text?.trim() || "",
        }));

        content = pageTexts
          .map((page) => page.text)
          .filter((text) => text.length > 0)
          .join("\n\n")
          .trim();

        const lowTextPages = pageTexts
          .filter((page) => normalizeTextLength(page.text) < PDF_OCR_PAGE_TEXT_THRESHOLD)
          .map((page) => page.num);

        const shouldRunDocLevelOCR = normalizeTextLength(content) < PDF_OCR_DOC_TEXT_THRESHOLD;
        let ocrText = "";

        try {
          if (shouldRunDocLevelOCR) {
            const firstPageLimit = Math.min(PDF_OCR_MAX_PAGES, Math.max(pageTexts.length, 1));
            ocrText = await performPdfOCR(parser, { first: firstPageLimit });
          } else if (lowTextPages.length > 0) {
            ocrText = await performPdfOCR(parser, { partial: lowTextPages });
          }
        } catch (ocrError) {
          console.warn("PDF OCR fallback failed:", (ocrError as Error).message);
        }

        if (ocrText.trim().length > 0) {
          content = [content, ocrText].filter((chunk) => chunk.trim().length > 0).join("\n\n");
        }

        if (!content.trim()) {
          throw new Error("No readable text could be extracted from this PDF.");
        }
      } catch (err) {
        console.error("PDF parse failed:", err);
        throw err;
      } finally {
        await parser.destroy();
      }
    } else if (
      req.file.mimetype.startsWith("image/")
    ) {
      content = await performOCR(filePath);
    } else if (
      req.file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const data = await mammoth.extractRawText({ path: filePath });
      content = data.value;
    } else {
      content = fs.readFileSync(filePath, "utf-8");
    }

    const doc = {
      id: Math.random().toString(36).substring(7),
      name: req.file.originalname,
      content,
    };
    documents.push(doc);

    // Cleanup
    fs.unlinkSync(filePath);

    res.json({ success: true, docId: doc.id, name: doc.name });
  } catch (error) {
    console.error("Ingestion error:", error);
    res.status(500).json({ error: "Failed to process file" });
  }
});

app.get("/api/documents", (req, res) => {
  res.json(documents.map(d => ({ id: d.id, name: d.name })));
});

app.post("/api/context", (req, res) => {
  const { query } = req.body;
  const relevantDocs = getRelevantDocuments(query || "");
  const context = relevantDocs.map((d) => d.content).join("\n\n").substring(0, 5000);
  res.json({ context });
});

// CHUB Agentic Integration
app.post("/api/chub", async (req, res) => {
  const { command } = req.body;
  
  if (command === "latest_api_method") {
    const trace = [
      "1. Use traditional mode via legacy prompt format",
      "2. Use latest mode via structured system+user prompt format",
      "3. Compare output quality and freshness",
      "4. Return side-by-side grounded responses",
    ].join("\n");

    const results = [{
      doc: "CHUB latest API method selected",
      summary: "Comparison now runs by API method: traditional endpoint path vs latest endpoint path.",
      annotations: ["Latest API Method", "Groq structured prompts", "No query-based GitHub search"],
      source: `https://github.com/${CHUB_GITHUB_REPO}`,
      trace,
    }];
    
    return res.json({ results });
  }
  
  res.status(400).json({ error: "Unknown CHUB command. Use latest_api_method." });
});

app.post("/api/chat", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const matchedDocs = getRelevantDocuments(query);
    const documentContext = buildDocumentContext(matchedDocs);
    const latestApiMethodContext = [
      "Latest API method strategy:",
      "1. Primary call path: Groq structured chat/completions",
      "2. Fallback call path: Groq legacy-style prompt format",
      "3. Rotate across model fallback list when needed",
      "4. Compare against traditional baseline call path",
    ].join("\n");

    const traditionalSystemPrompt =
      "You are a legacy API assistant. Prefer uploaded-document context when available. If no document context exists, answer from general software knowledge and clearly say that no document evidence was found.";
    const traditionalUserPrompt = `User query: ${query}\n\nUploaded document context:\n${documentContext || "No matching uploaded document context."}`;

    const chubSystemPrompt =
      "You are a CHUB agentic assistant using the latest API call method. Prioritize complete, grounded, and well-structured answers. Cover all major points from uploaded-document context before being concise.";
    const chubUserPrompt = `User query: ${query}\n\nUploaded document context:\n${documentContext || "No matching uploaded document context."}\n\n${latestApiMethodContext}`;
    const queryKeywords = extractKeywords(query, 14);
    const contextKeywords = extractKeywords(documentContext, 28);

    const [traditionalCall, chubCall] = await Promise.all([
      callLLMSafe(traditionalSystemPrompt, traditionalUserPrompt, "traditional"),
      callLLMSafe(chubSystemPrompt, chubUserPrompt, "latest"),
    ]);
    const traditionalResult = traditionalCall.result;
    const chubResult = chubCall.result;

    const traditionalSources = matchedDocs.map((doc) => ({ id: doc.id, name: doc.name }));
    const chubSources = [
      {
        source: `https://github.com/${CHUB_GITHUB_REPO}`,
        title: "CHUB latest API method reference",
        path: "latest-api-method",
        summary: "Latest mode compares structured-prompt API calls against a traditional baseline call path.",
      },
    ];

    const traditionalMetrics = buildImpactMetrics({
      mode: "traditional",
      result: traditionalResult,
      hadError: !!traditionalCall.error,
      sourceCount: traditionalSources.length,
      matchedDocCount: matchedDocs.length,
      queryKeywords,
      contextKeywords,
    });
    const latestMetrics = buildImpactMetrics({
      mode: "latest",
      result: chubResult,
      hadError: !!chubCall.error,
      sourceCount: chubSources.length,
      matchedDocCount: matchedDocs.length,
      queryKeywords,
      contextKeywords,
    });

    const comparison = compareImpactMetrics(traditionalMetrics, latestMetrics);
    const winner = comparison.winner;
    const reason = comparison.reason;

    return res.json({
      comparison: {
        winner,
        reason,
        highlights: comparison.highlights,
        traditional_score: comparison.traditionalScore,
        latest_score: comparison.latestScore,
        quality_delta: comparison.qualityDelta,
        latency_delta_ms: comparison.latencyDeltaMs,
        token_delta: comparison.tokenDelta,
      },
      traditional: {
        answer: traditionalResult.text,
        sources: traditionalSources,
        confidence: traditionalCall.error ? 0.35 : Math.max(0.45, comparison.traditionalScore / 100),
        annotations: [
          `Call path: ${traditionalMetrics.callPathLabel}`,
          `Fallback used: ${traditionalMetrics.fallbackUsed ? "Yes" : "No"}`,
          `Latency: ${traditionalMetrics.latencyMs}ms`,
          traditionalMetrics.totalTokens !== null
            ? `Total tokens: ${traditionalMetrics.totalTokens}`
            : "Total tokens: unavailable",
          `Quality: ${traditionalMetrics.qualityScore}/100`,
          `Query coverage: ${traditionalMetrics.queryCoveragePct}%`,
          traditionalMetrics.contextCoveragePct !== null
            ? `Context coverage: ${traditionalMetrics.contextCoveragePct}%`
            : "Context coverage: n/a",
          `Score: ${comparison.traditionalScore}/100`,
        ],
        trace: "Query -> Match uploaded docs -> Legacy prompt shape -> Groq chat/completions",
        winner: winner === "traditional",
        reason,
        impact: {
          call_path: traditionalMetrics.callPath,
          call_path_label: traditionalMetrics.callPathLabel,
          fallback_used: traditionalMetrics.fallbackUsed,
          model: traditionalMetrics.model,
          latency_ms: traditionalMetrics.latencyMs,
          prompt_tokens: traditionalMetrics.promptTokens,
          completion_tokens: traditionalMetrics.completionTokens,
          total_tokens: traditionalMetrics.totalTokens,
          answer_chars: traditionalMetrics.answerChars,
          source_count: traditionalMetrics.sourceCount,
          matched_docs: traditionalMetrics.matchedDocCount,
          had_error: traditionalMetrics.hadError,
          query_coverage_pct: traditionalMetrics.queryCoveragePct,
          context_coverage_pct: traditionalMetrics.contextCoveragePct,
          quality_score: traditionalMetrics.qualityScore,
          score: comparison.traditionalScore,
          score_breakdown: traditionalMetrics.scoreBreakdown,
        },
        missing_points:
          winner !== "traditional"
            ? [
                `Scored ${comparison.traditionalScore}/100 vs ${comparison.latestScore}/100.`,
                ...comparison.highlights.slice(0, 1),
              ].filter((point) => point.length > 0)
            : traditionalCall.error
              ? [traditionalCall.error]
            : [],
      },
      chub: {
        answer: chubResult.text,
        sources: chubSources,
        confidence: chubCall.error ? 0.35 : Math.max(0.45, comparison.latestScore / 100),
        annotations: [
          "Latest API Method",
          "Groq structured prompts",
          "Traditional-vs-Latest Comparison",
          `Call path: ${latestMetrics.callPathLabel}`,
          `Fallback used: ${latestMetrics.fallbackUsed ? "Yes" : "No"}`,
          `Model: ${latestMetrics.model}`,
          `Latency: ${latestMetrics.latencyMs}ms`,
          latestMetrics.totalTokens !== null
            ? `Total tokens: ${latestMetrics.totalTokens}`
            : "Total tokens: unavailable",
          `Quality: ${latestMetrics.qualityScore}/100`,
          `Query coverage: ${latestMetrics.queryCoveragePct}%`,
          latestMetrics.contextCoveragePct !== null
            ? `Context coverage: ${latestMetrics.contextCoveragePct}%`
            : "Context coverage: n/a",
          `Score: ${comparison.latestScore}/100`,
        ],
        trace:
          "Query -> Match uploaded docs -> Latest API call path (structured prompts) -> Compare with traditional baseline",
        winner: winner === "chub",
        reason,
        impact: {
          call_path: latestMetrics.callPath,
          call_path_label: latestMetrics.callPathLabel,
          fallback_used: latestMetrics.fallbackUsed,
          model: latestMetrics.model,
          latency_ms: latestMetrics.latencyMs,
          prompt_tokens: latestMetrics.promptTokens,
          completion_tokens: latestMetrics.completionTokens,
          total_tokens: latestMetrics.totalTokens,
          answer_chars: latestMetrics.answerChars,
          source_count: latestMetrics.sourceCount,
          matched_docs: latestMetrics.matchedDocCount,
          had_error: latestMetrics.hadError,
          query_coverage_pct: latestMetrics.queryCoveragePct,
          context_coverage_pct: latestMetrics.contextCoveragePct,
          quality_score: latestMetrics.qualityScore,
          score: comparison.latestScore,
          score_breakdown: latestMetrics.scoreBreakdown,
        },
        missing_points:
          winner !== "chub"
            ? [
                `Scored ${comparison.latestScore}/100 vs ${comparison.traditionalScore}/100.`,
                ...comparison.highlights.slice(0, 1),
              ].filter((point) => point.length > 0)
            : chubCall.error
              ? [chubCall.error]
            : [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Chat orchestration failed:", message);
    return res.status(500).json({ error: "Failed to process chat request" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
