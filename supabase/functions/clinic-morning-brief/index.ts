// Generates an AI morning brief for a clinic using today's data.
// POST { clinic_id, doctor_name? } -> { brief: string, highlights: string[] }
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { clinic_id, doctor_name } = await req.json();
    if (!clinic_id) {
      return new Response(JSON.stringify({ error: "clinic_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: appts }, { data: invoices }, { data: pendingInv }] = await Promise.all([
      supabase.from("appointments")
        .select("appointment_time, status, patients(full_name)")
        .eq("clinic_id", clinic_id).eq("appointment_date", today),
      supabase.from("invoices").select("total, paid_amount, status")
        .eq("clinic_id", clinic_id).gte("created_at", today + "T00:00:00"),
      supabase.from("invoices").select("total, paid_amount, patients(full_name)")
        .eq("clinic_id", clinic_id).neq("status", "paid").limit(20),
    ]);

    const apptCount = appts?.length ?? 0;
    const completed = appts?.filter((a: any) => a.status === "completed").length ?? 0;
    const todayRevenue = invoices?.reduce((s: number, i: any) => s + Number(i.paid_amount || 0), 0) ?? 0;
    const todayBilled = invoices?.reduce((s: number, i: any) => s + Number(i.total || 0), 0) ?? 0;
    const outstanding = pendingInv?.reduce((s: number, i: any) => s + (Number(i.total) - Number(i.paid_amount || 0)), 0) ?? 0;
    const nextAppt = appts?.find((a: any) => a.status === "scheduled" || a.status === "confirmed");

    const summary = {
      apptCount, completed, todayRevenue, todayBilled, outstanding,
      pendingCount: pendingInv?.length ?? 0,
      nextPatient: (nextAppt as any)?.patients?.full_name ?? null,
      nextTime: (nextAppt as any)?.appointment_time ?? null,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let brief = "";
    if (LOVABLE_API_KEY) {
      const prompt = `You are a warm, concise chief-of-staff for a dental clinic. Write a 2-3 sentence morning brief for ${doctor_name || "the doctor"} in plain English. Use INR symbol ₹. No markdown. Data: ${JSON.stringify(summary)}`;
      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 180,
          }),
        });
        if (r.ok) {
          const j = await r.json();
          brief = j.choices?.[0]?.message?.content?.trim() ?? "";
        }
      } catch {}
    }
    if (!brief) {
      brief = `You have ${apptCount} appointments today${summary.nextPatient ? `, starting with ${summary.nextPatient} at ${summary.nextTime}` : ""}. Today's collections so far: ₹${todayRevenue.toLocaleString("en-IN")}. ${outstanding > 0 ? `₹${outstanding.toLocaleString("en-IN")} outstanding across ${summary.pendingCount} invoices.` : "All invoices are settled."}`;
    }

    return new Response(JSON.stringify({ brief, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
