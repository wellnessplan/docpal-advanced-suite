// Shared helper for edge functions to log Lovable AI Gateway calls into ai_usage_log.
// Import inside any edge function that calls the gateway:
//
//   import { logAiUsage } from "../_shared/ai-usage.ts";
//   const t0 = Date.now();
//   const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {...});
//   const json = await resp.json();
//   await logAiUsage(supabase, {
//     clinicId, functionName: "generate-daily-todos",
//     model: "google/gemini-2.5-flash",
//     promptTokens: json.usage?.prompt_tokens,
//     completionTokens: json.usage?.completion_tokens,
//     status: resp.ok ? "success" : "error",
//     latencyMs: Date.now() - t0,
//     error: resp.ok ? null : (json?.error?.message ?? `HTTP ${resp.status}`),
//   });

// deno-lint-ignore-file no-explicit-any
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Approximate Lovable AI Gateway pricing (INR per 1M tokens). Update as pricing changes.
// Source: keep parity with /platform pricing UI.
const PRICING_INR_PER_M: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-pro":          { input: 100, output: 400 },
  "google/gemini-2.5-flash":        { input: 25,  output: 100 },
  "google/gemini-2.5-flash-lite":   { input: 8,   output: 32  },
  "google/gemini-2.5-flash-image":  { input: 25,  output: 100 },
  "google/gemini-3-flash-preview":  { input: 25,  output: 100 },
  "openai/gpt-5":                   { input: 110, output: 880 },
  "openai/gpt-5-mini":              { input: 22,  output: 176 },
  "openai/gpt-5-nano":              { input: 4.4, output: 35  },
};

function estimateCostInr(model: string, prompt: number, completion: number): number {
  const p = PRICING_INR_PER_M[model];
  if (!p) return 0;
  return +(((prompt * p.input) + (completion * p.output)) / 1_000_000).toFixed(4);
}

export async function logAiUsage(
  supabase: SupabaseClient,
  opts: {
    clinicId?: string | null;
    functionName: string;
    model: string;
    promptTokens?: number | null;
    completionTokens?: number | null;
    status?: "success" | "error" | "rate_limited";
    latencyMs?: number | null;
    error?: string | null;
    costInr?: number | null;
  }
) {
  try {
    const prompt = Number(opts.promptTokens || 0);
    const completion = Number(opts.completionTokens || 0);
    const cost = opts.costInr ?? estimateCostInr(opts.model, prompt, completion);
    await supabase.from("ai_usage_log").insert({
      clinic_id: opts.clinicId ?? null,
      function_name: opts.functionName,
      model: opts.model,
      prompt_tokens: prompt,
      completion_tokens: completion,
      cost_inr: cost,
      status: opts.status ?? "success",
      latency_ms: opts.latencyMs ?? null,
      error_message: opts.error ? String(opts.error).slice(0, 500) : null,
    });
  } catch (_) {
    // never let usage logging throw — it's observability only
  }
}

/**
 * Returns true if the clinic has exceeded its monthly AI spend cap (₹).
 * Reads `clinic_subscriptions.ai_monthly_cap_inr`. Fails open (returns false)
 * on any error so observability bugs don't block real clinical work.
 */
export async function isClinicOverAiCap(
  supabase: SupabaseClient,
  clinicId: string
): Promise<boolean> {
  try {
    const { data: sub } = await supabase
      .from("clinic_subscriptions")
      .select("ai_monthly_cap_inr")
      .eq("clinic_id", clinicId)
      .maybeSingle();
    const cap = Number((sub as any)?.ai_monthly_cap_inr || 0);
    if (!cap) return false;
    const since = new Date();
    since.setDate(1); since.setHours(0, 0, 0, 0);
    const { data: rows } = await supabase
      .from("ai_usage_log")
      .select("cost_inr")
      .eq("clinic_id", clinicId)
      .gte("created_at", since.toISOString());
    const spent = (rows ?? []).reduce((a: number, r: any) => a + Number(r.cost_inr || 0), 0);
    return spent >= cap;
  } catch {
    return false;
  }
}
