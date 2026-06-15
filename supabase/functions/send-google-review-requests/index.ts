import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface Appt {
  id: string;
  clinic_id: string;
  patient_id: string;
  completed_at: string | null;
  updated_at: string;
  patients: { full_name: string; phone: string | null } | null;
  clinics: { name: string } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const now = Date.now();
    const winStart = new Date(now - 3 * 60 * 60 * 1000).toISOString(); // 3h ago
    const winEnd = new Date(now - 2 * 60 * 60 * 1000).toISOString();   // 2h ago

    // Completed appointments in the 2h–3h window
    const { data: appts, error } = await supabase
      .from("appointments")
      .select("id, clinic_id, patient_id, updated_at, patients(full_name, phone), clinics(name)")
      .eq("status", "completed")
      .gte("updated_at", winStart)
      .lte("updated_at", winEnd);

    if (error) throw error;

    let queued = 0, skipped = 0;
    for (const a of (appts ?? []) as unknown as Appt[]) {
      const phone = a.patients?.phone?.trim();
      if (!phone || !a.patient_id) { skipped++; continue; }

      // Dedup: already sent review request for this patient in last 30 days?
      const { count } = await supabase
        .from("whatsapp_logs")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", a.clinic_id)
        .eq("patient_id", a.patient_id)
        .eq("template_name", "google_review_request")
        .gte("sent_at", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString());
      if ((count ?? 0) > 0) { skipped++; continue; }

      // Lookup clinic google review url
      const { data: setting } = await supabase
        .from("clinic_settings")
        .select("setting_value")
        .eq("clinic_id", a.clinic_id)
        .eq("setting_key", "google_review_url")
        .maybeSingle();

      const reviewUrl = (setting?.setting_value as string | null) ?? "";
      if (!reviewUrl) { skipped++; continue; }

      const name = a.patients?.full_name ?? "there";
      const clinic = a.clinics?.name ?? "our clinic";
      const body =
        `Hi ${name}, thanks for visiting ${clinic} today! 🌟\n\n` +
        `If we made you smile, would you take 30 seconds to leave us a Google review? ` +
        `It truly helps our small practice grow.\n\n${reviewUrl}\n\nReply STOP to opt out.`;

      const { error: insErr } = await supabase.from("whatsapp_logs").insert({
        clinic_id: a.clinic_id,
        patient_id: a.patient_id,
        template_name: "google_review_request",
        phone,
        message_body: body,
        status: "queued",
        delivery_status: "queued",
        sent_at: new Date().toISOString(),
      });
      if (insErr) { skipped++; continue; }
      queued++;
    }

    return new Response(JSON.stringify({ success: true, queued, skipped, scanned: appts?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-review-requests error", e);
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
