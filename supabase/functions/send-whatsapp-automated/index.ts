import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { recordFailure } from "../_shared/dlq.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface WABACredentials {
  token: string | null;
  phoneId: string | null;
}

interface MessagePayload {
  clinicId: string;
  patientId: string;
  phone: string;
  templateName: string;
  messageBody: string;
  waba: WABACredentials;
}

async function sendWhatsAppMessage(payload: MessagePayload): Promise<{ success: boolean; error?: string }> {
  const { token: WABA_TOKEN, phoneId: WABA_PHONE_ID } = payload.waba;
  if (!WABA_TOKEN || !WABA_PHONE_ID) {
    // Log as "simulated" when no WABA credentials configured
    await supabase.from("whatsapp_logs").insert({
      clinic_id: payload.clinicId,
      patient_id: payload.patientId,
      template_name: payload.templateName,
      phone: payload.phone,
      message_body: payload.messageBody,
      status: "simulated",
      error_message: "WABA credentials not configured",
    });
    return { success: true };
  }

  try {
    const resp = await fetch(`https://graph.facebook.com/v18.0/${WABA_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WABA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: payload.phone,
        type: "text",
        text: { body: payload.messageBody },
      }),
    });

    const result = await resp.json();
    const status = resp.ok ? "sent" : "failed";
    const errorMsg = resp.ok ? null : JSON.stringify(result);

    await supabase.from("whatsapp_logs").insert({
      clinic_id: payload.clinicId,
      patient_id: payload.patientId,
      template_name: payload.templateName,
      phone: payload.phone,
      message_body: payload.messageBody,
      status,
      error_message: errorMsg,
    });

    return { success: resp.ok, error: errorMsg ?? undefined };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    await supabase.from("whatsapp_logs").insert({
      clinic_id: payload.clinicId,
      patient_id: payload.patientId,
      template_name: payload.templateName,
      phone: payload.phone,
      message_body: payload.messageBody,
      status: "failed",
      error_message: errorMsg,
    });
    return { success: false, error: errorMsg };
  }
}

function replacePlaceholders(body: string, vars: Record<string, string>): string {
  let result = body;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, val);
  }
  return result;
}

async function getClinicWABA(clinicId: string): Promise<WABACredentials> {
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

async function processClinic(clinicId: string) {
  const waba = await getClinicWABA(clinicId);

  const { data: templates } = await supabase
    .from("whatsapp_templates")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("enabled", true);

  if (!templates?.length) return { clinicId, sent: 0 };

  const templateMap = new Map(templates.map(t => [t.template_name, t]));
  let sent = 0;

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // 1. 24h Appointment Reminder
  const apptTemplate = templateMap.get("appt_reminder_24h");
  if (apptTemplate) {
    const { data: appts } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_date, appointment_time, patients(full_name, phone)")
      .eq("clinic_id", clinicId)
      .eq("appointment_date", tomorrowStr)
      .eq("status", "scheduled");

    for (const appt of appts ?? []) {
      const patient = appt.patients as any;
      if (!patient?.phone) continue;
      const msg = replacePlaceholders(apptTemplate.message_body, {
        patient_name: patient.full_name,
        date: appt.appointment_date,
        time: appt.appointment_time,
      });
      await sendWhatsAppMessage({ clinicId, patientId: appt.patient_id, phone: patient.phone, templateName: "appt_reminder_24h", messageBody: msg, waba });
      sent++;
    }
  }

  // 2. Post-treatment follow-up (3 days after RCT/extraction/implant)
  const followupTemplate = templateMap.get("post_treatment_followup");
  if (followupTemplate) {
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split("T")[0];

    const { data: treatments } = await supabase
      .from("tooth_treatments")
      .select("id, tooth_record_id, treatment_name, performed_at, tooth_records(patient_id, clinic_id, patients(full_name, phone))")
      .in("treatment_name", ["RCT", "Root Canal", "Extraction", "Implant", "Dental Implant"])
      .eq("status", "completed")
      .gte("performed_at", threeDaysAgoStr + "T00:00:00")
      .lt("performed_at", threeDaysAgoStr + "T23:59:59");

    for (const t of treatments ?? []) {
      const rec = t.tooth_records as any;
      if (rec?.clinic_id !== clinicId || !rec?.patients?.phone) continue;
      const msg = replacePlaceholders(followupTemplate.message_body, {
        patient_name: rec.patients.full_name,
        treatment: t.treatment_name,
      });
      await sendWhatsAppMessage({ clinicId, patientId: rec.patient_id, phone: rec.patients.phone, templateName: "post_treatment_followup", messageBody: msg, waba });
      sent++;
    }
  }

  // 3. 6-month recall
  const recallTemplate = templateMap.get("recall_6month");
  if (recallTemplate) {
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
    const cutoff = sixMonthsAgo.toISOString().split("T")[0];

    const { data: patients } = await supabase
      .from("patients")
      .select("id, full_name, phone, updated_at")
      .eq("clinic_id", clinicId)
      .not("phone", "is", null)
      .lt("updated_at", cutoff + "T23:59:59");

    for (const p of patients ?? []) {
      // Check no future appointment
      const { count } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", p.id)
        .gte("appointment_date", today);

      if ((count ?? 0) > 0) continue;

      const msg = replacePlaceholders(recallTemplate.message_body, { patient_name: p.full_name });
      await sendWhatsAppMessage({ clinicId, patientId: p.id, phone: p.phone!, templateName: "recall_6month", messageBody: msg, waba });
      sent++;
    }
  }

  // 4. 3-month brush change reminder (scaling 90 days ago)
  const brushTemplate = templateMap.get("brush_change_reminder");
  if (brushTemplate) {
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyStr = ninetyDaysAgo.toISOString().split("T")[0];

    const { data: scalings } = await supabase
      .from("tooth_treatments")
      .select("id, tooth_record_id, performed_at, tooth_records(patient_id, clinic_id, patients(full_name, phone))")
      .in("treatment_name", ["Scaling", "Cleaning", "Prophylaxis"])
      .eq("status", "completed")
      .gte("performed_at", ninetyStr + "T00:00:00")
      .lt("performed_at", ninetyStr + "T23:59:59");

    for (const s of scalings ?? []) {
      const rec = s.tooth_records as any;
      if (rec?.clinic_id !== clinicId || !rec?.patients?.phone) continue;
      const msg = replacePlaceholders(brushTemplate.message_body, { patient_name: rec.patients.full_name });
      await sendWhatsAppMessage({ clinicId, patientId: rec.patient_id, phone: rec.patients.phone, templateName: "brush_change_reminder", messageBody: msg, waba });
      sent++;
    }
  }

  // 5. EMI due in 2 days
  const emiTemplate = templateMap.get("payment_due_reminder");
  if (emiTemplate) {
    const twoDaysLater = new Date(now);
    twoDaysLater.setDate(twoDaysLater.getDate() + 2);
    const dueStr = twoDaysLater.toISOString().split("T")[0];

    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, patient_id, amount, due_date, patients(full_name, phone)")
      .eq("clinic_id", clinicId)
      .eq("status", "sent")
      .eq("due_date", dueStr);

    for (const inv of invoices ?? []) {
      const patient = inv.patients as any;
      if (!patient?.phone) continue;
      const msg = replacePlaceholders(emiTemplate.message_body, {
        patient_name: patient.full_name,
        amount: String(inv.amount),
        due_date: inv.due_date!,
      });
      await sendWhatsAppMessage({ clinicId, patientId: inv.patient_id, phone: patient.phone, templateName: "payment_due_reminder", messageBody: msg, waba });
      sent++;
    }
  }

  // 6. Birthday greeting
  const bdayTemplate = templateMap.get("birthday_greeting");
  if (bdayTemplate) {
    const monthDay = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const { data: patients } = await supabase
      .from("patients")
      .select("id, full_name, phone, date_of_birth")
      .eq("clinic_id", clinicId)
      .not("phone", "is", null)
      .not("date_of_birth", "is", null);

    for (const p of patients ?? []) {
      if (!p.date_of_birth) continue;
      const dob = p.date_of_birth; // format: YYYY-MM-DD
      const dobMonthDay = dob.substring(5); // MM-DD
      if (dobMonthDay !== monthDay) continue;

      const msg = replacePlaceholders(bdayTemplate.message_body, { patient_name: p.full_name });
      await sendWhatsAppMessage({ clinicId, patientId: p.id, phone: p.phone!, templateName: "birthday_greeting", messageBody: msg, waba });
      sent++;
    }
  }

  return { clinicId, sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify caller is authenticated (cron job or admin)
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { error } = await supabaseAuth.auth.getUser(token);
      if (error) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  try {
    // Get all clinics
    const { data: clinics } = await supabase.from("clinics").select("id");
    const results = [];

    for (const clinic of clinics ?? []) {
      const result = await processClinic(clinic.id);
      results.push(result);
    }

    const totalSent = results.reduce((s, r) => s + r.sent, 0);

    return new Response(JSON.stringify({ success: true, totalSent, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("WhatsApp automation error:", msg);
    await recordFailure(supabase, "send-whatsapp-automated", {}, error);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
