import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Card {
  category: string;
  title: string;
  summary: string;
  prompt: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { interests } = await req.json().catch(() => ({ interests: [] }));
    const list: string[] = Array.isArray(interests) ? interests.slice(0, 12) : [];
    if (list.length === 0) {
      return new Response(JSON.stringify({ cards: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You generate short discovery cards for a user's personalized feed.
Given their interest categories, return 6 diverse, current, engaging cards.
Each card must have:
- category: one of the user's interest ids (lowercase)
- title: catchy, under 70 chars
- summary: 1-2 sentences, under 200 chars, factual-sounding but generic (no fabricated stats/dates)
- prompt: a natural chat starter question the user could ask an AI to explore this topic further, under 140 chars
Return STRICT JSON: {"cards":[...]} with no markdown fences or prose.`;

    const userPrompt = `Interests: ${list.join(", ")}. Generate 6 varied cards across these interests.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("ai_error", aiRes.status, errText);
      const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500;
      return new Response(JSON.stringify({ error: "AI generation failed", status }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: { cards?: Card[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { cards: [] };
    }

    const cards = (parsed.cards ?? []).slice(0, 6).map((c) => ({
      category: String(c.category ?? list[0]).toLowerCase(),
      title: String(c.title ?? "").slice(0, 120),
      summary: String(c.summary ?? "").slice(0, 300),
      prompt: String(c.prompt ?? "").slice(0, 200),
    }));

    return new Response(JSON.stringify({ cards }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("discover_feed_error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
