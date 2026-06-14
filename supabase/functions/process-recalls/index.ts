// Recall engine with smart escalation.
// Runs daily (via pg_cron). For each open recall_reminder:
//   - due today          → send first WhatsApp nudge
//   - overdue 3-7 days   → send second nudge
//   - overdue 8-14 days  → send third nudge + escalate priority
//   - overdue >14 days   → create a follow-up task for staff and mark "escalated"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const STAGE_BY_DAYS = (d: number) => {
  if (d === 0) return { stage: 1, label: "first" };
  if (d >= 3 && d <= 7) return { stage: 2, label: "second" };
  if (d >= 8 && d <= 14) return { stage: 3, label: "third" };
  if (d > 14) return { stage: 4, label: "escalated" };
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: reminders = [] } = await supabase
      .from("recall_reminders")
      .select("*, patients(full_name, phone), clinics(name)")
      .neq("status", "completed")
      .lte("due_date", today.toISOString());

    let processed = 0, escalated = 0;
    for (const r of (reminders ?? []) as any[]) {
      const due = new Date(r.due_date); due.setHours(0, 0, 0, 0);
      const overdueDays = Math.floor((today.getTime() - due.getTime()) / 86400000);
      const stage = STAGE_BY_DAYS(overdueDays);
      if (!stage) continue;
      if ((r.last_stage ?? 0) >= stage.stage) continue;

      const phone = r.patients?.phone;
      const name = r.patients?.full_name ?? "there";
      const clinic = r.clinics?.name ?? "your clinic";

      if (phone) {
        const msg = stage.stage === 4
          ? `Hi ${name}, our team will call you regarding your overdue ${r.reminder_type} at ${clinic}.`
          : `Hi ${name}, this is a ${stage.label} reminder for your ${r.reminder_type} at ${clinic}. Please book at your convenience.`;
        await supabase.functions.invoke("send-whatsapp-automated", {
          body: { clinic_id: r.clinic_id, patient_id: r.patient_id, phone, message: msg, template_key: "recall_reminder" },
        }).catch(() => {});
      }

      const updates: Record<string, unknown> = { last_stage: stage.stage, last_nudged_at: new Date().toISOString() };
      if (stage.stage === 4) {
        updates.status = "escalated";
        escalated += 1;
        await supabase.from("daily_todos").insert({
          clinic_id: r.clinic_id,
          title: `Call ${name} – overdue ${r.reminder_type}`,
          category: "Clinical",
          priority: "high",
          due_date: today.toISOString().slice(0, 10),
          related_patient_id: r.patient_id,
          status: "pending",
        } as any).catch(() => {});
      }
      await supabase.from("recall_reminders").update(updates).eq("id", r.id);
      processed += 1;
    }

    return new Response(JSON.stringify({ ok: true, processed, escalated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
