import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Send, FileText, Loader2, X } from "lucide-react";
import axios from "axios";

interface ChatInterfaceProps {
  onResults: (results: any) => void;
  onLoading: (loading: boolean) => void;
}

export default function ChatInterface({ onResults, onLoading }: ChatInterfaceProps) {
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("/api/ingest", formData);
      setFiles(prev => [...prev, { id: res.data.docId, name: res.data.name }]);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    onLoading(true);
    setError(null);
    
    try {
      const res = await axios.post("/api/chat", { query: query.trim() });
      onResults(res.data);
      setQuery("");
    } catch (error) {
      console.error("Chat error:", error);
      setError("Unable to process your query right now. Check server logs and API keys.");
    } finally {
      onLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map(f => (
            <div key={f.id} className="bg-zinc-800/50 text-zinc-400 px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1.5 border border-zinc-800">
              <FileText className="w-3 h-3" />
              {f.name}
              <button onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Card className="bg-zinc-900/80 border-zinc-800 p-1.5 shadow-2xl backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
            accept=".pdf,.docx,.txt,.md"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about uploaded PDFs or general API questions..."
            className="bg-transparent border-none focus-visible:ring-0 text-zinc-200 placeholder:text-zinc-600 h-9 text-sm"
          />
          <Button 
            type="submit" 
            size="icon"
            className="h-9 w-9 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </Card>

      {error && (
        <p className="text-xs text-red-400 px-2">{error}</p>
      )}
    </div>
  );
}
