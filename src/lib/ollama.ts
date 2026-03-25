let OLLAMA_BASE = "http://localhost:11434";

export function setOllamaBase(url: string) {
  OLLAMA_BASE = url.replace(/\/+$/, "");
}

export interface OllamaOptions {
  model?: string;
  onDelta?: (text: string) => void;
}

export async function streamOllama(
  prompt: string,
  { model = "llama3", onDelta }: OllamaOptions = {}
): Promise<string> {
  const resp = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: !!onDelta }),
  });

  if (!resp.ok) {
    throw new Error(`Ollama error: ${resp.status} — is Ollama running locally?`);
  }

  if (!onDelta) {
    const data = await resp.json();
    return data.response;
  }

  // Streaming mode
  const reader = resp.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    // Ollama sends newline-delimited JSON
    for (const line of chunk.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.response) {
          full += parsed.response;
          onDelta(parsed.response);
        }
      } catch {
        // partial JSON, ignore
      }
    }
  }

  return full;
}

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return resp.ok;
  } catch {
    return false;
  }
}
