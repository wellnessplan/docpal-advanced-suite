// Evergreen post recycler. Runs weekly via pg_cron.
// For each evergreen-tagged source post, if interval_weeks have passed since last_recycled_at
// (or original posted_at), clones it scheduled 3 days from now and fires the webhook.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const now = Date.now();
    // Pull evergreen sources (recycle_enabled, posted/approved at least once)
    const { data: candidates, error } = await supabase
      .from("social_posts")
      .select("id, clinic_id, recycle_interval_weeks, last_recycled_at, posted_at, approval_status")
      .eq("recycle_enabled", true)
      .is("source_post_id", null); // recycle only originals, never clones

    if (error) throw error;

    let cloned = 0, fired = 0, skipped = 0;
    for (const p of candidates ?? []) {
      const interval = Math.max(1, p.recycle_interval_weeks || 4);
      const lastRef = p.last_recycled_at ? new Date(p.last_recycled_at).getTime()
                    : p.posted_at ? new Date(p.posted_at).getTime() : 0;
      if (!lastRef) { skipped++; continue; }
      const dueAt = lastRef + interval * 7 * DAY;
      if (dueAt > now) { skipped++; continue; }

      const scheduled = new Date(now + 3 * DAY); // schedule 3 days out
      const { data: newId, error: cloneErr } = await supabase.rpc("clone_social_post_for_recycle", {
        p_post_id: p.id,
        p_new_scheduled_at: scheduled.toISOString(),
      });
      if (cloneErr) { console.error("clone failed", cloneErr); continue; }
      cloned++;

      // Fire webhook immediately so it's queued via the operator's automation
      try {
        await supabase.functions.invoke("social-post-webhook", { body: { post_id: newId } });
        fired++;
      } catch (e) { console.error("webhook fire failed", e); }
    }

    return new Response(JSON.stringify({ success: true, cloned, fired, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
