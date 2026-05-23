import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { recordFailure } from "../_shared/dlq.ts";
import { logAiUsage, isClinicOverAiCap } from "../_shared/ai-usage.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_MODEL = "google/gemini-2.5-flash-lite";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify caller is authenticated (cron job or admin)
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { error } = await supabaseAuth.auth.getUser(token);
      if (error) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: clinics, error: clinicsErr } = await supabase.from("clinics").select("id");
    if (clinicsErr) throw clinicsErr;

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    let totalGenerated = 0;
    let aiSkippedCap = 0;

    for (const clinic of clinics ?? []) {
      const clinicId = clinic.id;
      const todos: any[] = [];

      await supabase
        .from("daily_todos")
        .delete()
        .eq("clinic_id", clinicId)
        .eq("status", "pending")
        .gte("created_at", today + "T00:00:00Z")
        .lt("created_at", tomorrow + "T00:00:00Z");

      // 1. LAB_READY
      const { data: labReady } = await supabase
        .from("lab_orders")
        .select("id, item_description, patient_id, patients(full_name, phone)")
        .eq("clinic_id", clinicId)
        .eq("status", "received")
        .is("fitted_date", null);

      for (const lab of labReady ?? []) {
        const p = lab.patients as any;
        todos.push({
          clinic_id: clinicId, patient_id: lab.patient_id, task_type: "LAB_READY",
          message: `Call ${p?.full_name || "Patient"} — ${lab.item_description} ready for fitting`,
          priority: "high", patient_name: p?.full_name, patient_phone: p?.phone,
          reference_id: lab.id, reference_table: "lab_orders",
        });
      }

      // 2. INCOMPLETE_TX
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];
      const { data: incompleteTx } = await supabase
        .from("tooth_treatments")
        .select("id, treatment_name, tooth_record_id, tooth_records(patient_id, clinic_id, patients(full_name, phone))")
        .in("status", ["planned", "in_progress"])
        .lt("created_at", fourteenDaysAgo + "T00:00:00Z");

      for (const tx of incompleteTx ?? []) {
        const rec = tx.tooth_records as any;
        if (rec?.clinic_id !== clinicId) continue;
        const p = rec?.patients as any;
        const { data: futureAppts } = await supabase
          .from("appointments").select("id")
          .eq("clinic_id", clinicId).eq("patient_id", rec.patient_id)
          .gte("appointment_date", today).limit(1);
        if (!futureAppts?.length) {
          todos.push({
            clinic_id: clinicId, patient_id: rec.patient_id, task_type: "INCOMPLETE_TX",
            message: `Follow up with ${p?.full_name || "Patient"} — ${tx.treatment_name} pending`,
            priority: "medium", patient_name: p?.full_name, patient_phone: p?.phone,
            reference_id: tx.id, reference_table: "tooth_treatments",
          });
        }
      }

      // 3. RECALL_DUE
      const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0];
      const { data: patients } = await supabase
        .from("patients").select("id, full_name, phone").eq("clinic_id", clinicId);

      for (const patient of patients ?? []) {
        const { data: lastAppt } = await supabase
          .from("appointments").select("appointment_date")
          .eq("clinic_id", clinicId).eq("patient_id", patient.id)
          .order("appointment_date", { ascending: false }).limit(1);
        if (lastAppt?.length && lastAppt[0].appointment_date < sixMonthsAgo) {
          const { data: futureAppts } = await supabase
            .from("appointments").select("id")
            .eq("clinic_id", clinicId).eq("patient_id", patient.id)
            .gte("appointment_date", today).limit(1);
          if (!futureAppts?.length) {
            todos.push({
              clinic_id: clinicId, patient_id: patient.id, task_type: "RECALL_DUE",
              message: `Send recall to ${patient.full_name} — last visit over 6 months ago`,
              priority: "low", patient_name: patient.full_name, patient_phone: patient.phone,
              reference_table: "patients", reference_id: patient.id,
            });
          }
        }
      }

      // 4. PAYMENT_OVERDUE
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
      const { data: overdueInvoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, patient_id, patients(full_name, phone)")
        .eq("clinic_id", clinicId).eq("status", "unpaid").lt("due_date", sevenDaysAgo);

      for (const inv of overdueInvoices ?? []) {
        const p = inv.patients as any;
        todos.push({
          clinic_id: clinicId, patient_id: inv.patient_id, task_type: "PAYMENT_OVERDUE",
          message: `Call ${p?.full_name || "Patient"} — Invoice ${inv.invoice_number || ""} ₹${inv.total} overdue`,
          priority: "high", patient_name: p?.full_name, patient_phone: p?.phone,
          reference_id: inv.id, reference_table: "invoices",
        });
      }

      // 5. EMI_DUE
      const twoDaysLater = new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0];
      const { data: emiDue } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, patient_id, patients(full_name, phone)")
        .eq("clinic_id", clinicId).eq("status", "unpaid").eq("due_date", twoDaysLater);

      for (const inv of emiDue ?? []) {
        const p = inv.patients as any;
        todos.push({
          clinic_id: clinicId, patient_id: inv.patient_id, task_type: "EMI_DUE",
          message: `WhatsApp EMI reminder to ${p?.full_name || "Patient"} — ₹${inv.total} due on ${twoDaysLater}`,
          priority: "medium", patient_name: p?.full_name, patient_phone: p?.phone,
          reference_id: inv.id, reference_table: "invoices",
        });
      }

      // 6. CONFIRM_TOMORROW
      const { data: tomorrowAppts } = await supabase
        .from("appointments")
        .select("id, patient_id, appointment_time, type, patients(full_name, phone)")
        .eq("clinic_id", clinicId).eq("appointment_date", tomorrow).eq("status", "scheduled");

      for (const appt of tomorrowAppts ?? []) {
        const p = appt.patients as any;
        todos.push({
          clinic_id: clinicId, patient_id: appt.patient_id, task_type: "CONFIRM_TOMORROW",
          message: `Confirm ${p?.full_name || "Patient"}'s appointment tomorrow at ${appt.appointment_time}`,
          priority: "medium", patient_name: p?.full_name, patient_phone: p?.phone,
          reference_id: appt.id, reference_table: "appointments",
        });
      }

      // 7. LOW_STOCK
      const { data: lowStock } = await supabase
        .from("inventory_items").select("id, name, quantity, min_stock_level")
        .eq("clinic_id", clinicId).not("min_stock_level", "is", null);

      for (const item of lowStock ?? []) {
        if (item.quantity !== null && item.min_stock_level !== null && item.quantity <= item.min_stock_level) {
          todos.push({
            clinic_id: clinicId, patient_id: null, task_type: "LOW_STOCK",
            message: `Reorder ${item.name} — ${item.quantity} remaining (min: ${item.min_stock_level})`,
            priority: item.quantity === 0 ? "urgent" : "medium",
            patient_name: null, patient_phone: null,
            reference_id: item.id, reference_table: "inventory_items",
          });
        }
      }

      // 8. REVIEW_REQUEST
      const { data: completedToday } = await supabase
        .from("appointments")
        .select("id, patient_id, patients(full_name, phone)")
        .eq("clinic_id", clinicId).eq("appointment_date", today).eq("status", "completed");

      for (const appt of completedToday ?? []) {
        const p = appt.patients as any;
        if (p?.phone) {
          todos.push({
            clinic_id: clinicId, patient_id: appt.patient_id, task_type: "REVIEW_REQUEST",
            message: `Send Google review request to ${p?.full_name || "Patient"} — visited today`,
            priority: "low", patient_name: p?.full_name, patient_phone: p?.phone,
            reference_id: appt.id, reference_table: "appointments",
          });
        }
      }

      // 9. REFERRAL_CAMPAIGN
      const { data: loyalPatients } = await supabase
        .from("patients").select("id, full_name, phone").eq("clinic_id", clinicId);

      for (const patient of loyalPatients ?? []) {
        const { count } = await supabase
          .from("appointments").select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId).eq("patient_id", patient.id).eq("status", "completed");
        if ((count ?? 0) >= 3) {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
          const { data: recentReferral } = await supabase
            .from("daily_todos").select("id")
            .eq("clinic_id", clinicId).eq("patient_id", patient.id)
            .eq("task_type", "REFERRAL_CAMPAIGN")
            .gte("created_at", thirtyDaysAgo).limit(1);
          if (!recentReferral?.length) {
            todos.push({
              clinic_id: clinicId, patient_id: patient.id, task_type: "REFERRAL_CAMPAIGN",
              message: `Send referral offer to ${patient.full_name} — loyal patient (3+ visits)`,
              priority: "low", patient_name: patient.full_name, patient_phone: patient.phone,
              reference_id: patient.id, reference_table: "patients",
            });
          }
        }
      }

      // 10. DAILY_FOCUS (AI) — generates a one-line headline summarising the day's priorities.
      //     Skipped if the clinic has hit its monthly AI spend cap, or LOVABLE_API_KEY is missing.
      if (LOVABLE_API_KEY && todos.length > 0) {
        const overCap = await isClinicOverAiCap(supabase, clinicId);
        if (overCap) {
          aiSkippedCap++;
        } else {
          const t0 = Date.now();
          const topTasks = todos.slice(0, 12).map(t => `- [${t.priority}] ${t.message}`).join("\n");
          try {
            const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              },
              body: JSON.stringify({
                model: AI_MODEL,
                messages: [
                  { role: "system", content: "You are a dental clinic operations assistant. Reply with ONE short sentence (max 20 words) summarising today's single most important priority. No emojis, no quotes." },
                  { role: "user", content: `Today's tasks for the clinic:\n${topTasks}\n\nWhat is the most important thing to do today?` },
                ],
                max_tokens: 60,
              }),
            });
            const json: any = await resp.json().catch(() => ({}));
            const headline = json?.choices?.[0]?.message?.content?.trim();
            await logAiUsage(supabase, {
              clinicId,
              functionName: "generate-daily-todos",
              model: AI_MODEL,
              promptTokens: json?.usage?.prompt_tokens,
              completionTokens: json?.usage?.completion_tokens,
              status: resp.ok ? "success" : (resp.status === 429 ? "rate_limited" : "error"),
              latencyMs: Date.now() - t0,
              error: resp.ok ? null : (json?.error?.message ?? `HTTP ${resp.status}`),
            });
            if (resp.ok && headline) {
              todos.unshift({
                clinic_id: clinicId, patient_id: null, task_type: "DAILY_FOCUS",
                message: headline, priority: "high",
                patient_name: null, patient_phone: null,
                reference_id: null, reference_table: null,
              });
            }
          } catch (e) {
            await logAiUsage(supabase, {
              clinicId, functionName: "generate-daily-todos", model: AI_MODEL,
              status: "error", latencyMs: Date.now() - t0,
              error: (e as Error)?.message ?? "unknown",
            });
          }
        }
      }

      // Insert
      if (todos.length > 0) {
        const { error: insertErr } = await supabase.from("daily_todos").insert(todos);
        if (insertErr) {
          console.error(`Error inserting todos for clinic ${clinicId}:`, insertErr);
        } else {
          totalGenerated += todos.length;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, generated: totalGenerated, ai_skipped_cap: aiSkippedCap }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating daily todos:", error);
    const message = error instanceof Error ? error.message : String(error);
    try {
      const sb = createClient(supabaseUrl, serviceKey);
      await recordFailure(sb, "generate-daily-todos", {}, error);
    } catch { /* swallow */ }
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
