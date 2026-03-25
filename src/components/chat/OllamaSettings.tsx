import { useState } from "react";
import { Settings, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkOllamaHealth, setOllamaBase } from "@/lib/ollama";

export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

interface OllamaSettingsProps {
  config: OllamaConfig;
  onChange: (config: OllamaConfig) => void;
}

const OLLAMA_MODELS = [
  { id: "llama3", label: "Llama 3", desc: "Meta's latest, great all-rounder" },
  { id: "llama3.1", label: "Llama 3.1", desc: "Extended context, multilingual" },
  { id: "mistral", label: "Mistral 7B", desc: "Fast and efficient" },
  { id: "codellama", label: "Code Llama", desc: "Optimized for code generation" },
  { id: "gemma2", label: "Gemma 2", desc: "Google's compact model" },
  { id: "phi3", label: "Phi-3", desc: "Microsoft's small language model" },
  { id: "deepseek-coder", label: "DeepSeek Coder", desc: "Specialized for coding" },
  { id: "qwen2", label: "Qwen 2", desc: "Alibaba's multilingual model" },
];

export function OllamaSettings({ config, onChange }: OllamaSettingsProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(config.baseUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) });
      setTestResult(resp.ok);
    } catch {
      setTestResult(false);
    }
    setTesting(false);
  };

  const handleSaveUrl = () => {
    onChange({ ...config, baseUrl: url });
    handleTest();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        title="Ollama Settings"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Ollama Settings</h3>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* URL Config */}
      <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        Server URL
      </label>
      <div className="flex gap-2 mb-3">
        <input
          value={url}
          onChange={(e) => { setUrl(e.target.value); setTestResult(null); }}
          className="flex-1 bg-secondary/60 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 font-mono"
          placeholder="http://localhost:11434"
        />
        <button
          onClick={handleSaveUrl}
          disabled={testing}
          className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-50"
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Test"}
        </button>
      </div>
      {testResult !== null && (
        <div className={cn("flex items-center gap-1.5 text-[11px] mb-3", testResult ? "text-model-green" : "text-destructive")}>
          {testResult ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          {testResult ? "Connected successfully" : "Cannot reach Ollama server"}
        </div>
      )}

      {/* Model Select */}
      <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        Model
      </label>
      <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto scrollbar-thin">
        {OLLAMA_MODELS.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange({ ...config, model: m.id })}
            className={cn(
              "text-left px-3 py-2 rounded-lg border text-xs transition-all duration-150",
              config.model === m.id
                ? "border-model-orange/50 bg-model-orange/10 text-foreground"
                : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-border/80"
            )}
          >
            <div className="font-medium">{m.label}</div>
            <div className="text-[10px] opacity-70">{m.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
