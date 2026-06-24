#!/usr/bin/env node
/**
 * End-to-end smoke test for the chat edge function.
 *
 * Verifies:
 *   1. Auth is enforced (401 without a token).
 *   2. A streaming response is returned (SSE chunks arrive).
 *   3. At least one `delta.content` chunk is parsed.
 *
 * Usage:
 *   SMOKE_TEST_TOKEN=<user-jwt> node scripts/smoke-chat.mjs
 *
 *   # Against Vercel-deployed frontend (still hits the Supabase function URL):
 *   SMOKE_TEST_TOKEN=<jwt> VITE_SUPABASE_URL=https://xxx.supabase.co \
 *     node scripts/smoke-chat.mjs
 *
 * Exits 0 on success, non-zero on failure.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Tiny .env loader (avoids extra deps).
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvFile(resolve(process.cwd(), ".env"));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const TOKEN = process.env.SMOKE_TEST_TOKEN;

if (!SUPABASE_URL) {
  console.error("✗ VITE_SUPABASE_URL is required (set it in .env)");
  process.exit(2);
}
if (!TOKEN) {
  console.error("✗ SMOKE_TEST_TOKEN is required (a Supabase user access token JWT)");
  process.exit(2);
}

const CHAT_URL = `${SUPABASE_URL}/functions/v1/chat`;
const body = JSON.stringify({
  model: "flash",
  messages: [{ role: "user", content: "Reply with the single word: PONG" }],
});

async function step(name, fn) {
  process.stdout.write(`→ ${name} ... `);
  try {
    await fn();
    console.log("ok");
  } catch (e) {
    console.log("FAIL");
    console.error(`   ${e.message}`);
    process.exit(1);
  }
}

await step("rejects unauthenticated request (expects 401)", async () => {
  const r = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  await r.body?.cancel();
  if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
});

await step("streams SSE chunks with valid auth", async () => {
  const r = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status}: ${txt.slice(0, 200)}`);
  }
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream")) {
    throw new Error(`expected text/event-stream, got ${ct}`);
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let chunks = 0;
  let assistant = "";
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (json === "[DONE]") { chunks++; break; }
      try {
        const c = JSON.parse(json)?.choices?.[0]?.delta?.content;
        if (c) { assistant += c; chunks++; }
      } catch { /* partial */ }
    }
  }

  if (chunks === 0) throw new Error("no SSE delta chunks received");
  if (!assistant.trim()) throw new Error("assistant content was empty");
  console.log(`   (${chunks} chunks, ${assistant.length} chars)`);
});

console.log("✓ smoke test passed");
