/**
 * Lightweight in-app error tracking.
 *
 * Captures uncaught errors, unhandled promise rejections, and manual
 * `captureError(...)` calls into the `error_logs` table.
 */
import { supabase } from "@/integrations/supabase/client";
import { captureSentry } from "./sentry";

interface CaptureOptions {
  level?: "error" | "warning" | "info";
  context?: Record<string, any>;
  source?: "frontend" | "backend";
  clinicId?: string | null;
  userId?: string | null;
}

const recentErrors = new Map<string, number>();
const DEDUPE_WINDOW_MS = 30_000;

function shouldThrottle(message: string): boolean {
  const now = Date.now();
  const last = recentErrors.get(message);
  if (last && now - last < DEDUPE_WINDOW_MS) return true;
  recentErrors.set(message, now);
  // Cleanup old entries
  if (recentErrors.size > 50) {
    for (const [k, v] of recentErrors.entries()) {
      if (now - v > DEDUPE_WINDOW_MS) recentErrors.delete(k);
    }
  }
  return false;
}

export async function captureError(error: unknown, options: CaptureOptions = {}): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    if (!message || shouldThrottle(message)) return;

    // Forward to Sentry (no-op if not initialized)
    captureSentry(error, options.context);

    const { data: { user } } = await supabase.auth.getUser();
    let clinicId = options.clinicId ?? null;
    let userId = options.userId ?? user?.id ?? null;

    if (!clinicId && user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("user_id", user.id)
        .maybeSingle();
      clinicId = (profile as any)?.clinic_id ?? null;
    }

    await (supabase.from("error_logs") as any).insert({
      clinic_id: clinicId,
      user_id: userId,
      source: options.source ?? "frontend",
      level: options.level ?? "error",
      message: message.slice(0, 500),
      stack: stack?.slice(0, 4000),
      url: typeof window !== "undefined" ? window.location.href : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      context: options.context ?? {},
    });
  } catch {
    // never let error tracking itself throw
  }
}

let installed = false;

export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    captureError(event.error || new Error(event.message), {
      context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    captureError(reason instanceof Error ? reason : new Error(String(reason)), {
      context: { type: "unhandledrejection" },
    });
  });
}
