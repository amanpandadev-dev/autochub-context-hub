/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Search, 
  Code2, 
  ShieldCheck, 
  AlertTriangle, 
  Info, 
  History, 
  ChevronRight, 
  Terminal,
  Layers,
  CheckCircle2,
  Loader2,
  ExternalLink,
  PlusCircle,
  MessageSquare
} from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { searchChub, generateGroundedCode } from './lib/openrouter';
import { GenerationResult, TokenUsage } from './types';

// VS Code API Bridge
const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;

function formatTokenUsage(usage: TokenUsage): string {
  return `P ${usage.promptTokens} • C ${usage.completionTokens} • T ${usage.totalTokens}`;
}

export default function App() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [activeTab, setActiveTab] = useState<'docs' | 'annotations'>('docs');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSearching || isGenerating) return;

    setIsSearching(true);
    setResult(null);

    try {
      // Step 1: Search CHUB
      const context = await searchChub(query);
      setIsSearching(false);
      setIsGenerating(true);

      // Step 2: Generate Grounded Code
      const genResult = await generateGroundedCode(query, context);
      setResult(genResult);
      setHistory(prev => [genResult, ...prev]);
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsSearching(false);
      setIsGenerating(false);
    }
  };

  const insertToEditor = (code: string) => {
    if (vscode) {
      vscode.postMessage({
        command: 'insertCode',
        code: code
      });
    } else {
      // Fallback: Post message to parent (for iframe usage)
      window.parent.postMessage({
        command: 'insertCode',
        code: code
      }, '*');
      
      // Also copy to clipboard as a fallback
      navigator.clipboard.writeText(code);
      alert("Code copied to clipboard! (VS Code bridge not detected)");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117]">
      {/* Sidebar - CHUB Context Viewer */}
      <aside className="w-80 border-r border-[#30363d] flex flex-col bg-[#0d1117] shrink-0">
        <div className="p-4 border-b border-[#30363d] flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-semibold text-sm tracking-tight">CHUB Context</h1>
        </div>

        <div className="flex border-b border-[#30363d]">
          <button 
            onClick={() => setActiveTab('docs')}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors",
              activeTab === 'docs' ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-500 hover:text-gray-300"
            )}
          >
            Documentation
          </button>
          <button 
            onClick={() => setActiveTab('annotations')}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors",
              activeTab === 'annotations' ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-500 hover:text-gray-300"
            )}
          >
            Annotations
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {result ? (
            activeTab === 'docs' ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">API / Provider</label>
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-400">
                    <CheckCircle2 className="w-4 h-4" />
                    {result.context.api}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Version</label>
                  <div className="text-sm font-mono bg-[#161b22] px-2 py-1 rounded border border-[#30363d]">
                    {result.context.version}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Latest Docs Summary</label>
                  <div className="markdown-body text-xs text-gray-400 leading-relaxed">
                    <ReactMarkdown>{result.context.authoritativeDocs}</ReactMarkdown>
                  </div>
                </div>

                {result.context.deprecated.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-red-500 font-bold">Deprecated Patterns</label>
                    <div className="space-y-1">
                      {result.context.deprecated.map((dep, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-red-400 bg-red-900/10 p-2 rounded border border-red-900/30">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="font-mono">{dep}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {result.annotations.map((ann) => (
                  <div key={ann.id} className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                        ann.tag === 'deprecated_fix' ? "bg-green-900/30 text-green-400" :
                        ann.tag === 'warning' ? "bg-red-900/30 text-red-400" :
                        "bg-blue-900/30 text-blue-400"
                      )}>
                        {ann.tag.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-gray-500">{(ann.confidence * 100).toFixed(0)}% conf</span>
                    </div>
                    
                    {ann.from && ann.to && (
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="text-red-400 line-through">{ann.from}</span>
                        <ChevronRight className="w-3 h-3 text-gray-600" />
                        <span className="text-green-400">{ann.to}</span>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-400 leading-snug">{ann.content}</p>
                  </div>
                ))}
                
                <button className="w-full py-2 border border-dashed border-[#30363d] rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-all flex items-center justify-center gap-2">
                  <PlusCircle className="w-3 h-3" />
                  Add Annotation
                </button>
              </motion.div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
              <Search className="w-12 h-12 text-gray-600" />
              <p className="text-xs text-gray-500 max-w-[180px]">
                Enter a prompt to fetch latest API context from CHUB.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col bg-[#0d1117] relative">
        {/* Header / Status Bar */}
        <header className="h-14 border-b border-[#30363d] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                result ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-gray-600"
              )} />
              <span className="text-xs font-medium text-gray-400">
                {isSearching ? "Searching CHUB..." : isGenerating ? "Generating Grounded Code..." : result ? "Context Grounded" : "Ready"}
              </span>
            </div>
            
            {result && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-900/20 border border-green-900/30 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-tight">Using Latest Docs</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-500 hover:text-gray-300 transition-colors">
              <History className="w-4 h-4" />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-300 transition-colors">
              <Terminal className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8" ref={scrollRef}>
          <div className="max-w-4xl mx-auto space-y-8">
            {!result && !isSearching && !isGenerating && (
              <div className="py-20 text-center space-y-6">
                <div className="inline-flex p-4 bg-blue-600/10 rounded-2xl border border-blue-600/20">
                  <Code2 className="w-12 h-12 text-blue-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight text-white">Auto-CHUB Agent Wrapper</h2>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Stop generating deprecated code. Our wrapper intercepts your prompts, fetches authoritative API docs, and grounds your agent in the latest context.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-4">
                  {['OpenAI Chat API', 'Stripe Checkout', 'AWS S3 Upload', 'GitHub Actions'].map((suggestion) => (
                    <button 
                      key={suggestion}
                      onClick={() => setQuery(`Generate ${suggestion} call`)}
                      className="px-3 py-1.5 rounded-full bg-[#161b22] border border-[#30363d] text-xs text-gray-400 hover:border-blue-500/50 hover:text-blue-400 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(isSearching || isGenerating) && (
              <div className="space-y-6 py-12">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <div className="text-center">
                    <h3 className="text-sm font-medium text-white">
                      {isSearching ? "Consulting CHUB Registries..." : "Generating Grounded Code..."}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {isSearching ? "Detecting API intent and fetching latest authoritative docs." : "Applying context injection to ensure modern API usage."}
                    </p>
                  </div>
                </div>
                
                <div className="w-full max-w-xs mx-auto h-1 bg-[#161b22] rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-blue-500"
                    initial={{ width: "0%" }}
                    animate={{ width: isSearching ? "40%" : "90%" }}
                    transition={{ duration: 2 }}
                  />
                </div>
              </div>
            )}

            {result && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Prompt Card */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">U</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-300">{result.originalPrompt}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <Search className="w-3 h-3" />
                      <span>CHUB Search triggered: detected {result.context.api} intent</span>
                    </div>
                  </div>
                </div>

                {/* Response Card */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-bold text-white">CHUB Agent</span>
                  </div>

                  <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-[#0d1117] border-b border-[#30363d] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-gray-500" />
                        <span className="text-xs font-mono text-gray-400">generated_code.ts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-green-900/20 rounded border border-green-900/30">
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                          <span className="text-[9px] font-bold text-green-400 uppercase">Verified</span>
                        </div>
                        <button 
                          onClick={() => insertToEditor(result.generatedCode)}
                          className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 rounded text-[9px] font-bold text-white uppercase hover:bg-blue-500 transition-colors"
                        >
                          <PlusCircle className="w-3 h-3" />
                          Insert to Editor
                        </button>
                      </div>
                    </div>
                    <div className="p-4 overflow-x-auto">
                      <pre className="text-sm font-mono text-[#79c0ff] leading-relaxed">
                        {result.generatedCode}
                      </pre>
                    </div>
                  </div>

                  <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Info className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Why this is correct</span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {result.explanation}
                    </p>
                  </div>
                </div>

                {/* Quality + Token Comparison */}
                <div className="space-y-4">
                  <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-semibold text-white">Context HUB Comparison</span>
                      </div>
                      <span className={cn(
                        "text-[10px] px-2 py-1 rounded border uppercase font-bold",
                        result.comparison.winner === 'latest'
                          ? "bg-green-900/30 text-green-400 border-green-800/60"
                          : result.comparison.winner === 'legacy'
                          ? "bg-yellow-900/30 text-yellow-300 border-yellow-800/60"
                          : "bg-gray-800 text-gray-300 border-gray-700"
                      )}>
                        Winner: {result.comparison.winner}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {result.comparison.summary}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className={cn(
                        "text-[10px] px-2 py-1 rounded border font-semibold",
                        result.comparison.qualityDelta >= 0
                          ? "text-green-400 bg-green-900/20 border-green-900/40"
                          : "text-red-400 bg-red-900/20 border-red-900/40"
                      )}>
                        Quality Delta: {result.comparison.qualityDelta >= 0 ? '+' : ''}{result.comparison.qualityDelta}
                      </span>
                      <span className={cn(
                        "text-[10px] px-2 py-1 rounded border font-semibold",
                        result.comparison.tokenDelta <= 0
                          ? "text-green-400 bg-green-900/20 border-green-900/40"
                          : "text-yellow-300 bg-yellow-900/20 border-yellow-900/40"
                      )}>
                        Token Delta: {result.comparison.tokenDelta >= 0 ? '+' : ''}{result.comparison.tokenDelta}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-[#161b22] border border-[#4d3b1f] rounded-xl overflow-hidden">
                      <div className="px-4 py-2 bg-[#0d1117] border-b border-[#4d3b1f] flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wide text-yellow-300">Older API Method</span>
                        <span className="text-[10px] font-mono text-yellow-200">{formatTokenUsage(result.comparison.legacy.tokenUsage)}</span>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <span className="text-[10px] px-2 py-1 rounded border border-yellow-900/50 text-yellow-300 bg-yellow-900/20">
                            Quality: {result.comparison.legacy.qualityScore}/100
                          </span>
                          <button
                            onClick={() => insertToEditor(result.comparison.legacy.generatedCode)}
                            className="text-[10px] px-2 py-1 rounded border border-[#30363d] text-gray-300 hover:text-white hover:border-gray-400 transition-colors"
                          >
                            Insert Legacy
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{result.comparison.legacy.qualitySummary}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{result.comparison.legacy.explanation}</p>
                        <div className="overflow-x-auto border border-[#30363d] rounded-lg">
                          <pre className="text-xs font-mono text-yellow-100 p-3 leading-relaxed">
                            {result.comparison.legacy.generatedCode}
                          </pre>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#161b22] border border-[#1e4e35] rounded-xl overflow-hidden">
                      <div className="px-4 py-2 bg-[#0d1117] border-b border-[#1e4e35] flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wide text-green-400">Latest API Method</span>
                        <span className="text-[10px] font-mono text-green-300">{formatTokenUsage(result.comparison.latest.tokenUsage)}</span>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <span className="text-[10px] px-2 py-1 rounded border border-green-900/50 text-green-400 bg-green-900/20">
                            Quality: {result.comparison.latest.qualityScore}/100
                          </span>
                          <button
                            onClick={() => insertToEditor(result.comparison.latest.generatedCode)}
                            className="text-[10px] px-2 py-1 rounded border border-green-900/50 text-green-300 hover:text-white hover:border-green-400 transition-colors"
                          >
                            Insert Latest
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{result.comparison.latest.qualitySummary}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{result.comparison.latest.explanation}</p>
                        <div className="overflow-x-auto border border-[#30363d] rounded-lg">
                          <pre className="text-xs font-mono text-green-200 p-3 leading-relaxed">
                            {result.comparison.latest.generatedCode}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <footer className="p-6 border-t border-[#30363d] bg-[#0d1117]">
          <form onSubmit={handleGenerate} className="max-w-4xl mx-auto relative">
            <div className="relative group">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask for any API implementation (e.g., 'OpenAI chat call')..."
                className="w-full bg-[#161b22] border border-[#30363d] rounded-xl py-4 pl-4 pr-16 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all resize-none min-h-[60px]"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate(e);
                  }
                }}
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-[#0d1117] border border-[#30363d] rounded text-[10px] text-gray-500">
                  <ChevronRight className="w-3 h-3" />
                  <span>Enter</span>
                </div>
                <button 
                  type="submit"
                  disabled={!query.trim() || isSearching || isGenerating}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSearching || isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-4">
                <button type="button" className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  Docs Registry
                </button>
                <button type="button" className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                  <MessageSquare className="w-3 h-3" />
                  Feedback
                </button>
              </div>
              <div className="text-[10px] text-gray-600 font-mono">
                CHUB v1.0.4 • Grounding Active
              </div>
            </div>
          </form>
        </footer>
      </main>
    </div>
  );
}
