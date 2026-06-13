import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type FunctionAuthContext = {
  userId: string;
  clinicId: string | null;
  groupId: string | null;
  fullName: string | null;
};

export function jsonResponse(body: Record<string, unknown>, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function isCronAuthorized(req: Request) {
  const cronSecret = Deno.env.get("CRON_SECRET");
  return Boolean(cronSecret) && req.headers.get("Authorization") === `Bearer ${cronSecret}`;
}

export function requireCron(req: Request, corsHeaders: Record<string, string>) {
  if (!Deno.env.get("CRON_SECRET")) {
    return jsonResponse({ error: "Scheduled job secret is not configured" }, 503, corsHeaders);
  }
  if (!isCronAuthorized(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  }
  return null;
}

export async function getAuthenticatedContext(req: Request, serviceClient: any, corsHeaders: Record<string, string>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { errorResponse: jsonResponse({ error: "Unauthorized" }, 401, corsHeaders) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { errorResponse: jsonResponse({ error: "Unauthorized" }, 401, corsHeaders) };
  }

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("clinic_id, group_id, full_name")
    .eq("user_id", data.user.id)
    .maybeSingle();

  return {
    context: {
      userId: data.user.id,
      clinicId: profile?.clinic_id ?? null,
      groupId: profile?.group_id ?? null,
      fullName: profile?.full_name ?? null,
    } satisfies FunctionAuthContext,
  };
}

export async function canAccessClinic(context: FunctionAuthContext, clinicId: string, serviceClient: any) {
  if (!clinicId) return false;
  if (context.clinicId === clinicId) return true;
  if (!context.groupId) return false;

  const { data: clinic } = await serviceClient
    .from("clinics")
    .select("group_id")
    .eq("id", clinicId)
    .maybeSingle();

  return clinic?.group_id === context.groupId;
}