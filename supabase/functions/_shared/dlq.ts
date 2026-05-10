// Shared helper for edge functions to record failures into edge_function_failures.
// Service role bypasses RLS, so we can insert without auth context.
//
// Usage from inside an edge function:
//   import { recordFailure } from "../_shared/dlq.ts";
//   try { ... } catch (e) {
//     await recordFailure(supabase, "send-whatsapp-automated", payload, e);
//     throw e;
//   }
//
// Retry scheduling: exponential backoff capped at 1 hour, max 5 attempts → status "dead".

// deno-lint-ignore-file no-explicit-any
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function recordFailure(
  supabase: SupabaseClient,
  functionName: string,
  payload: any,
  error: unknown,
  clinicId?: string | null
) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("edge_function_failures").insert({
      function_name: functionName,
      payload: payload ?? {},
      error_message: message.slice(0, 1000),
      clinic_id: clinicId ?? null,
      attempts: 1,
      next_retry_at: new Date(Date.now() + 60_000).toISOString(),
      status: "pending",
    });
  } catch (_) {
    // never let DLQ writes throw
  }
}

export function nextBackoffMs(attempts: number): number {
  // 1m, 5m, 15m, 30m, 60m
  const ladder = [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, 60 * 60_000];
  return ladder[Math.min(attempts - 1, ladder.length - 1)];
}
