import { useState, useRef, useEffect } from "react";
import { Send, Plus, X, FolderOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { chunkText } from "@/utils/chunk";
import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_SIZE = 500_000;
const MAX_CONTENT_LENGTH = 10_000;
const MAX_FILES = 20;
const MAX_TOTAL_SIZE = 1_000_000;
const TEXT_EXTENSIONS = /\.(txt|json|csv|xml|md|js|ts|jsx|tsx)$/i;
const ACCEPTED_FILE_TYPES = ".txt,.json,.csv,.xml,.md,.js,.ts,.jsx,.tsx,.doc,.docx,.pdf,.zip";

interface AttachedFile {
  name: string;
  content: string;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

async function summarizeContent(text: string): Promise<string> {
  if (text.length < 2000) return text; // Short enough, no need to summarize

  const chunks = chunkText(text, 2000);
  try {
    const { data, error } = await supabase.functions.invoke("summarize", {
      body: { chunks },
    });
    if (error) throw error;
    return data?.summary || text.slice(0, MAX_CONTENT_LENGTH);
  } catch (e) {
    console.error("Summarization failed, using truncated content:", e);
    return text.slice(0, MAX_CONTENT_LENGTH);
  }
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [summarizing, setSummarizing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [value]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert("File too large (max 500KB)");
      return;
    }

    if (TEXT_EXTENSIONS.test(file.name)) {
      const text = await file.text();
      setSummarizing(true);
      try {
        const content = await summarizeContent(text);
        setAttachedFile({ name: file.name, content });
        setAttachedFiles([]);
      } finally {
        setSummarizing(false);
      }
    } else {
      setAttachedFile({ name: file.name, content: `[Binary file: ${file.name} (${(file.size / 1024).toFixed(1)}KB)]` });
      setAttachedFiles([]);
    }

    e.target.value = "";
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    let totalSize = 0;
    const processed: AttachedFile[] = [];

    setSummarizing(true);
    try {
      for (const file of files.slice(0, MAX_FILES)) {
        if (!TEXT_EXTENSIONS.test(file.name)) continue;
        if (file.size > 200_000) continue;

        const text = await file.text();
        const content = await summarizeContent(text);
        totalSize += content.length;
        if (totalSize > MAX_TOTAL_SIZE) break;

        processed.push({
          name: (file as any).webkitRelativePath || file.name,
          content,
        });
      }
    } finally {
      setSummarizing(false);
    }

    setAttachedFiles(processed);
    setAttachedFile(null);
    e.target.value = "";
  };

  const formatMessage = (msg: string): string => {
    if (attachedFile) {
      return `[Attached: ${attachedFile.name}]\n${attachedFile.content}\n---\n${msg}`;
    }
    if (attachedFiles.length > 0) {
      const blocks = attachedFiles.map((f) => `File: ${f.name}\n${f.content}`).join("\n\n---\n\n");
      return `[Folder Attachment]\n\n${blocks}\n\n---\n${msg}`;
    }
    return msg;
  };

  const handleSubmit = () => {
    if ((!value.trim() && !attachedFile && attachedFiles.length === 0) || disabled || summarizing) return;
    onSend(formatMessage(value.trim()));
    setValue("");
    setAttachedFile(null);
    setAttachedFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = disabled || summarizing;

  return (
    <div className="space-y-2">
      {/* Summarizing indicator */}
      {summarizing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Summarizing file content...
        </div>
      )}

      {/* Attachment chips */}
      {attachedFile && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1.5 text-xs">
            📄 {attachedFile.name}
            <button onClick={() => setAttachedFile(null)} className="ml-1 hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        </div>
      )}
      {attachedFiles.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1.5 text-xs">
            📁 {attachedFiles.length} files attached
            <button onClick={() => setAttachedFiles([])} className="ml-1 hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        </div>
      )}

      {/* Input row */}
      <div className="relative flex items-end gap-2 bg-secondary/60 border border-border rounded-2xl px-3 py-3 backdrop-blur-sm">
        {/* Upload buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            title="Attach file"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={isDisabled}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            title="Attach folder"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileUpload}
        />
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          // @ts-ignore
          webkitdirectory="true"
          multiple
          onChange={handleFolderUpload}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          disabled={isDisabled}
          rows={1}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-40 scrollbar-thin"
        />
        <button
          onClick={handleSubmit}
          disabled={isDisabled || (!value.trim() && !attachedFile && attachedFiles.length === 0)}
          className={cn(
            "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
            (value.trim() || attachedFile || attachedFiles.length > 0) && !isDisabled
              ? "bg-primary text-primary-foreground hover:bg-primary/80"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
