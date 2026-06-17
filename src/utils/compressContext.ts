/**
 * Context compression — clean, dedupe, and intelligently truncate user-provided
 * text before sending it to the AI. Used for attached files, resumes, JDs, etc.
 */

export const CONTEXT_LIMITS = {
  resume: 2000,
  jd: 1500,
  portfolio: 1500,
  doc: 1000,
  default: 1500,
} as const;

export type ContextKind = keyof typeof CONTEXT_LIMITS;

/** Clean whitespace and remove duplicate lines without reordering. */
function normalize(text: string): string {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const seen = new Set<string>();
  return cleaned
    .split("\n")
    .filter((line) => {
      const key = line.trim();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
}

/**
 * Compress and truncate text to a per-kind char limit.
 * When over budget, keeps the head + tail with an elision marker so both
 * "intro" and "recent" context survive — better than a blind .slice().
 */
export function compressContext(text: string, kind: ContextKind = "default"): string {
  if (!text) return "";
  const limit = CONTEXT_LIMITS[kind];
  const normalized = normalize(text);
  if (normalized.length <= limit) return normalized;

  const head = Math.floor(limit * 0.7);
  const tail = Math.max(0, limit - head - 16);
  return `${normalized.slice(0, head)}\n…[truncated]…\n${normalized.slice(-tail)}`;
}

/** Compress an array of file contents, applying the `doc` limit to each. */
export function compressFiles(files: { name: string; content: string }[]): { name: string; content: string }[] {
  return files.map((f) => ({ name: f.name, content: compressContext(f.content, "doc") }));
}
