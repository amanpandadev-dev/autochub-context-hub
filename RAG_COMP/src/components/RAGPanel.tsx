import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "motion/react";
import { ExternalLink, CheckCircle, AlertCircle, Info, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RAGResponse {
  answer: string;
  sources: any[];
  confidence?: number;
  annotations?: string[];
  trace?: string;
  winner?: boolean;
  reason?: string;
  missing_points?: string[];
  impact?: {
    call_path?: string;
    call_path_label?: string;
    fallback_used?: boolean;
    model?: string;
    latency_ms?: number;
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
    answer_chars?: number;
    source_count?: number;
    matched_docs?: number;
    had_error?: boolean;
    score?: number;
    query_coverage_pct?: number | null;
    context_coverage_pct?: number | null;
    quality_score?: number | null;
    score_breakdown?: string[];
  };
}

interface RAGPanelProps {
  title: string;
  mode: "legacy" | "ai" | "chub";
  response: RAGResponse | null;
  loading: boolean;
}

export default function RAGPanel({ title, mode, response, loading }: RAGPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const asText = (value: number | null | undefined) => (value === null || value === undefined ? "n/a" : String(value));

  const getBadgeColor = () => {
    switch (mode) {
      case "legacy": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "ai": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "chub": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "";
    }
  };

  const ResponseContent = ({ isFull = false }: { isFull?: boolean }) => (
    <div className={`space-y-6 ${isFull ? "pb-10" : ""}`}>
      {response?.winner && response?.reason && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex gap-3 items-start">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-green-500 uppercase tracking-wider">Winner: {title}</p>
            <p className="text-xs text-zinc-400 mt-1">{response.reason}</p>
          </div>
        </div>
      )}

      {response?.missing_points && response.missing_points.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Missing Information</p>
            <ul className="list-disc list-inside mt-1">
              {response.missing_points.map((point, i) => (
                <li key={i} className="text-xs text-zinc-400">{point}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className={`prose prose-invert max-w-none text-zinc-200 leading-relaxed ${isFull ? "text-base" : "text-sm"}`}>
        {response?.answer}
      </div>

      {response?.annotations && response.annotations.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Annotations</p>
          <div className="flex flex-wrap gap-2">
            {response.annotations.map((ann, i) => (
              <Badge key={i} variant="secondary" className="bg-zinc-800 text-zinc-300 border-none text-[10px]">
                {ann}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {response?.impact && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Impact Metrics</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded p-2">
              <p className="text-zinc-500 uppercase tracking-wider">Call Path</p>
              <p className="text-zinc-200 mt-1">{response.impact.call_path_label || response.impact.call_path || "n/a"}</p>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800 rounded p-2">
              <p className="text-zinc-500 uppercase tracking-wider">Fallback Used</p>
              <p className="text-zinc-200 mt-1">{response.impact.fallback_used ? "Yes" : "No"}</p>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800 rounded p-2">
              <p className="text-zinc-500 uppercase tracking-wider">Latency</p>
              <p className="text-zinc-200 mt-1">{asText(response.impact.latency_ms)}ms</p>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800 rounded p-2">
              <p className="text-zinc-500 uppercase tracking-wider">Total Tokens</p>
              <p className="text-zinc-200 mt-1">{asText(response.impact.total_tokens)}</p>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800 rounded p-2">
              <p className="text-zinc-500 uppercase tracking-wider">Answer Size</p>
              <p className="text-zinc-200 mt-1">{asText(response.impact.answer_chars)} chars</p>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800 rounded p-2">
              <p className="text-zinc-500 uppercase tracking-wider">Impact Score</p>
              <p className="text-zinc-200 mt-1">{asText(response.impact.score)}/100</p>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800 rounded p-2">
              <p className="text-zinc-500 uppercase tracking-wider">Quality Score</p>
              <p className="text-zinc-200 mt-1">{asText(response.impact.quality_score)}/100</p>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800 rounded p-2">
              <p className="text-zinc-500 uppercase tracking-wider">Query Coverage</p>
              <p className="text-zinc-200 mt-1">{asText(response.impact.query_coverage_pct)}%</p>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800 rounded p-2">
              <p className="text-zinc-500 uppercase tracking-wider">Context Coverage</p>
              <p className="text-zinc-200 mt-1">{asText(response.impact.context_coverage_pct)}%</p>
            </div>
          </div>
          {response.impact.score_breakdown && response.impact.score_breakdown.length > 0 && (
            <div className="bg-black/30 rounded p-2 border border-zinc-800">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Score Breakdown</p>
              <ul className="list-disc list-inside space-y-0.5">
                {response.impact.score_breakdown.map((item, idx) => (
                  <li key={idx} className="text-[10px] text-zinc-400">{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {response?.sources && response.sources.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sources</p>
          <div className="space-y-2">
            {response.sources.map((src, i) => (
              <div key={i} className="bg-zinc-800/50 rounded p-2 flex items-center justify-between group">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Info className="w-3 h-3 text-zinc-500 shrink-0" />
                  <p className="text-[10px] text-zinc-400 truncate">{src.source || src.name || "Document Source"}</p>
                </div>
                {src.source && (
                  <a href={src.source} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {response?.trace && (
        <div className="mt-6 pt-4 border-t border-zinc-800">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Execution Trace</p>
          <pre className="text-[10px] font-mono text-zinc-500 bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap">
            {response.trace}
          </pre>
        </div>
      )}

      {response?.confidence !== undefined && (
        <div className="flex items-center gap-2 mt-4">
          <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-1000" 
              style={{ width: `${response.confidence * 100}%` }} 
            />
          </div>
          <span className="text-[10px] font-mono text-zinc-500">{(response.confidence * 100).toFixed(0)}% CONF</span>
        </div>
      )}
    </div>
  );

  return (
    <Card className="h-full flex flex-col border border-zinc-800 bg-zinc-900/50 shadow-xl overflow-hidden group/panel">
      <CardHeader className="py-3 px-4 border-b border-zinc-800 flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${mode === "legacy" ? "bg-red-500" : mode === "ai" ? "bg-yellow-500" : "bg-green-500"}`} />
          <CardTitle className="text-sm font-mono uppercase tracking-widest text-zinc-400">{title}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={getBadgeColor()}>
            {mode.toUpperCase()}
          </Badge>
          {response && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger
                render={
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-zinc-300">
                    <Maximize2 className="h-3 w-3" />
                  </Button>
                }
              />
              <DialogContent className="max-w-4xl h-[80vh] bg-zinc-950 border-zinc-800 text-zinc-100 flex flex-col p-0">
                <DialogHeader className="p-6 border-b border-zinc-800 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${mode === "legacy" ? "bg-red-500" : mode === "ai" ? "bg-yellow-500" : "bg-green-500"}`} />
                      <DialogTitle className="text-xl font-bold tracking-tight">{title} Full Response</DialogTitle>
                    </div>
                    <Badge variant="outline" className={`${getBadgeColor()} text-xs`}>
                      {mode.toUpperCase()} MODE
                    </Badge>
                  </div>
                </DialogHeader>
                <ScrollArea className="flex-1 p-8">
                  <ResponseContent isFull />
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden relative">
        <ScrollArea className="h-full">
          <div className="p-4">
            {loading ? (
              <div className="flex flex-col gap-4 animate-pulse">
                <div className="h-4 bg-zinc-800 rounded w-3/4" />
                <div className="h-4 bg-zinc-800 rounded w-full" />
                <div className="h-4 bg-zinc-800 rounded w-5/6" />
                <div className="h-20 bg-zinc-800/50 rounded w-full mt-4" />
              </div>
            ) : response ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ResponseContent />
              </motion.div>
            ) : (
              <div className="h-40 flex items-center justify-center text-zinc-600 italic text-sm">
                Waiting for query...
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
