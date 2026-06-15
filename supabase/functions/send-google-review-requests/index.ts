import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function getReviewUrl(clinicId: string): Promise<string> {
  const { data } = await supabase
    .from("clinic_settings")
    .select("setting_value")
    .eq("clinic_id", clinicId)
    .eq("setting_key", "google_review_url")
    .maybeSingle();
  return (data?.setting_value as string | null)?.trim() ?? "";
}

async function getActiveTemplate(clinicId: string): Promise<string | null> {
  const { data } = await supabase
    .from("whatsapp_templates")
    .select("message_body")
    .eq("clinic_id", clinicId)
    .eq("template_type", "google_review")
    .eq("enabled", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.message_body as string | null) ?? null;
}

function fillTemplate(body: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.split(`{{${k}}}`).join(v ?? ""),
    body,
  );
}

const DEFAULT_TEMPLATE =
  "Hi {{name}}, thanks for visiting {{clinic}} today! 🌟\n\n" +
  "If we made you smile, would you take 30 seconds to leave us a Google review? " +
  "It truly helps our small practice grow.\n\n{{url}}\n\nReply STOP to opt out.";

async function queueOne(opts: {
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  phone: string;
  clinic_name: string;
  url: string;
  template: string;
}) {
  const body = fillTemplate(opts.template, {
    name: opts.patient_name || "there",
    clinic: opts.clinic_name || "our clinic",
    url: opts.url,
  });
  return await supabase.from("whatsapp_logs").insert({
    clinic_id: opts.clinic_id,
    patient_id: opts.patient_id,
    template_name: "google_review_request",
    phone: opts.phone,
    message_body: body,
    status: "queued",
    delivery_status: "queued",
    sent_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let payload: { mode?: string; patient_id?: string; clinic_id?: string } = {};
    if (req.method === "POST") {
      try { payload = await req.json(); } catch { /* empty body OK */ }
    }

    // ---------- MANUAL MODE ----------
    if (payload.mode === "manual" && payload.patient_id) {
      const { data: pt, error: ptErr } = await supabase
        .from("patients")
        .select("id, clinic_id, full_name, phone, clinics(name)")
        .eq("id", payload.patient_id)
        .maybeSingle();
      if (ptErr || !pt) throw new Error("Patient not found");
      const phone = (pt.phone ?? "").trim();
      if (!phone) throw new Error("Patient has no phone number");

      const url = await getReviewUrl(pt.clinic_id);
      if (!url) throw new Error("Google review URL not configured in Settings");

      const template = (await getActiveTemplate(pt.clinic_id)) ?? DEFAULT_TEMPLATE;
      const { error } = await queueOne({
        clinic_id: pt.clinic_id,
        patient_id: pt.id,
        patient_name: pt.full_name,
        phone,
        clinic_name: (pt as any).clinics?.name ?? "",
        url,
        template,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, queued: 1 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- CRON / BULK MODE ----------
    const now = Date.now();
    const winStart = new Date(now - 3 * 60 * 60 * 1000).toISOString();
    const winEnd = new Date(now - 2 * 60 * 60 * 1000).toISOString();

    const { data: appts, error } = await supabase
      .from("appointments")
      .select("id, clinic_id, patient_id, updated_at, patients(full_name, phone), clinics(name)")
      .eq("status", "completed")
      .gte("updated_at", winStart)
      .lte("updated_at", winEnd);
    if (error) throw error;

    const urlCache = new Map<string, string>();
    const tmplCache = new Map<string, string>();
    let queued = 0, skipped = 0;

    for (const a of (appts ?? []) as any[]) {
      const phone = (a.patients?.phone ?? "").trim();
      if (!phone || !a.patient_id) { skipped++; continue; }

      const { count } = await supabase
        .from("whatsapp_logs")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", a.clinic_id)
        .eq("patient_id", a.patient_id)
        .eq("template_name", "google_review_request")
        .gte("sent_at", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString());
      if ((count ?? 0) > 0) { skipped++; continue; }

      let url = urlCache.get(a.clinic_id);
      if (url === undefined) { url = await getReviewUrl(a.clinic_id); urlCache.set(a.clinic_id, url); }
      if (!url) { skipped++; continue; }

      let template = tmplCache.get(a.clinic_id);
      if (template === undefined) {
        template = (await getActiveTemplate(a.clinic_id)) ?? DEFAULT_TEMPLATE;
        tmplCache.set(a.clinic_id, template);
      }

      const { error: insErr } = await queueOne({
        clinic_id: a.clinic_id,
        patient_id: a.patient_id,
        patient_name: a.patients?.full_name ?? "",
        phone,
        clinic_name: a.clinics?.name ?? "",
        url,
        template,
      });
      if (insErr) { skipped++; continue; }
      queued++;
    }

    return new Response(JSON.stringify({ success: true, queued, skipped, scanned: appts?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-google-review-requests error", e);
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
