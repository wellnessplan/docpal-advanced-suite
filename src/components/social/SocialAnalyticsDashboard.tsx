import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, MousePointerClick, Heart, CheckCircle2, XCircle, Clock, Facebook, Instagram, Twitter, Linkedin } from "lucide-react";
import { format } from "date-fns";

const PLATFORM_ICONS: Record<string, any> = {
  Facebook, Instagram, Twitter, LinkedIn: Linkedin,
};

const STATUS_COLOR: Record<string, string> = {
  success: "bg-green-500/15 text-green-700 dark:text-green-300",
  failed: "bg-destructive/15 text-destructive",
  error: "bg-destructive/15 text-destructive",
};

export function SocialAnalyticsDashboard({ clinicId }: { clinicId: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["social-analytics", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_post_analytics")
        .select("*, social_posts(caption, scheduled_at, campaign_name, status)")
        .eq("clinic_id", clinicId)
        .order("webhook_fired_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinicId,
  });

  const byPlatform = useMemo(() => {
    const map: Record<string, { clicks: number; impressions: number; engagement: number; posts: number; success: number; failed: number }> = {};
    rows.forEach(r => {
      const p = r.platform;
      const m = (map[p] ||= { clicks: 0, impressions: 0, engagement: 0, posts: 0, success: 0, failed: 0 });
      m.clicks += r.clicks || 0;
      m.impressions += r.impressions || 0;
      m.engagement += r.engagement || 0;
      m.posts += 1;
      if (r.webhook_status === "success") m.success += 1;
      else if (r.webhook_status) m.failed += 1;
    });
    return map;
  }, [rows]);

  const totals = useMemo(() => {
    return Object.values(byPlatform).reduce(
      (a, b) => ({
        clicks: a.clicks + b.clicks,
        impressions: a.impressions + b.impressions,
        engagement: a.engagement + b.engagement,
        posts: a.posts + b.posts,
        success: a.success + b.success,
        failed: a.failed + b.failed,
      }),
      { clicks: 0, impressions: 0, engagement: 0, posts: 0, success: 0, failed: 0 },
    );
  }, [byPlatform]);

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Impressions" value={totals.impressions} icon={Eye} />
        <KpiCard label="Clicks" value={totals.clicks} icon={MousePointerClick} />
        <KpiCard label="Engagement" value={totals.engagement} icon={Heart} />
        <KpiCard label="Webhook success rate" value={totals.posts ? `${Math.round((totals.success / totals.posts) * 100)}%` : "—"} icon={CheckCircle2} />
      </div>

      {/* Per platform */}
      <Card>
        <CardHeader><CardTitle className="text-base">Per platform</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(byPlatform).length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No analytics yet. Fire some webhooks to populate data.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(byPlatform).map(([platform, m]) => {
                const Icon = PLATFORM_ICONS[platform];
                return (
                  <div key={platform} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2 font-medium">
                      {Icon && <Icon className="w-4 h-4" />}
                      {platform}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <Stat label="Impr" value={m.impressions} />
                      <Stat label="Clicks" value={m.clicks} />
                      <Stat label="Engmt" value={m.engagement} />
                    </div>
                    <div className="flex gap-1 text-[10px]">
                      <Badge className="bg-green-500/15 text-green-700 dark:text-green-300">{m.success} ok</Badge>
                      <Badge className="bg-destructive/15 text-destructive">{m.failed} fail</Badge>
                      <Badge variant="outline">{m.posts} posts</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent webhook log */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent webhook deliveries</CardTitle></CardHeader>
        <CardContent className="p-0 divide-y divide-border max-h-96 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Nothing here yet.</div>
          ) : rows.slice(0, 50).map(r => {
            const Icon = PLATFORM_ICONS[r.platform];
            const StatusIcon = r.webhook_status === "success" ? CheckCircle2 : r.webhook_status ? XCircle : Clock;
            return (
              <div key={r.id} className="p-3 flex items-center gap-3 text-sm">
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{(r as any).social_posts?.caption || "Untitled"}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.webhook_fired_at ? format(new Date(r.webhook_fired_at), "MMM d, HH:mm") : "Not fired"}
                    {r.webhook_status_code ? ` • HTTP ${r.webhook_status_code}` : ""}
                  </div>
                </div>
                <div className="hidden sm:flex gap-3 text-xs text-muted-foreground">
                  <span>{r.impressions} impr</span>
                  <span>{r.clicks} clk</span>
                </div>
                <Badge className={STATUS_COLOR[r.webhook_status || ""] || "bg-muted text-muted-foreground"}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {r.webhook_status || "pending"}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: any; icon: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold mt-1">{value}</div>
          </div>
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
