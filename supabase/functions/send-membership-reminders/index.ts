// Membership renewal + maintenance reminders.
// Cron mode: scans expiring (<=14d), expired (<=30d past), and upcoming maintenance (<=7d) memberships.
// Manual mode: { membership_id } sends a single reminder immediately.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const DAY = 86_400_000;

function buildRenewalBody(m: any) {
  const name = m.patients?.full_name || "there";
  const when = m.end_date ? new Date(m.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "soon";
  const days = m.end_date ? Math.round((new Date(m.end_date).getTime() - Date.now()) / DAY) : null;
  if (days !== null && days < 0) {
    return `Hi ${name}, your ${m.plan_name} membership expired on ${when}. Renew today to keep your member benefits active.`;
  }
  return `Hi ${name}, your ${m.plan_name} membership expires on ${when}. Reply to renew and continue enjoying member benefits.`;
}

function buildMaintenanceBody(m: any) {
  const name = m.patients?.full_name || "there";
  const when = m.next_maintenance_date ? new Date(m.next_maintenance_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "soon";
  const tmpl = m.plan?.maintenance_message;
  if (tmpl && typeof tmpl === "string") {
    return tmpl.replaceAll("{{name}}", name).replaceAll("{{date}}", when).replaceAll("{{plan}}", m.plan_name || "");
  }
  return `Hi ${name}, your ${m.plan_name} maintenance visit is due on ${when}. Reply to book your appointment.`;
}

async function queueLog(m: any, body: string, template: string) {
  if (!m.patients?.phone) return false;
  const { error } = await supabase.from("whatsapp_logs").insert({
    clinic_id: m.clinic_id,
    patient_id: m.patient_id,
    template_name: template,
    phone: m.patients.phone,
    message_body: body,
    status: "queued",
    delivery_status: "queued",
    sent_at: new Date().toISOString(),
  });
  if (error) { console.error("log insert failed", error); return false; }
  await supabase.from("memberships").update({ last_reminder_sent_at: new Date().toISOString() }).eq("id", m.id);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let membershipId: string | null = null;
    if (req.method === "POST") {
      try { const body = await req.json(); membershipId = body?.membership_id ?? null; } catch { /* cron */ }
    }

    let renewals = 0, maintenance = 0;

    if (membershipId) {
      const { data: m } = await supabase
        .from("memberships")
        .select("*, patients(full_name, phone), plan:membership_plans!plan_type(maintenance_message)")
        .eq("id", membershipId)
        .maybeSingle();
      if (!m) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const ok = await queueLog(m, buildRenewalBody(m), "membership_renewal");
      return new Response(JSON.stringify({ success: ok }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const in14 = new Date(today.getTime() + 14 * DAY).toISOString().slice(0, 10);
    const past30 = new Date(today.getTime() - 30 * DAY).toISOString().slice(0, 10);
    const in7 = new Date(today.getTime() + 7 * DAY).toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);
    const throttleCutoff = new Date(today.getTime() - 7 * DAY).toISOString();

    // 1. Expiring / expired memberships (renewal nudges, throttled to once per 7 days)
    const { data: expiring } = await supabase
      .from("memberships")
      .select("*, patients(full_name, phone)")
      .eq("status", "active")
      .gte("end_date", past30)
      .lte("end_date", in14);

    for (const m of expiring ?? []) {
      if (m.last_reminder_sent_at && m.last_reminder_sent_at > throttleCutoff) continue;
      if (await queueLog(m, buildRenewalBody(m), "membership_renewal")) renewals++;
    }

    // 2. Upcoming maintenance visits
    const { data: maint } = await supabase
      .from("memberships")
      .select("*, patients(full_name, phone), plan:membership_plans!plan_type(maintenance_message)")
      .eq("status", "active")
      .gte("next_maintenance_date", todayStr)
      .lte("next_maintenance_date", in7);

    for (const m of maint ?? []) {
      if (m.last_reminder_sent_at && m.last_reminder_sent_at > throttleCutoff) continue;
      if (await queueLog(m, buildMaintenanceBody(m), "membership_maintenance")) maintenance++;
    }

    return new Response(JSON.stringify({ success: true, renewals, maintenance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
