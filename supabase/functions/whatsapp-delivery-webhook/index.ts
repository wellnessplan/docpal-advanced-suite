// whatsapp-delivery-webhook
//
// Accepts provider callbacks (Meta Cloud API / Gupshup), verifies the
// signature, deduplicates by (provider_message_id, status), and updates
// whatsapp_logs.delivery_status.
//
// Security:
//   • Meta GET handshake checks WHATSAPP_WEBHOOK_VERIFY_TOKEN.
//   • POST bodies are HMAC-SHA256 verified against WHATSAPP_APP_SECRET when
//     a x-hub-signature-256 header is present (Meta).
//   • Generic providers fall back to a shared `?token=` query string.
//   • Idempotency is enforced by a UNIQUE INDEX on
//     whatsapp_delivery_status(provider_message_id, status); duplicates are
//     ignored via ON CONFLICT.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-hub-signature-256",
};

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "";
const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";

async function hmacHex(secret: string, data: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function normalize(body: any): {
  statuses: Array<{ id: string; status: string; raw: any }>;
  replies: Array<{ from: string; raw: any }>;
} {
  const statuses: Array<{ id: string; status: string; raw: any }> = [];
  const replies: Array<{ from: string; raw: any }> = [];

  // Meta Cloud API shape
  if (Array.isArray(body?.entry)) {
    for (const entry of body.entry) {
      for (const change of entry.changes ?? []) {
        const v = change?.value ?? {};
        for (const s of v.statuses ?? []) {
          if (s.id && s.status) statuses.push({ id: s.id, status: s.status, raw: s });
        }
        for (const m of v.messages ?? []) {
          // Inbound message from a patient (reply)
          if (m?.from) replies.push({ from: String(m.from), raw: m });
        }
      }
    }
  }
  // Gupshup / generic shapes
  if (body?.type === "message-event" && body?.payload?.id) {
    statuses.push({ id: body.payload.id, status: body.payload.type ?? "unknown", raw: body.payload });
  }
  if (body?.type === "message" && body?.payload?.source) {
    replies.push({ from: String(body.payload.source), raw: body.payload });
  }
  if (Array.isArray(body?.messages)) {
    for (const m of body.messages) {
      if (m.id && m.status) statuses.push({ id: m.id, status: m.status, raw: m });
      else if (m.from && !m.status) replies.push({ from: String(m.from), raw: m });
    }
  }
  return { statuses, replies };
}

function normalizePhone(p: string): string {
  // Keep digits only — match against last 10–15 digits stored in whatsapp_logs.phone
  return (p ?? "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  // Meta verification handshake
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && VERIFY_TOKEN && timingSafeEqual(token, VERIFY_TOKEN)) {
      return new Response(challenge ?? "", { status: 200, headers: corsHeaders });
    }
    return new Response("forbidden", { status: 403, headers: corsHeaders });
  }

  // Read raw bytes once — needed for both signature verification and JSON parsing
  const rawBytes = new Uint8Array(await req.arrayBuffer());
  const sigHeader = req.headers.get("x-hub-signature-256");

  let authed = false;

  // Path A: Meta — verify HMAC signature against APP_SECRET
  if (sigHeader && APP_SECRET) {
    const expected = "sha256=" + (await hmacHex(APP_SECRET, rawBytes));
    if (!timingSafeEqual(sigHeader, expected)) {
      return new Response("invalid signature", { status: 401, headers: corsHeaders });
    }
    authed = true;
  }

  // Path B: Generic provider — fall back to shared query token
  if (!authed && VERIFY_TOKEN) {
    const t = url.searchParams.get("token");
    if (t && timingSafeEqual(t, VERIFY_TOKEN)) authed = true;
  }

  if (!authed) {
    return new Response("forbidden", { status: 403, headers: corsHeaders });
  }

  let body: any;
  try {
    body = JSON.parse(new TextDecoder().decode(rawBytes));
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { statuses, replies } = normalize(body);
  if (!statuses.length && !replies.length) {
    return new Response(JSON.stringify({ ok: true, count: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Status events ─────────────────────────────────────────────────────
  if (statuses.length) {
    const { error: insertErr } = await supabase
      .from("whatsapp_delivery_status")
      .upsert(
        statuses.map((e) => ({ provider_message_id: e.id, status: e.status, raw: e.raw })),
        { onConflict: "provider_message_id,status", ignoreDuplicates: true },
      );
    if (insertErr) console.error("dlv insert", insertErr);

    const latest = new Map<string, string>();
    for (const e of statuses) latest.set(e.id, e.status);
    for (const [id, status] of latest) {
      await supabase.from("whatsapp_logs")
        .update({ delivery_status: status })
        .eq("provider_message_id", id);
    }
  }

  // ── Inbound replies → mark the most recent outbound msg as 'replied' ──
  let repliedMatched = 0;
  if (replies.length) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const seen = new Set<string>();
    for (const r of replies) {
      const digits = normalizePhone(r.from);
      if (!digits || seen.has(digits)) continue;
      seen.add(digits);

      // Match by trailing 10 digits to be tolerant of country-code variants
      const tail = digits.slice(-10);
      const { data: rows } = await supabase
        .from("whatsapp_logs")
        .select("id, phone")
        .gte("sent_at", since)
        .like("phone", `%${tail}`)
        .order("sent_at", { ascending: false })
        .limit(1);
      const target = rows?.[0];
      if (target) {
        await supabase.from("whatsapp_logs")
          .update({ delivery_status: "replied" })
          .eq("id", target.id);
        repliedMatched++;
      }
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    statuses: statuses.length,
    replies: replies.length,
    replied_matched: repliedMatched,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
