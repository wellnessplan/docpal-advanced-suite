// Membership dunning. Daily cron at 10:00 IST.
// For each active membership whose linked invoice is unpaid and overdue,
// increments dunning_attempts and queues a WhatsApp dunning nudge.
// On the 3rd unpaid attempt, suspends the membership.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DAY = 86_400_000;
const MAX_ATTEMPTS = 3;
const RETRY_GAP_DAYS = 3; // wait 3 days between retries

function dunningMsg(name: string, plan: string, balance: number, attempt: number, willSuspend: boolean) {
  if (willSuspend) {
    return `Hi ${name}, your ${plan} membership payment of Rs ${balance} is still pending after ${attempt} reminders. Your membership has been suspended. Please contact the clinic to reactivate.`;
  }
  return `Hi ${name}, friendly reminder: your ${plan} membership payment of Rs ${balance} is overdue (reminder ${attempt}/${MAX_ATTEMPTS}). Please clear the balance to keep your benefits active.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const retryCutoff = new Date(today.getTime() - RETRY_GAP_DAYS * DAY).toISOString();

    // Pull active memberships with linked invoices
    const { data: memberships, error } = await supabase
      .from("memberships")
      .select("id, clinic_id, patient_id, plan_name, dunning_attempts, last_dunning_at, invoice_id, patients(full_name, phone), invoices!memberships_invoice_id_fkey(id, total, paid_amount, status, due_date, invoice_date)")
      .eq("status", "active")
      .not("invoice_id", "is", null);

    if (error) throw error;

    let processed = 0, suspended = 0, queued = 0;

    for (const m of memberships ?? []) {
      const inv = (m as any).invoices;
      if (!inv) continue;
      const total = Number(inv.total || 0);
      const paid = Number(inv.paid_amount || 0);
      const balance = total - paid;
      if (balance <= 0 || inv.status === "paid") continue;

      // Only dun once the invoice is past its due_date (or >7 days after invoice_date if no due_date)
      const dueRef = inv.due_date || (inv.invoice_date
        ? new Date(new Date(inv.invoice_date).getTime() + 7 * DAY).toISOString().slice(0, 10)
        : null);
      if (!dueRef || dueRef > todayStr) continue;

      // Throttle: respect retry gap
      if (m.last_dunning_at && m.last_dunning_at > retryCutoff) continue;

      processed++;
      const nextAttempt = (m.dunning_attempts || 0) + 1;
      const willSuspend = nextAttempt >= MAX_ATTEMPTS;
      const phone = (m as any).patients?.phone;
      const name = (m as any).patients?.full_name || "there";

      if (phone) {
        const body = dunningMsg(name, m.plan_name || "membership", balance, nextAttempt, willSuspend);
        const { error: logErr } = await supabase.from("whatsapp_logs").insert({
          clinic_id: m.clinic_id,
          patient_id: m.patient_id,
          template_name: willSuspend ? "membership_dunning_suspended" : "membership_dunning",
          phone,
          message_body: body,
          status: "queued",
          delivery_status: "queued",
          sent_at: new Date().toISOString(),
        });
        if (!logErr) queued++;
      }

      const updates: any = {
        dunning_attempts: nextAttempt,
        last_dunning_at: new Date().toISOString(),
      };
      if (willSuspend) {
        updates.status = "suspended";
        updates.suspended_at = new Date().toISOString();
        suspended++;
      }
      await supabase.from("memberships").update(updates).eq("id", m.id);
    }

    return new Response(JSON.stringify({ success: true, processed, queued, suspended }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
