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

  try {
    // Authenticate user - REQUIRED
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = data.claims.sub as string;

    const { messages, model } = await req.json();

    // Estimate input tokens
    const inputText = messages.map((m: any) => m.content).join(" ");
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
        console.error("Quota check error:", quotaError);
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
        console.error("Usage tracking error:", usageError);
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const gatewayModel = modelMap[model] || "google/gemini-3-flash-preview";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: gatewayModel,
        messages: [
          {
            role: "system",
            content: `You are a highly intelligent, precise, and practical AI assistant.

Your responses must:
- Be clear, structured, and well-organized
- Fully answer the question (no incomplete responses)
- Avoid generic or shallow explanations
- Provide actionable insights when possible
- Use headings and bullet points when helpful

Rules:
- If the request is complex, break it into steps
- If unclear, make reasonable assumptions and proceed
- Do not produce unfinished answers
- Think through the best possible response before answering

Before finalizing:
- Check if the answer is complete and useful
- Improve clarity and structure if needed`,
          },
          ...messages,
        ],
        stream: true,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7,
      }),
    });

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
      console.error("AI gateway error:", response.status, t);
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
        console.error("Request logging error:", logErr);
      }
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
