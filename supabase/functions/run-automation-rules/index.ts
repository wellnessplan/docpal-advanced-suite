// Runs the 4 customizable WhatsApp automations per clinic.
// Triggered daily by pg_cron AND on-demand from app (event="post_treatment_instant").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface WABA { token: string | null; phoneId: string | null }

async function getClinicWABA(clinicId: string): Promise<WABA> {
  const { data } = await supabase
    .from("clinic_settings")
    .select("setting_key, setting_value")
    .eq("clinic_id", clinicId)
    .in("setting_key", ["waba_token", "waba_phone_id"]);
  let token: string | null = null;
  let phoneId: string | null = null;
  for (const s of data ?? []) {
    if (s.setting_key === "waba_token") token = s.setting_value;
    if (s.setting_key === "waba_phone_id") phoneId = s.setting_value;
  }
  return { token, phoneId };
}

async function getClinicName(clinicId: string): Promise<string> {
  const { data } = await supabase.from("clinics").select("name").eq("id", clinicId).maybeSingle();
  return data?.name ?? "Your Clinic";
}

function fillTemplate(body: string, vars: Record<string, string>): string {
  let out = body;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{{${k}}}`, v ?? "");
  return out;
}

async function sendMessage(opts: {
  clinicId: string; patientId: string; phone: string;
  templateName: string; messageBody: string; waba: WABA;
}) {
  const { waba } = opts;
  if (!waba.token || !waba.phoneId) {
    await supabase.from("whatsapp_logs").insert({
      clinic_id: opts.clinicId, patient_id: opts.patientId,
      template_name: opts.templateName, phone: opts.phone,
      message_body: opts.messageBody, status: "simulated",
      error_message: "WABA credentials not configured",
    });
    return true;
  }
  try {
    const resp = await fetch(`https://graph.facebook.com/v18.0/${waba.phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${waba.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: opts.phone,
        type: "text", text: { body: opts.messageBody },
      }),
    });
    const result = await resp.json();
    await supabase.from("whatsapp_logs").insert({
      clinic_id: opts.clinicId, patient_id: opts.patientId,
      template_name: opts.templateName, phone: opts.phone,
      message_body: opts.messageBody,
      status: resp.ok ? "sent" : "failed",
      error_message: resp.ok ? null : JSON.stringify(result),
    });
    return resp.ok;
  } catch (err) {
    await supabase.from("whatsapp_logs").insert({
      clinic_id: opts.clinicId, patient_id: opts.patientId,
      template_name: opts.templateName, phone: opts.phone,
      message_body: opts.messageBody, status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

async function alreadyFired(clinicId: string, ruleKey: string, patientId: string | null, refId: string | null) {
  const { data } = await supabase
    .from("automation_trigger_log")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("rule_key", ruleKey)
    .eq("patient_id", patientId)
    .eq("reference_id", refId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function logFire(clinicId: string, ruleKey: string, patientId: string | null, refId: string | null, refType: string) {
  await supabase.from("automation_trigger_log").insert({
    clinic_id: clinicId, rule_key: ruleKey, patient_id: patientId,
    reference_id: refId, reference_type: refType,
  }).then(() => {}).catch(() => {});
}

// Compute total medicine duration days from medications jsonb
function computeRxDuration(medications: any): number {
  if (!Array.isArray(medications)) return 0;
  let max = 0;
  for (const m of medications) {
    const d = Number(m?.duration_days ?? m?.duration ?? 0);
    if (Number.isFinite(d) && d > max) max = d;
  }
  return max;
}

async function processInstantPostTreatment(clinicId: string, treatmentId: string, waba: WABA, clinicName: string) {
  const rule = await getRule(clinicId, "post_treatment_instant");
  if (!rule?.enabled) return 0;
  const { data: tt } = await supabase
    .from("tooth_treatments")
    .select("id, treatment_name, tooth_records(patient_id, clinic_id, patients(full_name, phone))")
    .eq("id", treatmentId)
    .maybeSingle();
  const rec: any = tt?.tooth_records;
  if (!rec || rec.clinic_id !== clinicId || !rec.patients?.phone) return 0;
  if (await alreadyFired(clinicId, "post_treatment_instant", rec.patient_id, treatmentId)) return 0;
  const msg = fillTemplate(rule.message_body, {
    patient_name: rec.patients.full_name ?? "",
    treatment: tt!.treatment_name ?? "",
    rx_link: rule.cta_link ?? "",
    video_url: rule.video_url ?? "",
    clinic_name: clinicName,
  });
  const ok = await sendMessage({
    clinicId, patientId: rec.patient_id, phone: rec.patients.phone,
    templateName: "post_treatment_instant", messageBody: msg, waba,
  });
  if (ok) await logFire(clinicId, "post_treatment_instant", rec.patient_id, treatmentId, "tooth_treatment");
  return ok ? 1 : 0;
}

async function getRule(clinicId: string, ruleKey: string) {
  const { data } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("rule_key", ruleKey)
    .maybeSingle();
  return data;
}

async function processTreatmentNotAccepted(clinicId: string, waba: WABA, clinicName: string) {
  const rule = await getRule(clinicId, "treatment_not_accepted");
  if (!rule?.enabled) return 0;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rule.days_offset);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Find planned treatment_plan_items older than cutoff still in 'planned' status
  const { data: items } = await supabase
    .from("treatment_plan_items")
    .select("id, procedure_name, status, created_at, treatment_plan_id, treatment_plans(clinic_id, patient_id, status, patients(full_name, phone))")
    .eq("status", "planned")
    .lt("created_at", cutoffStr + "T23:59:59");

  let sent = 0;
  for (const it of items ?? []) {
    const plan: any = (it as any).treatment_plans;
    if (!plan || plan.clinic_id !== clinicId) continue;
    if (plan.status === "accepted" || plan.status === "completed") continue;
    if (!plan.patients?.phone) continue;
    if (await alreadyFired(clinicId, "treatment_not_accepted", plan.patient_id, it.id)) continue;
    const msg = fillTemplate(rule.message_body, {
      patient_name: plan.patients.full_name ?? "",
      treatment: it.procedure_name ?? "",
      video_url: rule.video_url ?? "",
      clinic_name: clinicName,
    });
    const ok = await sendMessage({
      clinicId, patientId: plan.patient_id, phone: plan.patients.phone,
      templateName: "treatment_not_accepted", messageBody: msg, waba,
    });
    if (ok) {
      await logFire(clinicId, "treatment_not_accepted", plan.patient_id, it.id, "treatment_plan_item");
      sent++;
    }
  }
  return sent;
}

async function processDailyMedReminder(clinicId: string, waba: WABA, clinicName: string) {
  const rule = await getRule(clinicId, "daily_medicine_reminder");
  if (!rule?.enabled) return 0;

  // Get prescriptions written in the last (default_duration_days) days
  const lookback = new Date();
  lookback.setDate(lookback.getDate() - rule.default_duration_days);
  const { data: rxs } = await supabase
    .from("prescriptions")
    .select("id, patient_id, clinic_id, medications, created_at, patients(full_name, phone)")
    .eq("clinic_id", clinicId)
    .gte("created_at", lookback.toISOString());

  const today = new Date();
  let sent = 0;
  for (const rx of rxs ?? []) {
    const p: any = (rx as any).patients;
    if (!p?.phone) continue;
    const totalDays = computeRxDuration((rx as any).medications) || rule.default_duration_days;
    const start = new Date(rx.created_at);
    const day = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
    if (day < 1 || day > totalDays) continue;
    if (await alreadyFired(clinicId, "daily_medicine_reminder", rx.patient_id, rx.id)) {
      // Already fired today for this prescription — skip
      continue;
    }
    const msg = fillTemplate(rule.message_body, {
      patient_name: p.full_name ?? "",
      day: String(day), total_days: String(totalDays),
      video_url: rule.video_url ?? "",
      clinic_name: clinicName,
    });
    const ok = await sendMessage({
      clinicId, patientId: rx.patient_id, phone: p.phone,
      templateName: "daily_medicine_reminder", messageBody: msg, waba,
    });
    if (ok) {
      await logFire(clinicId, "daily_medicine_reminder", rx.patient_id, rx.id, "prescription");
      sent++;
    }
  }
  return sent;
}

async function processReviewReferral(clinicId: string, waba: WABA, clinicName: string) {
  const rule = await getRule(clinicId, "post_med_review_referral");
  if (!rule?.enabled) return 0;

  // Look at prescriptions where (rx_start + duration + days_offset) == today
  const { data: rxs } = await supabase
    .from("prescriptions")
    .select("id, patient_id, clinic_id, medications, created_at, patients(full_name, phone)")
    .eq("clinic_id", clinicId)
    .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString());

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  let sent = 0;
  for (const rx of rxs ?? []) {
    const p: any = (rx as any).patients;
    if (!p?.phone) continue;
    const totalDays = computeRxDuration((rx as any).medications) || rule.default_duration_days;
    const fireDate = new Date(rx.created_at);
    fireDate.setDate(fireDate.getDate() + totalDays + rule.days_offset);
    if (fireDate.toISOString().split("T")[0] !== todayStr) continue;
    if (await alreadyFired(clinicId, "post_med_review_referral", rx.patient_id, rx.id)) continue;
    const msg = fillTemplate(rule.message_body, {
      patient_name: p.full_name ?? "",
      review_link: rule.cta_link ?? "",
      clinic_name: clinicName,
    });
    const ok = await sendMessage({
      clinicId, patientId: rx.patient_id, phone: p.phone,
      templateName: "post_med_review_referral", messageBody: msg, waba,
    });
    if (ok) {
      await logFire(clinicId, "post_med_review_referral", rx.patient_id, rx.id, "prescription");
      sent++;
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const event = body.event as string | undefined; // optional
    const treatmentId = body.treatment_id as string | undefined;
    const clinicIdParam = body.clinic_id as string | undefined;

    // Single-event invocation (instant after treatment)
    if (event === "post_treatment_instant" && treatmentId && clinicIdParam) {
      const waba = await getClinicWABA(clinicIdParam);
      const clinicName = await getClinicName(clinicIdParam);
      const sent = await processInstantPostTreatment(clinicIdParam, treatmentId, waba, clinicName);
      return new Response(JSON.stringify({ success: true, sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Daily batch run for all clinics
    const { data: clinics } = await supabase.from("clinics").select("id");
    const results: any[] = [];
    for (const c of clinics ?? []) {
      const waba = await getClinicWABA(c.id);
      const clinicName = await getClinicName(c.id);
      const a = await processTreatmentNotAccepted(c.id, waba, clinicName);
      const b = await processDailyMedReminder(c.id, waba, clinicName);
      const r = await processReviewReferral(c.id, waba, clinicName);
      results.push({ clinic_id: c.id, treatment_not_accepted: a, daily_med: b, review: r });
    }
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("automation engine error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
