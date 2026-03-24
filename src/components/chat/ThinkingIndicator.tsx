export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 py-4 px-4 text-muted-foreground">
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot [animation-delay:0.2s]" />
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot [animation-delay:0.4s]" />
      </div>
      <span className="text-xs">Thinking...</span>
    </div>
  );
}
