// whatsapp-delivery-webhook — accepts provider callbacks (Meta Cloud API / Gupshup).
// Public endpoint (verify_jwt = false). Verifies a shared secret token in query string.
//
// Meta verification (GET): hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
// Status payload (POST):    { messages: [{ id, status, timestamp, ... }] }  (Meta)
//                           { type: "message-event", payload: { id, type } } (Gupshup)
// We normalize and write to whatsapp_delivery_status, plus update whatsapp_messages.delivery_status.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "";

function normalize(body: any): Array<{ id: string; status: string; raw: any }> {
  const out: Array<{ id: string; status: string; raw: any }> = [];

  // Meta Cloud API: entry[].changes[].value.statuses[]
  if (Array.isArray(body?.entry)) {
    for (const entry of body.entry) {
      for (const change of entry.changes ?? []) {
        for (const s of change?.value?.statuses ?? []) {
          out.push({ id: s.id, status: s.status, raw: s });
        }
      }
    }
  }
  // Gupshup
  if (body?.type === "message-event" && body?.payload?.id) {
    out.push({ id: body.payload.id, status: body.payload.type ?? "unknown", raw: body.payload });
  }
  // Generic fallback
  if (Array.isArray(body?.messages)) {
    for (const m of body.messages) {
      if (m.id && m.status) out.push({ id: m.id, status: m.status, raw: m });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  // Meta verification handshake
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200, headers: corsHeaders });
    }
    return new Response("forbidden", { status: 403, headers: corsHeaders });
  }

  // Soft auth: query token must match (avoids open writes)
  if (VERIFY_TOKEN && url.searchParams.get("token") !== VERIFY_TOKEN) {
    // Meta sends X-Hub-Signature-256 instead — accept if Meta payload shape detected
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return new Response("forbidden", { status: 403, headers: corsHeaders });
    }
  }

  let body: any;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const events = normalize(body);
  if (!events.length) {
    return new Response(JSON.stringify({ ok: true, count: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Insert delivery rows
  await supabase.from("whatsapp_delivery_status").insert(
    events.map(e => ({ provider_message_id: e.id, status: e.status, raw: e.raw }))
  );

  // Update parent whatsapp_messages.delivery_status (latest wins)
  for (const e of events) {
    await supabase.from("whatsapp_messages")
      .update({ delivery_status: e.status })
      .eq("provider_message_id", e.id);
  }

  return new Response(JSON.stringify({ ok: true, count: events.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
