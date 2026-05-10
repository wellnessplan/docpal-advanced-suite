import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

type Filter = {
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  schema?: string;
  table: string;
  filter?: string;
};

type Handler = (payload: RealtimePostgresChangesPayload<any>) => void;

/**
 * Standardised Postgres realtime subscription with guaranteed cleanup.
 *
 *   useRealtimeChannel("queue-tokens", [
 *     { table: "queue_tokens", filter: `clinic_id=eq.${clinicId}`, event: "*" }
 *   ], onChange, [clinicId]);
 *
 * - Skips subscribing when `enabled` is false (e.g. clinicId not loaded).
 * - Always removes the channel on unmount or dep change → no leaks.
 */
export function useRealtimeChannel(
  channelName: string,
  filters: Filter[],
  handler: Handler,
  deps: ReadonlyArray<unknown>,
  enabled: boolean = true
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled) return;
    let channel: RealtimeChannel | null = supabase.channel(channelName);
    for (const f of filters) {
      channel = channel.on(
        "postgres_changes" as any,
        { event: f.event ?? "*", schema: f.schema ?? "public", table: f.table, filter: f.filter },
        handler
      );
    }
    channel.subscribe();
    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
        channel = null;
      }
    };
    // deps are owned by the caller; channelName intentionally not in deps to avoid re-subs on inline strings
  }, [enabled, ...deps]);
}
