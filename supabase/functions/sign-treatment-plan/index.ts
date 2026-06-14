import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const { data: plan, error } = await supabase
        .from("treatment_plans")
        .select("id, plan_name, status, total_estimated_cost, notes, accepted_at, signature_url, patient_id, clinic_id")
        .eq("id", token)
        .maybeSingle();
      if (error || !plan) {
        return new Response(JSON.stringify({ error: "Plan not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const [{ data: patient }, { data: clinic }, { data: items }] = await Promise.all([
        supabase.from("patients").select("full_name").eq("id", plan.patient_id).maybeSingle(),
        supabase.from("clinics").select("name, logo_url").eq("id", plan.clinic_id).maybeSingle(),
        supabase.from("treatment_plan_items").select("*").eq("plan_id", token),
      ]);
      return new Response(JSON.stringify({ plan, patient, clinic, items: items ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const signature = String(body?.signature || "");
      if (!signature.startsWith("data:image/")) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("treatment_plans").update({
        signature_url: signature,
        status: "approved",
        accepted_at: new Date().toISOString(),
      }).eq("id", token);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
