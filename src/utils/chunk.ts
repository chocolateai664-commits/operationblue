/**
 * Text chunking utility for file summarization
 */

/** Split text into chunks of approximately `size` characters, breaking at newlines when possible */
export function chunkText(text: string, size = 2000): string[] {
  if (text.length <= size) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + size, text.length);

    // Try to break at a newline within the last 20% of the chunk
    if (end < text.length) {
      const searchStart = Math.max(start + Math.floor(size * 0.8), start);
      const lastNewline = text.lastIndexOf("\n", end);
      if (lastNewline > searchStart) {
        end = lastNewline + 1;
      }
    }

    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}
