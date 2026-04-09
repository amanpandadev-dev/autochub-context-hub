# Auto-CHUB Agent Wrapper

A context-first coding agent wrapper that fetches API documentation context and helps avoid deprecated code patterns.

## Local Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the project root:
   ```env
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   OPENROUTER_MODEL=openrouter/auto
   ```
   Get your key at [OpenRouter Keys](https://openrouter.ai/keys).
   Tip: you can set a model ending with `:free` to prioritize free-tier models.
4. Run development mode:
   ```bash
   npm run dev
   ```
   The app runs on `http://localhost:3000`.

## Deployment

### Vercel / Netlify (client-side only)
1. Push code to GitHub.
2. Connect repository to Vercel or Netlify.
3. Add `OPENROUTER_API_KEY` (and optional `OPENROUTER_MODEL`) in environment variables.
4. Build command: `npm run build`, output directory: `dist`.

### Render / Railway (full-stack)
1. Connect repository.
2. Set `NODE_ENV=production`.
3. Set `OPENROUTER_API_KEY` and optional model variables.
4. Start command: `npm start`.

## VS Code Integration

To turn this into a VS Code extension:

1. Install extension generator:
   ```bash
   npm install -g yo generator-code
   ```
2. Generate extension project:
   ```bash
   yo code
   ```
3. Copy `extension-template.ts` into your extension `src/extension.ts`.
4. Add commands in your extension `package.json`:
   - `autochub.open`
   - `autochub.analyzeCurrentFile`
   - `autochub.analyzeSelection`
   - `autochub.applyAllLatestFixes`
   - `autochub.debugSelection`
5. Add this configuration contribution in your extension `package.json`:
   ```json
   {
     "contributes": {
       "configuration": {
         "title": "Auto-CHUB",
         "properties": {
           "autochub.appUrl": {
             "type": "string",
             "default": "http://localhost:3000",
             "description": "URL used by the Auto-CHUB webview panel."
           }
         }
       }
     }
   }
   ```
6. Run the extension in Extension Development Host (`F5`).

This template now includes:
- Outdated API detection diagnostics in supported files.
- Quick fixes to replace known deprecated patterns.
- "Apply all fixes" command for bulk modernization.
- Debug assistant panel with migration guidance and context-aware hints.
- Generic legacy-call heuristics plus configurable custom regex rules.

### Run Directly From This Repo

You can test the extension in-place without creating another scaffold:

1. Open this repository in VS Code.
2. Build the extension host bundle:
   ```bash
   npm run build:extension
   ```
3. Press `F5` and choose `Run Auto-CHUB Extension`.
4. In the Extension Development Host window, open any other codebase folder.
5. Run commands from Command Palette:
   - `Auto-CHUB: Analyze Current File`
   - `Auto-CHUB: Analyze Selection`
   - `Auto-CHUB: Apply All Latest Fixes`
   - `Auto-CHUB: Apply LLM-Assisted Fixes`
   - `Auto-CHUB: Debug Selection`

### Legacy Static Detection Settings

These settings are available, but the current Analyze/Apply flows are configured for strict Context Hub results (no fallback merge). Keep them only if you want static patterns for future non-CHUB workflows:

```json
{
  "autochub.enableGenericLegacyDetector": true,
  "autochub.genericLegacyMethodNames": [
    "GoogleGenAI",
    "generateContent",
    "chat.completions.create",
    "createChatCompletion"
  ],
  "autochub.customOutdatedPatterns": [
    {
      "id": "gemini-sdk-import",
      "title": "Gemini SDK import detected",
      "pattern": "from\\s+[\"']@google/genai[\"']",
      "flags": "g",
      "guidance": "Prefer your approved provider client for this project.",
      "docsUrl": "https://openrouter.ai/docs/quickstart"
    }
  ]
}
```

### Context Hub CLI Integration (Andrew Ng Repo Flow)

The extension can use the official Context Hub CLI on analyze commands:

1. Install CLI:
   ```bash
   npm install -g @aisuite/chub
   ```
2. Verify:
   ```bash
   chub search openai
   chub get openai/chat --lang javascript
   ```
3. Keep this enabled (default):
   ```json
   {
     "autochub.useContextHubCli": true,
     "autochub.chubBinaryPath": "chub",
     "autochub.contextHubMaxQueries": 4,
     "autochub.contextHubMaxDocs": 3
   }
   ```

During `Analyze Current File` and `Analyze Selection`, the extension now:
- infers likely library/API queries from your code,
- seeds provider-specific doc IDs (for example `openai/chat`, `openai/package`) when signatures are detected,
- runs `chub search` with robust query variants and `chub get --lang <language> --json`,
- extracts deprecation hints from fetched docs,
- adds GitHub citation links per finding (when doc path is available),
- includes an efficiency comparison note ("legacy vs recommended") from nearby doc evidence,
- surfaces only citation-backed findings in the Analyze flows.

Strict behavior (no fallback):
- If Context Hub returns no usable docs/rules for a file, Auto-CHUB returns no findings for that run instead of appending built-in/generic fallback detections.

Debug tip:
- Open `View -> Output -> Auto-CHUB` to see inferred queries, search hits, fetched doc IDs, and extracted citation-backed rule counts for each analysis run.
- During Analyze/Apply commands, the `Auto-CHUB` output channel is auto-revealed and streams live `chub search/get/annotate/feedback` execution lines.

During `Apply All Latest Fixes`, after replacements are applied, the extension now:
- calls `chub annotate <id> <note>` for each cited Context Hub doc used in applied fixes,
- asks for quick user feedback (`Helpful` / `Needs Improvement` / `Skip`),
- sends `chub feedback <id> up|down <comment>` for the selected docs.

### LLM-Assisted Migration

You can optionally let OpenRouter rewrite outdated API usages after CHUB context retrieval:

```json
{
  "autochub.enableLlmFixes": true,
  "autochub.openRouterApiKey": "",
  "autochub.openRouterModel": "openrouter/auto",
  "autochub.openRouterApiUrl": "https://openrouter.ai/api/v1/chat/completions",
  "autochub.llmFixesMaxInputChars": 80000
}
```

Key resolution order:
1. `autochub.openRouterApiKey`
2. `OPENROUTER_API_KEY` environment variable
3. workspace `.env` (`OPENROUTER_API_KEY=...`)

You can still use direct CLI commands anytime:
- `chub search "<query>"`
- `chub get <id> --lang javascript`
- `chub annotate <id> "<note>"`
- `chub feedback <id> up` or `down`

## Security

- API keys: never commit `.env`.
- Privacy: this app sends prompts/code context to OpenRouter and the selected model provider. Review provider policies before production use.
