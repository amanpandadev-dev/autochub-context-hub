import React, { useState } from "react";
import RAGPanel from "@/src/components/RAGPanel";
import ChatInterface from "@/src/components/ChatInterface";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "motion/react";
import { Github, Info, Zap, ShieldCheck, Database } from "lucide-react";

export default function App() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const winner = results?.comparison?.winner || (results?.chub?.winner ? "chub" : "traditional");
  const winnerLabel = winner === "chub" ? "CHUB Agentic" : "Traditional API";
  const summaryReason =
    results?.comparison?.reason ||
    (winner === "chub"
      ? "The latest API method (CHUB) won this comparison."
      : "The traditional API method won this comparison.");
  const latencyDeltaMs = results?.comparison?.latency_delta_ms;
  const tokenDelta = results?.comparison?.token_delta;
  const qualityDelta = results?.comparison?.quality_delta;
  const latestScore = results?.comparison?.latest_score;
  const traditionalScore = results?.comparison?.traditional_score;
  const highlights: string[] = Array.isArray(results?.comparison?.highlights) ? results.comparison.highlights : [];

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-blue-500/30">
        {/* Header */}
        <header className="border-b border-zinc-800 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white uppercase">RAG Response Comparator</h1>
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Legacy vs AI vs CHUB</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-help">
                <Github className="w-4 h-4" />
                <span className="text-[10px] font-mono uppercase tracking-widest">Andrew Ng CHUB</span>
              </div>
              <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400 text-[10px] uppercase tracking-widest px-3 py-1">
                v1.0.0-BETA
              </Badge>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6 min-h-[calc(100vh-64px)]">
          {/* Top Section: Chat & Controls */}
          <section className="shrink-0">
            <div className="flex flex-col items-center text-center mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1"
              >
                <h2 className="text-2xl font-bold tracking-tighter text-white sm:text-3xl">
                  RAG Comparison Engine
                </h2>
                <p className="text-zinc-500 max-w-2xl mx-auto text-xs leading-relaxed">
                  Compare Traditional API retrieval against CHUB Agentic workflows with auto-deployment.
                </p>
              </motion.div>
            </div>
            
            <ChatInterface onResults={setResults} onLoading={setLoading} />
          </section>

          {/* Comparison Summary */}
          <AnimatePresence>
            {results && !loading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="shrink-0"
              >
                <div className="bg-blue-600/10 border border-blue-600/20 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-tight">Analysis Complete</h3>
                      <p className="text-xs text-zinc-400">
                        {winner === "chub"
                          ? <>The <span className="text-blue-400 font-bold">latest API method (CHUB)</span> won this comparison.</>
                          : <>The <span className="text-blue-400 font-bold">traditional API method</span> won this comparison.</>}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1">{summaryReason}</p>
                      {highlights.length > 0 && (
                        <p className="text-[11px] text-zinc-400 mt-1">{highlights[0]}</p>
                      )}
                      {(latencyDeltaMs !== null && latencyDeltaMs !== undefined) || (tokenDelta !== null && tokenDelta !== undefined) || (qualityDelta !== null && qualityDelta !== undefined) ? (
                        <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
                          {qualityDelta !== null && qualityDelta !== undefined && (
                            <span>
                              Quality Delta: {qualityDelta >= 0 ? `Latest +${qualityDelta}` : `Traditional +${Math.abs(qualityDelta)}`}
                            </span>
                          )}
                          {latencyDeltaMs !== null && latencyDeltaMs !== undefined && (
                            <span>
                              Latency Delta: {latencyDeltaMs >= 0 ? `Latest ${latencyDeltaMs}ms faster` : `Traditional ${Math.abs(latencyDeltaMs)}ms faster`}
                            </span>
                          )}
                          {tokenDelta !== null && tokenDelta !== undefined && (
                            <span>
                              Token Delta: {tokenDelta >= 0 ? `Latest used ${tokenDelta} fewer` : `Traditional used ${Math.abs(tokenDelta)} fewer`}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Winner</p>
                      <p className="text-xs font-bold text-green-500 uppercase tracking-widest">
                        {winnerLabel}
                      </p>
                      {(latestScore !== undefined && traditionalScore !== undefined) && (
                        <p className="text-[10px] text-zinc-500 font-mono mt-1">
                          SCORE {latestScore} / {traditionalScore}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Comparison Grid */}
          <section className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[500px]">
            <RAGPanel 
              title="Traditional API + LLM" 
              mode="ai" 
              response={results?.traditional} 
              loading={loading} 
            />
            <RAGPanel 
              title="CHUB Agentic Workflow" 
              mode="chub" 
              response={results?.chub} 
              loading={loading} 
            />
          </section>

          {/* Footer Stats */}
          <footer className="shrink-0 border-t border-zinc-800 pt-4 pb-6 flex items-center justify-between">
            <div className="flex gap-8">
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-zinc-500" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Vector DB: ChromaDB (Mock)</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-zinc-500" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">LLM: Groq</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-zinc-600">
              <Info className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-widest font-mono italic">Grounding & Evidence Quality Comparison</span>
            </div>
          </footer>
        </main>
      </div>
    </TooltipProvider>
  );
}
