export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 py-4 px-1 text-muted-foreground" role="status" aria-live="polite">
      <span className="text-primary animate-pulse">✦</span>
      <span className="text-sm text-muted-foreground animate-pulse">
        Generating…
      </span>
    </div>
  );
}
