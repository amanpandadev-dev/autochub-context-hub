import {
  Annotation,
  ChubContext,
  GenerationResult,
  MethodComparison,
  TokenUsage,
} from "../types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const SEARCH_MODEL =
  process.env.OPENROUTER_SEARCH_MODEL ||
  process.env.OPENROUTER_MODEL ||
  "openrouter/auto";
const CODE_MODEL =
  process.env.OPENROUTER_CODE_MODEL ||
  process.env.OPENROUTER_MODEL ||
  "openrouter/auto";

type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterContentPart = {
  text?: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | OpenRouterContentPart[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
};

type RawGenerationResult = {
  originalPrompt?: string;
  generatedCode?: string;
  explanation?: string;
  annotations?: Array<Partial<Annotation>>;
};

type RawLegacyGenerationResult = {
  generatedCode?: string;
  explanation?: string;
};

type RawQualityEvaluation = {
  legacyQualityScore?: number;
  latestQualityScore?: number;
  legacyQualitySummary?: string;
  latestQualitySummary?: string;
  winner?: "legacy" | "latest" | "tie";
  summary?: string;
};

type OpenRouterCompletion = {
  text: string;
  usage: TokenUsage;
};

function ensureApiKey(): string {
  const key = OPENROUTER_API_KEY.trim();
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is missing. Set it in your .env file.");
  }
  return key;
}

function toNonNegativeInt(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

function normalizeUsage(payload: OpenRouterResponse): TokenUsage {
  const promptTokens = toNonNegativeInt(payload.usage?.prompt_tokens);
  const completionTokens = toNonNegativeInt(payload.usage?.completion_tokens);
  const totalTokensRaw = toNonNegativeInt(payload.usage?.total_tokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens:
      totalTokensRaw > 0 ? totalTokensRaw : promptTokens + completionTokens,
  };
}

function extractResponseText(payload: OpenRouterResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((part) => part.text || "").join("");
  }
  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }
  throw new Error("OpenRouter returned an empty completion.");
}

function extractJsonText(raw: string): string {
  const fencedJson = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fencedJson?.[1]) {
    return fencedJson[1].trim();
  }

  const fenced = raw.match(/```\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  return raw.trim();
}

function parseJsonResponse<T>(raw: string, label: string): T {
  const jsonText = extractJsonText(raw);
  try {
    return JSON.parse(jsonText) as T;
  } catch (error) {
    const snippet = raw.slice(0, 600);
    throw new Error(
      `Failed to parse ${label} response as JSON. Received: ${snippet}`,
    );
  }
}

function normalizeScore(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function chooseWinner(
  candidate: unknown,
  legacyScore: number,
  latestScore: number,
): "legacy" | "latest" | "tie" {
  if (candidate === "legacy" || candidate === "latest" || candidate === "tie") {
    return candidate;
  }
  if (legacyScore === latestScore) {
    return "tie";
  }
  return latestScore > legacyScore ? "latest" : "legacy";
}

function normalizeChubContext(raw: Partial<ChubContext>): ChubContext {
  const deprecated =
    Array.isArray(raw.deprecated) && raw.deprecated.length > 0
      ? raw.deprecated.map((item) => String(item)).filter(Boolean)
      : [];

  return {
    api: String(raw.api || "Unknown API"),
    endpoint: String(raw.endpoint || ""),
    deprecated,
    version: String(raw.version || "latest"),
    notes: String(raw.notes || ""),
    authoritativeDocs: String(raw.authoritativeDocs || ""),
  };
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.6;
  }
  return Math.min(1, Math.max(0, value));
}

function normalizeAnnotations(
  annotations: Array<Partial<Annotation>> | undefined,
): Annotation[] {
  if (!Array.isArray(annotations)) {
    return [];
  }

  const now = Date.now();
  return annotations.map((ann, index) => {
    const tag =
      ann.tag === "deprecated_fix" || ann.tag === "warning" ? ann.tag : "note";

    return {
      id: `ann-${now}-${index}`,
      tag,
      from: ann.from ? String(ann.from) : undefined,
      to: ann.to ? String(ann.to) : undefined,
      content: ann.content ? String(ann.content) : "No details provided.",
      confidence: clampConfidence(ann.confidence),
      timestamp: now,
    };
  });
}

async function callOpenRouter(
  messages: OpenRouterMessage[],
  model: string,
  temperature = 0.2,
): Promise<OpenRouterCompletion> {
  const apiKey = ensureApiKey();
  const referer =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost:3000";

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": referer,
      "X-Title": "Auto-CHUB Agent Wrapper",
    },
    body: JSON.stringify({
      model,
      temperature,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter request failed (${response.status}): ${errorText}`,
    );
  }

  const payload = (await response.json()) as OpenRouterResponse;
  return {
    text: extractResponseText(payload),
    usage: normalizeUsage(payload),
  };
}

export async function searchChub(query: string): Promise<ChubContext> {
  const completion = await callOpenRouter(
    [
      {
        role: "system",
        content:
          "You are CHUB (Context Hub), an authoritative API documentation assistant. Return only valid JSON.",
      },
      {
        role: "user",
        content: `Analyze this coding request and provide modern API guidance:
"${query}"

Return a JSON object with this exact structure:
{
  "api": "string",
  "endpoint": "string",
  "deprecated": ["string"],
  "version": "string",
  "notes": "string",
  "authoritativeDocs": "string"
}

Rules:
- Highlight known deprecated patterns in "deprecated".
- Keep "authoritativeDocs" concise markdown with modern usage tips.
- Return JSON only, no extra text.`,
      },
    ],
    SEARCH_MODEL,
    0.1,
  );

  const parsed = parseJsonResponse<Partial<ChubContext>>(
    completion.text,
    "searchChub",
  );
  return normalizeChubContext(parsed);
}

export async function generateGroundedCode(
  query: string,
  context: ChubContext,
): Promise<GenerationResult> {
  const legacyCompletion = await callOpenRouter(
    [
      {
        role: "system",
        content:
          "You are simulating an older coding assistant. Return only valid JSON.",
      },
      {
        role: "user",
        content: `Generate code for this request:
${query}

Provide an older-style implementation that likely reflects historical patterns before the latest docs refresh.

Context:
API: ${context.api}
Known deprecated patterns: ${context.deprecated.join(", ") || "Not specified"}

Return JSON:
{
  "generatedCode": "string",
  "explanation": "string"
}

Rules:
- Prefer older/common legacy patterns where relevant.
- Keep code syntactically valid.
- Return JSON only.`,
      },
    ],
    CODE_MODEL,
    0.35,
  );

  const latestCompletion = await callOpenRouter(
    [
      {
        role: "system",
        content:
          "You generate modern API code and must avoid deprecated patterns. Return only valid JSON.",
      },
      {
        role: "user",
        content: `User Query: ${query}

Authoritative Context:
API: ${context.api}
Version: ${context.version}
Endpoint: ${context.endpoint}
Deprecated Patterns: ${context.deprecated.join(", ") || "None"}
Notes: ${context.notes}
Docs Summary: ${context.authoritativeDocs}

Return this exact JSON structure:
{
  "originalPrompt": "${query}",
  "generatedCode": "string",
  "explanation": "string",
  "annotations": [
    {
      "tag": "deprecated_fix" | "note" | "warning",
      "from": "string (optional)",
      "to": "string (optional)",
      "content": "string",
      "confidence": number
    }
  ]
}

Rules:
- Use the latest non-deprecated approach only.
- Keep annotations practical and specific.
- Return JSON only, no markdown fences or extra prose.`,
      },
    ],
    CODE_MODEL,
    0.2,
  );

  const legacyParsed = parseJsonResponse<RawLegacyGenerationResult>(
    legacyCompletion.text,
    "generateLegacyCode",
  );

  const latestParsed = parseJsonResponse<RawGenerationResult>(
    latestCompletion.text,
    "generateGroundedCode",
  );

  let evaluation: RawQualityEvaluation = {};
  try {
    const evaluationCompletion = await callOpenRouter(
      [
        {
          role: "system",
          content:
            "You are a strict API quality evaluator. Score both responses and return only JSON.",
        },
        {
          role: "user",
          content: `Evaluate two responses to the same coding task.

Task:
${query}

Authoritative latest context:
API: ${context.api}
Version: ${context.version}
Endpoint: ${context.endpoint}
Deprecated patterns to avoid: ${context.deprecated.join(", ") || "None listed"}
Notes: ${context.notes}
Docs Summary: ${context.authoritativeDocs}

Legacy response:
${legacyParsed.generatedCode || ""}

Latest response:
${latestParsed.generatedCode || ""}

Return JSON:
{
  "legacyQualityScore": number,
  "latestQualityScore": number,
  "legacyQualitySummary": "string",
  "latestQualitySummary": "string",
  "winner": "legacy" | "latest" | "tie",
  "summary": "string"
}

Rubric (0-100 each):
- Correctness against latest docs: 40
- Completeness for user task: 20
- Maintainability/readability: 20
- Safety/reliability: 20

Rules:
- Scores must be integers.
- In case of very close results, choose "tie".
- Return JSON only.`,
        },
      ],
      CODE_MODEL,
      0.1,
    );

    evaluation = parseJsonResponse<RawQualityEvaluation>(
      evaluationCompletion.text,
      "qualityComparison",
    );
  } catch (error) {
    console.warn("Quality comparison fallback engaged:", error);
  }

  const legacyQualityScore = normalizeScore(evaluation.legacyQualityScore, 45);
  const latestQualityScore = normalizeScore(evaluation.latestQualityScore, 88);
  const winner = chooseWinner(
    evaluation.winner,
    legacyQualityScore,
    latestQualityScore,
  );

  const legacy: MethodComparison = {
    generatedCode: String(legacyParsed.generatedCode || ""),
    explanation:
      String(legacyParsed.explanation || "") ||
      "Legacy-style output for contrast with modern guidance.",
    qualityScore: legacyQualityScore,
    qualitySummary:
      String(evaluation.legacyQualitySummary || "") ||
      "Uses older conventions and may include deprecated API patterns.",
    tokenUsage: legacyCompletion.usage,
  };

  const latest: MethodComparison = {
    generatedCode: String(latestParsed.generatedCode || ""),
    explanation:
      String(latestParsed.explanation || "") ||
      "Generated from authoritative context using OpenRouter.",
    qualityScore: latestQualityScore,
    qualitySummary:
      String(evaluation.latestQualitySummary || "") ||
      "Aligned with latest docs and avoids deprecated patterns.",
    tokenUsage: latestCompletion.usage,
  };

  const qualityDelta = latest.qualityScore - legacy.qualityScore;
  const tokenDelta = latest.tokenUsage.totalTokens - legacy.tokenUsage.totalTokens;

  return {
    originalPrompt: latestParsed.originalPrompt || query,
    generatedCode: latest.generatedCode,
    explanation: latest.explanation,
    context,
    annotations: normalizeAnnotations(latestParsed.annotations),
    comparison: {
      legacy,
      latest,
      winner,
      summary:
        String(evaluation.summary || "") ||
        "Context HUB latest guidance is generally more accurate for modern APIs.",
      qualityDelta,
      tokenDelta,
    },
  };
}
