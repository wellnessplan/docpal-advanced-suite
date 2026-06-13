// retry-failed-jobs — runs every 10 min via pg_cron.
// Picks pending/retrying rows whose next_retry_at <= now() and re-invokes the original function.
// Marks status:
//   - "succeeded" if invoke returns 2xx
//   - "dead" if attempts >= 5
//   - "retrying" with next_retry_at = now() + backoff otherwise
//
// Idempotency contract: the original function MUST be safe to call twice with the same payload.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { nextBackoffMs } from "../_shared/dlq.ts";
import { requireCron } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

const MAX_ATTEMPTS = 5;
const BATCH = 25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronError = requireCron(req, corsHeaders);
  if (cronError) return cronError;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: jobs, error } = await supabase
    .from("edge_function_failures")
    .select("*")
    .in("status", ["pending", "retrying"])
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let succeeded = 0, retried = 0, dead = 0;

  for (const job of jobs ?? []) {
    try {
      const cronSecret = Deno.env.get("CRON_SECRET");
      const { error: invokeErr } = await supabase.functions.invoke(job.function_name, {
        body: job.payload ?? {},
        headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : undefined,
      });
      if (invokeErr) throw invokeErr;
      await supabase.from("edge_function_failures")
        .update({ status: "succeeded", updated_at: new Date().toISOString() })
        .eq("id", job.id);
      succeeded++;
    } catch (e: any) {
      const newAttempts = (job.attempts ?? 1) + 1;
      if (newAttempts >= MAX_ATTEMPTS) {
        await supabase.from("edge_function_failures")
          .update({
            status: "dead",
            attempts: newAttempts,
            error_message: String(e?.message ?? e).slice(0, 1000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        dead++;
      } else {
        await supabase.from("edge_function_failures")
          .update({
            status: "retrying",
            attempts: newAttempts,
            next_retry_at: new Date(Date.now() + nextBackoffMs(newAttempts)).toISOString(),
            error_message: String(e?.message ?? e).slice(0, 1000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        retried++;
      }
    }
  }

  return new Response(JSON.stringify({ processed: jobs?.length ?? 0, succeeded, retried, dead }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
