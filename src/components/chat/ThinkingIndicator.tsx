export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 py-4 px-1 text-muted-foreground" role="status" aria-live="polite">
      <span className="text-primary animate-pulse">✦</span>
      <span className="text-sm bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_1.8s_linear_infinite]">
        Generating…
      </span>
    </div>
  );
}
