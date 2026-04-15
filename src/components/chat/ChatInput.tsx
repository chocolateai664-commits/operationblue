import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Plus, X, Search, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
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
  if (text.length < 2000) return text;
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

async function processFile(file: File): Promise<AttachedFile | null> {
  if (file.size > MAX_FILE_SIZE) return null;
  if (TEXT_EXTENSIONS.test(file.name)) {
    const text = await file.text();
    const content = await summarizeContent(text);
    return { name: file.name, content };
  }
  return {
    name: file.name,
    content: `[Binary file: ${file.name} (${(file.size / 1024).toFixed(1)}KB)]`,
  };
}

function collectEntriesRecursively(entry: FileSystemEntry): Promise<File[]> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file((f) => resolve([f]));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      reader.readEntries(async (entries) => {
        const nested = await Promise.all(entries.map((e) => collectEntriesRecursively(e)));
        resolve(nested.flat());
      });
    } else {
      resolve([]);
    }
  });
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [summarizing, setSummarizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [value]);

  const addFiles = useCallback(async (files: File[]) => {
    setSummarizing(true);
    try {
      let totalSize = 0;
      const newFiles: AttachedFile[] = [];
      for (const file of files.slice(0, MAX_FILES)) {
        const processed = await processFile(file);
        if (!processed) continue;
        totalSize += processed.content.length;
        if (totalSize > MAX_TOTAL_SIZE) break;
        newFiles.push(processed);
      }
      setAttachedFiles((prev) => {
        const combined = [...prev, ...newFiles];
        return combined.slice(0, MAX_FILES);
      });
    } finally {
      setSummarizing(false);
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) await addFiles(files);
    e.target.value = "";
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);

      const items = e.dataTransfer.items;
      const allFiles: File[] = [];

      if (items) {
        const entries = Array.from(items)
          .map((item) => item.webkitGetAsEntry())
          .filter(Boolean) as FileSystemEntry[];

        const nested = await Promise.all(entries.map((entry) => collectEntriesRecursively(entry)));
        allFiles.push(...nested.flat());
      } else {
        allFiles.push(...Array.from(e.dataTransfer.files));
      }

      if (allFiles.length > 0) await addFiles(allFiles);
    },
    [addFiles]
  );

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatMessage = (msg: string): string => {
    if (attachedFiles.length > 0) {
      const blocks = attachedFiles.map((f) => `File: ${f.name}\n${f.content}`).join("\n\n---\n\n");
      return `[${attachedFiles.length} file(s) attached]\n\n${blocks}\n\n---\n${msg}`;
    }
    return msg;
  };

  const handleSubmit = () => {
    if ((!value.trim() && attachedFiles.length === 0) || disabled || summarizing) return;
    onSend(formatMessage(value.trim()));
    setValue("");
    setAttachedFiles([]);
    setFilterQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = disabled || summarizing;
  const filteredFiles = filterQuery
    ? attachedFiles.filter((f) => f.name.toLowerCase().includes(filterQuery.toLowerCase()))
    : attachedFiles;
  const showSearch = attachedFiles.length >= 5;
  const visibleFiles = expanded ? filteredFiles : filteredFiles.slice(0, 3);
  const hasMore = filteredFiles.length > 3;

  return (
    <div
      className="space-y-2 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm pointer-events-none">
          <p className="text-sm font-medium text-primary">Drop files or folders here</p>
        </div>
      )}

      {/* Summarizing indicator */}
      {summarizing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing files...
        </div>
      )}

      {/* File list with search */}
      {attachedFiles.length > 0 && (
        <div className="space-y-1.5">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter files..."
                className="w-full bg-secondary/60 border border-border rounded-lg pl-7 pr-3 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleFiles.map((file, i) => {
              const realIndex = attachedFiles.indexOf(file);
              return (
                <Badge key={realIndex} variant="secondary" className="flex items-center gap-1 text-xs max-w-[200px]">
                  <span className="truncate">📄 {file.name}</span>
                  <button onClick={() => removeFile(realIndex)} className="ml-0.5 hover:text-foreground flex-shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
            {hasMore && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <>
                    Show less <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    +{filteredFiles.length - 3} more <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="relative flex items-end gap-2 bg-secondary/60 border border-border rounded-2xl px-3 py-3 backdrop-blur-sm">
        {/* Upload button */}
        <div className="flex items-center flex-shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            title="Attach files or folder"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          onChange={handleFileUpload}
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
          disabled={isDisabled || (!value.trim() && attachedFiles.length === 0)}
          className={cn(
            "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
            (value.trim() || attachedFiles.length > 0) && !isDisabled
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
