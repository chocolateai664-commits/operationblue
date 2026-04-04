import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
      title="Copy code"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const codeString = String(children).replace(/\n$/, "");

          if (match) {
            return (
              <div className="relative group my-2 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/80 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {match[1]}
                </div>
                <CopyButton code={codeString} />
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: "0.8rem",
                    background: "hsl(228 14% 10%)",
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          }

          return (
            <code className="bg-secondary/60 px-1.5 py-0.5 rounded text-[0.85em] font-mono" {...props}>
              {children}
            </code>
          );
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>;
        },
        h1({ children }) {
          return <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>;
        },
        h2({ children }) {
          return <h3 className="text-base font-bold mb-2 mt-3">{children}</h3>;
        },
        h3({ children }) {
          return <h4 className="text-sm font-bold mb-1 mt-2">{children}</h4>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">
              {children}
            </blockquote>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-xs border border-border rounded">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return <th className="px-3 py-1.5 bg-secondary/60 text-left font-semibold border-b border-border">{children}</th>;
        },
        td({ children }) {
          return <td className="px-3 py-1.5 border-b border-border/50">{children}</td>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
