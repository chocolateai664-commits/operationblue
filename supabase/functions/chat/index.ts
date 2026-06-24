import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_INPUT_TOKENS = 8000;
const MAX_OUTPUT_TOKENS = 1500;

const modelMap: Record<string, string> = {
  flash: "google/gemini-3-flash-preview",
  gemini: "google/gemini-2.5-pro",
  "gpt-5": "openai/gpt-5",
};

// Cost per 1M tokens
const PRICING: Record<string, { input: number; output: number }> = {
  flash:   { input: 0.15,  output: 0.60 },
  gemini:  { input: 1.25,  output: 10.00 },
  "gpt-5": { input: 2.00,  output: 8.00 },
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? PRICING.flash;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const reqId = crypto.randomUUID();
  const slog = (level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) => {
    try {
      console[level === "info" ? "log" : level](
        JSON.stringify({ ts: new Date().toISOString(), reqId, fn: "chat", level, event, ...fields })
      );
    } catch { /* ignore */ }
  };

  try {
    // Validate required env (clear failure on Vercel/local misconfig)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseKey) {
      slog("error", "missing_env", { hasUrl: !!supabaseUrl, hasAnon: !!supabaseKey });
      return new Response(JSON.stringify({ error: "Server misconfigured: SUPABASE_URL/SUPABASE_ANON_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate user - REQUIRED
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      slog("warn", "auth_missing_header");
      return new Response(JSON.stringify({ error: "Unauthorized: missing Bearer token. Sign in and retry." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token.split(".").length !== 3) {
      slog("warn", "auth_malformed_token", { len: token.length });
      return new Response(JSON.stringify({ error: "Unauthorized: malformed access token. Re-authenticate." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      slog("warn", "auth_invalid_claims", { err: claimsError?.message });
      return new Response(JSON.stringify({ error: "Unauthorized: invalid or expired session. Sign in again." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = data.claims.sub as string;

    const { messages, model, system } = await req.json();

    // Estimate input tokens (include system prompt)
    const inputText = (system ? system + " " : "") + messages.map((m: any) => m.content).join(" ");
    const inputTokens = estimateTokens(inputText);

    if (inputTokens > MAX_INPUT_TOKENS) {
      return new Response(JSON.stringify({ error: `Input too long (${inputTokens} tokens, max ${MAX_INPUT_TOKENS}). Please shorten your message or summarize attached files.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Estimate cost and check limits via RPC
    const estimatedCost = calculateCost(model || "flash", inputTokens, MAX_OUTPUT_TOKENS);

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Rolling 5h / 24h quota check (free users only; pro/admin pass through)
    // FAIL CLOSED: any quota validation failure must reject the request.
    {
      const { error: quotaError } = await userClient.rpc("check_rolling_quota");
      if (quotaError) {
        const msg = quotaError.message || "";
        const match = msg.match(/QUOTA_EXCEEDED:(5h|24h):(\d+)/);
        if (match) {
          const window = match[1];
          const retrySeconds = parseInt(match[2], 10);
          const retryHours = Math.max(1, Math.ceil(retrySeconds / 3600));
          return new Response(JSON.stringify({
            error: "QUOTA_EXCEEDED",
            window,
            retry_after_seconds: retrySeconds,
            retry_after: `${retryHours} hour${retryHours === 1 ? "" : "s"}`,
            message: `Limit reached (${window === "5h" ? "10 messages / 5 hours" : "30 messages / 24 hours"}). Try again after cooldown or upgrade to Pro.`,
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retrySeconds) },
          });
        }
        if (/QUOTA_UNAUTHENTICATED/i.test(msg)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Unknown error from quota RPC → fail closed.
        slog("error", "quota_rpc_failed", { userId, code: quotaError.code, message: quotaError.message });
        return new Response(JSON.stringify({
          error: "QUOTA_CHECK_FAILED",
          message: "Could not verify usage quota. Please try again shortly.",
        }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    {
      const { error: usageError } = await userClient.rpc("increment_usage", {
        _input_tokens: inputTokens,
        _cost: estimatedCost,
      });

      if (usageError) {
        if (usageError.message?.includes("cost limit exceeded")) {
          return new Response(JSON.stringify({ error: "Monthly usage limit reached. Upgrade to Pro for higher limits." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // FAIL CLOSED on unexpected usage-tracking errors.
        slog("error", "usage_rpc_failed", { userId, code: usageError.code, message: usageError.message, inputTokens, estimatedCost });
        return new Response(JSON.stringify({
          error: "USAGE_TRACKING_FAILED",
          message: "Could not record usage. Please try again shortly.",
        }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    const systemPrompt =
      system && typeof system === "string" && system.trim().length > 0
        ? system
        : `You are a precise, implementation-focused AI assistant.
- Keep replies under 300 words by default.
- Keep code under 50 lines and show only the relevant snippet.
- Prefer bullet points; avoid repeating prior explanations.
- Do not generate full applications unless explicitly requested.
- Preserve markdown formatting.`;

    // Provider resolution: prefer Lovable Gateway when configured.
    // Fallbacks: OpenAI direct for gpt-* models, Gemini direct for flash/gemini.
    type Provider = "lovable" | "openai" | "gemini";
    let provider: Provider;
    if (LOVABLE_API_KEY) {
      provider = "lovable";
    } else if (model === "gpt-5" && OPENAI_API_KEY) {
      provider = "openai";
    } else if ((model === "flash" || model === "gemini") && GEMINI_API_KEY) {
      provider = "gemini";
    } else if (OPENAI_API_KEY) {
      provider = "openai";
    } else if (GEMINI_API_KEY) {
      provider = "gemini";
    } else {
      throw new Error("No AI provider configured. Set LOVABLE_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.");
    }

    let response: Response;
    if (provider === "lovable") {
      const gatewayModel = modelMap[model] || "google/gemini-3-flash-preview";
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: gatewayModel,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
          max_completion_tokens: MAX_OUTPUT_TOKENS,
        }),
      });
    } else if (provider === "openai") {
      const openaiModel = model === "gpt-5" ? "gpt-4o" : "gpt-4o-mini";
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: openaiModel,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
      });
    } else {
      // Gemini direct → translate SSE chunks into OpenAI-compatible shape.
      const geminiModel = model === "gemini" ? "gemini-2.5-pro" : "gemini-2.0-flash";
      const contents = messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
          }),
        }
      );

      if (!geminiResp.ok || !geminiResp.body) {
        const t = await geminiResp.text().catch(() => "");
        console.error("Gemini error:", geminiResp.status, t);
        return new Response(JSON.stringify({ error: `Gemini error (${geminiResp.status})` }), {
          status: geminiResp.status === 429 ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Re-emit as OpenAI-style SSE so src/lib/stream-chat.ts parses it unchanged.
      const reader = geminiResp.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buf = "";
      const stream = new ReadableStream({
        async pull(controller) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            try {
              const parsed = JSON.parse(json);
              const text = parsed?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
              if (text) {
                const chunk = { choices: [{ delta: { content: text } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              }
            } catch { /* ignore partial */ }
          }
        },
      });

      response = new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Add funds at Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      slog("error", "ai_gateway_error", { provider, status: response.status, body: t.slice(0, 500) });
      return new Response(JSON.stringify({ error: `AI gateway error (${response.status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log request (fire and forget)
    {
      try {
        const userClient = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } },
        });
        await userClient.rpc("log_request", {
          _model: model || "flash",
          _input_tokens: inputTokens,
          _output_tokens: MAX_OUTPUT_TOKENS, // estimated; actual may differ
          _cost: estimatedCost,
        });
      } catch (logErr) {
        slog("error", "log_request_failed", { message: (logErr as Error)?.message });
      }
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    slog("error", "unhandled", { message: (e as Error)?.message, stack: (e as Error)?.stack?.slice(0, 800) });
    return new Response(JSON.stringify({ error: "Internal server error", reqId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
