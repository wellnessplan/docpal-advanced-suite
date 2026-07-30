import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Build a Supabase client that acts as the authenticated MCP caller.
 * The user's bearer token is forwarded so RLS runs as that user and
 * clinic-level multi-tenancy is preserved.
 */
export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

/** Resolve the caller's clinic, or return an error result. */
export async function requireClinic(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) {
    return { error: errorResult("Not authenticated. Reconnect this MCP server and sign in.") };
  }
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase
    .from("profiles")
    .select("clinic_id, full_name")
    .eq("user_id", ctx.getUserId())
    .maybeSingle();

  if (error) return { error: errorResult(`Could not load your profile: ${error.message}`) };
  if (!data?.clinic_id) {
    return { error: errorResult("Your account is not linked to a clinic yet. Finish onboarding in DoctorsBuddy first.") };
  }
  return { supabase, clinicId: data.clinic_id as string, fullName: data.full_name as string | null };
}
