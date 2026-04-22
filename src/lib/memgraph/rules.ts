import { DeprecationRule, Language } from './types';

/**
 * Built-in deprecation rules registry.
 * Each rule has a regex pattern matched against source file content line-by-line.
 * Users can override/extend via .autochub.json { "rules": [...] }
 */
export const BUILTIN_RULES: DeprecationRule[] = [
  // ── Node.js ──────────────────────────────────────────────────────────────
  {
    id: 'node/new-buffer',
    title: 'new Buffer() is deprecated',
    pattern: 'new\\s+Buffer\\s*\\(',
    severity: 'critical',
    languages: ['ts', 'js'],
    guidance: 'Use Buffer.from(), Buffer.alloc(), or Buffer.allocUnsafe() instead.',
    replacement: 'Buffer.from()',
    docsUrl: 'https://nodejs.org/api/buffer.html#static-method-bufferfromarray',
  },
  {
    id: 'node/require-url',
    title: "require('url').parse() is deprecated",
    pattern: "url\\.parse\\s*\\(",
    severity: 'high',
    languages: ['ts', 'js'],
    guidance: 'Use the WHATWG URL API: new URL(input) instead.',
    replacement: 'new URL()',
    docsUrl: 'https://nodejs.org/api/url.html#class-url',
  },
  {
    id: 'node/domain',
    title: "require('domain') is deprecated",
    pattern: "require\\s*\\(['\"]domain['\"]\\)",
    severity: 'high',
    languages: ['ts', 'js'],
    guidance: 'Use async_hooks or proper error handling instead of the domain module.',
    replacement: 'async_hooks',
  },
  {
    id: 'node/process-exit',
    title: 'process.exit() without code is a bad practice',
    pattern: 'process\\.exit\\s*\\(\\s*\\)',
    severity: 'low',
    languages: ['ts', 'js', 'any'],
    guidance: 'Always pass an exit code: process.exit(0) or process.exit(1).',
    replacement: 'process.exit(1)',
  },

  // ── React ─────────────────────────────────────────────────────────────────
  {
    id: 'react/render',
    title: 'ReactDOM.render() is deprecated (React 18)',
    pattern: 'ReactDOM\\.render\\s*\\(',
    severity: 'critical',
    languages: ['ts', 'js'],
    guidance: 'Use createRoot(container).render(<App />) from react-dom/client.',
    replacement: 'createRoot().render()',
    docsUrl: 'https://react.dev/blog/2022/03/08/react-18-upgrade-guide',
  },
  {
    id: 'react/hydrate',
    title: 'ReactDOM.hydrate() is deprecated (React 18)',
    pattern: 'ReactDOM\\.hydrate\\s*\\(',
    severity: 'critical',
    languages: ['ts', 'js'],
    guidance: 'Use hydrateRoot(container, <App />) from react-dom/client.',
    replacement: 'hydrateRoot()',
    docsUrl: 'https://react.dev/reference/react-dom/client/hydrateRoot',
  },
  {
    id: 'react/string-refs',
    title: 'String refs are deprecated in React',
    pattern: 'ref=\\{?["\']\\w+["\']\\}?',
    severity: 'high',
    languages: ['ts', 'js'],
    guidance: 'Use React.createRef() or the useRef() hook.',
    replacement: 'useRef()',
    docsUrl: 'https://react.dev/reference/react/createRef',
  },
  {
    id: 'react/component-will-mount',
    title: 'componentWillMount is deprecated',
    pattern: 'componentWillMount\\s*\\(',
    severity: 'high',
    languages: ['ts', 'js'],
    guidance: 'Use componentDidMount() or the useEffect() hook.',
    replacement: 'componentDidMount()',
    docsUrl: 'https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html',
  },
  {
    id: 'react/component-will-receive-props',
    title: 'componentWillReceiveProps is deprecated',
    pattern: 'componentWillReceiveProps\\s*\\(',
    severity: 'high',
    languages: ['ts', 'js'],
    guidance: 'Use static getDerivedStateFromProps() or componentDidUpdate().',
    replacement: 'getDerivedStateFromProps()',
  },
  {
    id: 'react/component-will-update',
    title: 'componentWillUpdate is deprecated',
    pattern: 'componentWillUpdate\\s*\\(',
    severity: 'high',
    languages: ['ts', 'js'],
    guidance: 'Use getSnapshotBeforeUpdate() and componentDidUpdate().',
    replacement: 'getSnapshotBeforeUpdate()',
  },
  {
    id: 'react/find-dom-node',
    title: 'ReactDOM.findDOMNode() is deprecated',
    pattern: 'ReactDOM\\.findDOMNode\\s*\\(',
    severity: 'high',
    languages: ['ts', 'js'],
    guidance: 'Use ref callbacks or React.createRef() directly.',
    replacement: 'ref callbacks',
  },

  // ── OpenAI SDK ────────────────────────────────────────────────────────────
  {
    id: 'openai/chat-completion-create',
    title: 'openai.ChatCompletion.create() is from v3 SDK (deprecated)',
    pattern: 'ChatCompletion\\.create\\s*\\(',
    severity: 'critical',
    languages: ['ts', 'js', 'py'],
    guidance: 'Upgrade to openai v4+. Use client.chat.completions.create().',
    replacement: 'client.chat.completions.create()',
    docsUrl: 'https://github.com/openai/openai-node/discussions/182',
  },
  {
    id: 'openai/completion-create',
    title: 'openai.Completion.create() is from v3 SDK (deprecated)',
    pattern: 'Completion\\.create\\s*\\(',
    severity: 'critical',
    languages: ['ts', 'js', 'py'],
    guidance: 'Upgrade to openai v4+. Use client.completions.create().',
    replacement: 'client.completions.create()',
  },
  {
    id: 'openai/create-chat-completion',
    title: 'createChatCompletion() is from openai v3 SDK (deprecated)',
    pattern: 'createChatCompletion\\s*\\(',
    severity: 'critical',
    languages: ['ts', 'js'],
    guidance: 'Upgrade to openai v4+. Use client.chat.completions.create().',
    replacement: 'client.chat.completions.create()',
  },

  // ── Google Gemini / GenAI ─────────────────────────────────────────────────
  {
    id: 'gemini/google-genai-old',
    title: 'GoogleGenAI import from old @google/generative-ai package',
    pattern: "from\\s+['\"]@google\\/generative-ai['\"]",
    severity: 'high',
    languages: ['ts', 'js'],
    guidance: "Use the new '@google/genai' package with GoogleGenAI from 'google-genai'.",
    replacement: "@google/genai",
    docsUrl: 'https://ai.google.dev/gemini-api/docs/sdks',
  },
  {
    id: 'gemini/generate-content-old',
    title: 'model.generateContent() old API pattern',
    pattern: '\\.generateContent\\s*\\(',
    severity: 'medium',
    languages: ['ts', 'js', 'py'],
    guidance: "Verify you're using the latest Gemini SDK. New API uses ai.models.generateContent().",
    replacement: 'ai.models.generateContent()',
  },

  // ── Axios ─────────────────────────────────────────────────────────────────
  {
    id: 'axios/cancel-token',
    title: 'axios CancelToken is deprecated',
    pattern: 'CancelToken\\.source\\s*\\(\\)|new\\s+CancelToken\\s*\\(',
    severity: 'high',
    languages: ['ts', 'js'],
    guidance: 'Use AbortController with the signal option in axios requests.',
    replacement: 'AbortController',
    docsUrl: 'https://axios-http.com/docs/cancellation',
  },
  {
    id: 'axios/axios-create-defaults',
    title: 'axios.defaults mutation is discouraged',
    pattern: 'axios\\.defaults\\.',
    severity: 'low',
    languages: ['ts', 'js'],
    guidance: 'Create an axios instance with defaults: axios.create({ ... }).',
    replacement: 'axios.create()',
  },

  // ── Redux ─────────────────────────────────────────────────────────────────
  {
    id: 'redux/create-store',
    title: 'createStore() is deprecated (Redux 4.2+)',
    pattern: '\\bcreateStore\\s*\\(',
    severity: 'high',
    languages: ['ts', 'js'],
    guidance: 'Use configureStore() from @reduxjs/toolkit instead.',
    replacement: 'configureStore()',
    docsUrl: 'https://redux.js.org/introduction/why-rtk-is-redux-today',
  },
  {
    id: 'redux/apply-middleware',
    title: 'applyMiddleware() composed with createStore is deprecated',
    pattern: 'applyMiddleware\\s*\\(',
    severity: 'medium',
    languages: ['ts', 'js'],
    guidance: 'Use configureStore({ middleware }) from @reduxjs/toolkit.',
    replacement: 'configureStore({ middleware })',
  },

  // ── Moment.js ─────────────────────────────────────────────────────────────
  {
    id: 'moment/moment-import',
    title: 'moment.js is a legacy date library',
    pattern: "require\\(['\"]moment['\"]\\)|from\\s+['\"]moment['\"]",
    severity: 'medium',
    languages: ['ts', 'js'],
    guidance: 'Consider migrating to date-fns or dayjs — both are smaller and tree-shakeable.',
    replacement: 'date-fns or dayjs',
    docsUrl: 'https://momentjs.com/docs/#/-project-status/',
  },

  // ── Lodash ────────────────────────────────────────────────────────────────
  {
    id: 'lodash/full-import',
    title: 'Importing entire lodash bundle',
    pattern: "require\\(['\"]lodash['\"]\\)|from\\s+['\"]lodash['\"]",
    severity: 'low',
    languages: ['ts', 'js'],
    guidance: 'Import individual methods: import debounce from "lodash/debounce" for better tree-shaking.',
    replacement: 'lodash/method',
  },

  // ── Express ───────────────────────────────────────────────────────────────
  {
    id: 'express/body-parser',
    title: 'Separate body-parser package is deprecated',
    pattern: "require\\(['\"]body-parser['\"]\\)|from\\s+['\"]body-parser['\"]",
    severity: 'medium',
    languages: ['ts', 'js'],
    guidance: 'Express 4.16+ bundles body parsing: use express.json() and express.urlencoded().',
    replacement: 'express.json()',
    docsUrl: 'https://expressjs.com/en/changelog/4x.html#4.16.0',
  },
  {
    id: 'express/res-jsonp',
    title: 'res.jsonp() with callback is a security risk',
    pattern: 'res\\.jsonp\\s*\\(',
    severity: 'medium',
    languages: ['ts', 'js'],
    guidance: 'Avoid JSONP; use CORS headers with res.json() instead.',
    replacement: 'res.json() with CORS',
  },

  // ── Python ────────────────────────────────────────────────────────────────
  {
    id: 'python/print-statement',
    title: 'Python 2 print statement (no parentheses)',
    pattern: '^\\s*print\\s+[^(]',
    severity: 'critical',
    languages: ['py'],
    guidance: 'Use print() function (Python 3 syntax).',
    replacement: 'print()',
  },
  {
    id: 'python/urllib2',
    title: 'urllib2 is Python 2 only',
    pattern: 'import\\s+urllib2|from\\s+urllib2',
    severity: 'critical',
    languages: ['py'],
    guidance: 'Use urllib.request in Python 3, or the requests library.',
    replacement: 'urllib.request',
  },
  {
    id: 'python/has-key',
    title: 'dict.has_key() is deprecated in Python 3',
    pattern: '\\.has_key\\s*\\(',
    severity: 'high',
    languages: ['py'],
    guidance: 'Use the "in" operator: "key in dict".',
    replacement: '"key" in dict',
  },

  // ── TypeScript ────────────────────────────────────────────────────────────
  {
    id: 'ts/namespace-import',
    title: 'TypeScript namespace/module keyword (non-module usage)',
    pattern: '^\\s*namespace\\s+\\w+|^\\s*module\\s+\\w+',
    severity: 'low',
    languages: ['ts'],
    guidance: 'Prefer ES Modules (import/export) over TypeScript namespaces.',
    replacement: 'ES modules',
    docsUrl: 'https://www.typescriptlang.org/docs/handbook/namespaces-and-modules.html',
  },

  // ── Misc ──────────────────────────────────────────────────────────────────
  {
    id: 'misc/eval',
    title: 'eval() is dangerous and slow',
    pattern: '\\beval\\s*\\(',
    severity: 'critical',
    languages: ['ts', 'js', 'any'],
    guidance: 'Never use eval(). Refactor to use safe alternatives.',
    replacement: 'safe alternatives',
  },
  {
    id: 'misc/document-write',
    title: 'document.write() is deprecated',
    pattern: 'document\\.write\\s*\\(',
    severity: 'high',
    languages: ['ts', 'js'],
    guidance: 'Use DOM manipulation methods like createElement and appendChild.',
    replacement: 'appendChild()',
  },

  // ── LangChain ─────────────────────────────────────────────────────────────
  {
    id: 'langchain/llms-deprecated',
    title: 'langchain.llms is deprecated in v0.2',
    pattern: "from\\s+langchain\\.llms|import\\s+.*\\s+from\\s+['\"]langchain\\/llms['\"]",
    severity: 'high',
    languages: ['py', 'ts', 'js'],
    guidance: 'Use langchain-openai, langchain-anthropic, etc. or langchain_community.llms.',
    replacement: 'langchain_openai.llms',
    docsUrl: 'https://python.langchain.com/v0.2/docs/how_to/migration/',
  },
  {
    id: 'langchain/chat-models-deprecated',
    title: 'langchain.chat_models is deprecated in v0.2',
    pattern: "from\\s+langchain\\.chat_models|import\\s+.*\\s+from\\s+['\"]langchain\\/chat_models['\"]",
    severity: 'high',
    languages: ['py', 'ts', 'js'],
    guidance: 'Use langchain_openai.ChatOpenAI or similar provider-specific packages.',
    replacement: 'langchain_openai.ChatOpenAI',
  },
  {
    id: 'langchain/run-deprecated',
    title: 'chain.run() is deprecated',
    pattern: '\\.run\\s*\\(',
    severity: 'medium',
    languages: ['py', 'ts', 'js'],
    guidance: 'Use .invoke() instead of .run().',
    replacement: '.invoke()',
  },
  {
    id: 'langchain/predict-deprecated',
    title: 'chain.predict() is deprecated',
    pattern: '\\.predict\\s*\\(',
    severity: 'medium',
    languages: ['py', 'ts', 'js'],
    guidance: 'Use .invoke() for a consistent interface across all Runnables.',
    replacement: '.invoke()',
  },
  {
    id: 'langchain/llm-chain-deprecated',
    title: 'LLMChain is legacy',
    pattern: '\\bLLMChain\\b',
    severity: 'medium',
    languages: ['py', 'ts', 'js'],
    guidance: 'Use LCEL (LangChain Expression Language) chains instead.',
    replacement: 'prompt | llm',
  },
];

/**
 * Returns the language key for a file extension.
 */
export function langFromExt(ext: string): Language {
  const map: Record<string, Language> = {
    '.ts': 'ts', '.tsx': 'ts',
    '.js': 'js', '.jsx': 'js', '.mjs': 'js', '.cjs': 'js',
    '.py': 'py',
    '.java': 'java',
    '.go': 'go',
    '.cs': 'cs',
  };
  return map[ext] ?? 'any';
}

/**
 * Filter rules applicable to a given language.
 */
export function rulesForLang(lang: Language, rules: DeprecationRule[]): DeprecationRule[] {
  return rules.filter(r => r.languages.includes(lang) || r.languages.includes('any'));
}
