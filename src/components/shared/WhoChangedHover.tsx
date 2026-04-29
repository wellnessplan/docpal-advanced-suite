import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Info } from "lucide-react";
import { format } from "date-fns";

interface Props {
  table: string;
  recordId: string;
  className?: string;
}

/**
 * Hover popover that shows the most recent audit_log entry for a record:
 * who changed it, what action, and when. Pulls lazily on hover.
 */
export default function WhoChangedHover({ table, recordId, className }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["who-changed", table, recordId],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("action, created_at, user_name")
        .eq("table_name", table)
        .eq("record_id", recordId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: !!recordId,
    staleTime: 60_000,
  });

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button type="button" className={`inline-flex items-center text-muted-foreground/60 hover:text-primary transition-colors ${className || ""}`}>
          <Info className="h-3 w-3" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 text-xs">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !data ? (
          <p className="text-muted-foreground">No change history.</p>
        ) : (
          <div className="space-y-1">
            <div className="font-semibold capitalize">{(data.action || "modified").replace(/_/g, " ")}</div>
            <div className="text-muted-foreground">
              by <span className="text-foreground">{data.profiles?.full_name || "System"}</span>
            </div>
            <div className="text-muted-foreground">
              {data.created_at ? format(new Date(data.created_at), "dd MMM yyyy, h:mm a") : "—"}
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
