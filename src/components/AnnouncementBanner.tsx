import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Info, AlertTriangle, CheckCircle2, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STYLES: Record<string, { bg: string; icon: any }> = {
  info: { bg: "bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-100", icon: Info },
  success: { bg: "bg-green-500/10 border-green-500/30 text-green-900 dark:text-green-100", icon: CheckCircle2 },
  warning: { bg: "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-100", icon: AlertTriangle },
  critical: { bg: "bg-destructive/10 border-destructive/30 text-destructive", icon: AlertOctagon },
};

export default function AnnouncementBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["active-announcements", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const now = new Date().toISOString();
      const [{ data: anns }, { data: dismissed }] = await Promise.all([
        (supabase.from("platform_announcements" as any) as any)
          .select("*")
          .eq("active", true)
          .lte("starts_at", now)
          .order("created_at", { ascending: false }),
        (supabase.from("platform_announcement_dismissals" as any) as any)
          .select("announcement_id").eq("user_id", user.id),
      ]);
      const dismissedSet = new Set((dismissed || []).map((d: any) => d.announcement_id));
      return (anns || []).filter((a: any) => {
        if (dismissedSet.has(a.id)) return false;
        if (a.ends_at && new Date(a.ends_at) < new Date()) return false;
        return true;
      });
    },
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      if (!user) return;
      await (supabase.from("platform_announcement_dismissals" as any) as any)
        .insert({ announcement_id: id, user_id: user.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active-announcements"] }),
  });

  if (!rows.length) return null;
  return (
    <div className="space-y-2 mb-3">
      {rows.map((a: any) => {
        const s = STYLES[a.variant] || STYLES.info;
        const Icon = s.icon;
        return (
          <div key={a.id} className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", s.bg)}>
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{a.title}</p>
              <p className="text-sm opacity-90 mt-0.5 whitespace-pre-wrap">{a.body}</p>
              {a.cta_url && (
                <a href={a.cta_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-sm font-medium underline">
                  {a.cta_label || "Learn more"}
                </a>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => dismiss.mutate(a.id)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
