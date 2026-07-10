import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// Public endpoint (Stripe calls it). No CORS needed for browsers, but we
// return JSON responses that Stripe can log.

const STATUS_BY_EVENT: Record<string, string> = {
  "checkout.session.completed": "paid",
  "payment_intent.succeeded": "paid",
  "payment_intent.payment_failed": "failed",
  "checkout.session.expired": "expired",
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  if (!sig || !webhookSecret) {
    console.error("stripe-webhook: missing signature or secret");
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("stripe-webhook: signature verification failed", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // Idempotency: skip if we've already processed this event id
  const { data: existing } = await admin
    .from("stripe_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const obj = event.data.object as Record<string, any>;
    const orderId: string | undefined =
      obj?.metadata?.order_id ?? undefined;

    let dbOrderId: string | null = null;

    if (orderId) {
      const status = STATUS_BY_EVENT[event.type];
      const update: Record<string, unknown> = {};
      if (status) update.status = status;

      if (event.type.startsWith("checkout.session")) {
        update.stripe_session_id = obj.id;
        if (obj.payment_intent) update.stripe_payment_intent_id = obj.payment_intent;
        if (obj.amount_total != null) update.amount_total = obj.amount_total;
        if (obj.currency) update.currency = obj.currency;
        if (obj.customer_details?.email) update.customer_email = obj.customer_details.email;
      }
      if (event.type.startsWith("payment_intent")) {
        update.stripe_payment_intent_id = obj.id;
        if (obj.amount != null) update.amount_total = obj.amount;
        if (obj.currency) update.currency = obj.currency;
      }

      if (Object.keys(update).length > 0) {
        const { data: updated, error: updateErr } = await admin
          .from("orders")
          .update(update)
          .eq("id", orderId)
          .select("id")
          .maybeSingle();
        if (updateErr) console.error("stripe-webhook: order update failed", updateErr);
        dbOrderId = updated?.id ?? null;
      }
    }

    await admin.from("stripe_events").insert({
      stripe_event_id: event.id,
      type: event.type,
      order_id: dbOrderId,
      payload: event as unknown as Record<string, unknown>,
    });

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook: handler error", err);
    return new Response(JSON.stringify({ error: "Handler error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
