import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Repeat, Users, Percent, IndianRupee, RefreshCw } from "lucide-react";
import { subDays, format } from "date-fns";

const PALETTE = ["#0EA5E9", "#22C55E", "#F59E0B", "#A855F7", "#EF4444", "#14B8A6"];

export default function RevenueTab() {
  const [days, setDays] = useState(30);
  const from = subDays(new Date(), days).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["platform-revenue", days],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("platform_revenue_metrics", { p_from: from, p_to: to });
      if (error) throw error;
      return data as any;
    },
  });

  const m = data || {};
  const planMix: { plan: string; count: number }[] = m.plan_mix || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {[7, 30, 90, 365].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>
              {d}d
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric icon={Repeat} label="MRR" value={`₹${(m.mrr ?? 0).toLocaleString()}`} hint="Monthly recurring" />
        <Metric icon={TrendingUp} label="ARR" value={`₹${(m.arr ?? 0).toLocaleString()}`} hint="Annualised" />
        <Metric icon={Percent} label="Churn" value={`${(m.churn_pct ?? 0).toFixed(1)}%`} hint={`${m.churned_in_period ?? 0} lost / ${days}d`} />
        <Metric icon={Users} label="Trial → Paid" value={`${(m.conversion_pct ?? 0).toFixed(1)}%`} hint="All-time" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Metric icon={IndianRupee} label="Collected in period" value={`₹${(m.paid_in_period ?? 0).toLocaleString()}`} hint={`${format(new Date(from), "MMM d")} – ${format(new Date(to), "MMM d")}`} />
        <Metric icon={Users} label="Active subscriptions" value={m.active_subs ?? 0} hint="Status = active" />
        <Metric icon={Users} label="Plans tracked" value={planMix.length} hint="Distinct active plans" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Plan mix (active subscriptions)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : planMix.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No active subscriptions yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={planMix}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="plan" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {planMix.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1 truncate">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
          </div>
          <Icon className="h-5 w-5 text-primary shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
