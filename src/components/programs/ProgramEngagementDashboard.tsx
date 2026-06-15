import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { BarChart3, MessageSquare, CheckCircle2, Eye, Reply, XCircle } from "lucide-react";

interface Row {
  clinic_id: string; program_id: string | null;
  program_name: string | null; emoji: string | null;
  month: string;
  total_sent: number; delivered: number; read_count: number; replied: number; failed: number;
}

const MONTH_FMT = (s: string) =>
  new Date(s).toLocaleString("en-US", { month: "short", year: "2-digit" });

export default function ProgramEngagementDashboard() {
  const { clinicId } = useAuth();

  const { data: rows } = useQuery({
    queryKey: ["program_engagement", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      const { data } = await (supabase.from("engagement_program_dashboard") as any)
        .select("*").eq("clinic_id", clinicId)
        .gte("month", since.toISOString())
        .order("month");
      return (data ?? []) as Row[];
    },
    enabled: !!clinicId,
  });

  const totals = useMemo(() => {
    const r = rows ?? [];
    return {
      sent: r.reduce((s, x) => s + (x.total_sent || 0), 0),
      delivered: r.reduce((s, x) => s + (x.delivered || 0), 0),
      read: r.reduce((s, x) => s + (x.read_count || 0), 0),
      replied: r.reduce((s, x) => s + (x.replied || 0), 0),
      failed: r.reduce((s, x) => s + (x.failed || 0), 0),
    };
  }, [rows]);

  // Group by month for the chart
  const monthly = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of rows ?? []) {
      const key = MONTH_FMT(r.month);
      map[key] = map[key] ?? { month: key, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 };
      map[key].sent += r.total_sent || 0;
      map[key].delivered += r.delivered || 0;
      map[key].read += r.read_count || 0;
      map[key].replied += r.replied || 0;
      map[key].failed += r.failed || 0;
    }
    return Object.values(map);
  }, [rows]);

  // Per-program aggregate
  const perProgram = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of rows ?? []) {
      const k = r.program_id ?? "_";
      map[k] = map[k] ?? {
        program: r.program_name ?? "Other", emoji: r.emoji ?? "🦷",
        sent: 0, delivered: 0, read: 0, replied: 0, failed: 0,
      };
      map[k].sent += r.total_sent || 0;
      map[k].delivered += r.delivered || 0;
      map[k].read += r.read_count || 0;
      map[k].replied += r.replied || 0;
      map[k].failed += r.failed || 0;
    }
    return Object.values(map);
  }, [rows]);

  const pct = (n: number, d: number) => d ? Math.round((n / d) * 100) : 0;

  const kpi = (icon: React.ReactNode, label: string, val: number, sub?: string) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground">{icon}</div>
          <Badge variant="outline" className="text-[10px]">{label}</Badge>
        </div>
        <div className="text-2xl font-semibold mt-2 font-mono">{val.toLocaleString()}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Engagement (last 6 months)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {kpi(<MessageSquare className="h-4 w-4" />, "Sent", totals.sent)}
          {kpi(<CheckCircle2 className="h-4 w-4" />, "Delivered", totals.delivered, `${pct(totals.delivered, totals.sent)}%`)}
          {kpi(<Eye className="h-4 w-4" />, "Read", totals.read, `${pct(totals.read, totals.sent)}%`)}
          {kpi(<Reply className="h-4 w-4" />, "Replied", totals.replied, `${pct(totals.replied, totals.sent)}%`)}
          {kpi(<XCircle className="h-4 w-4" />, "Failed", totals.failed, `${pct(totals.failed, totals.sent)}%`)}
        </div>

        <div className="h-64">
          {monthly.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No campaign sends yet. Schedule a post to start tracking.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sent" fill="hsl(197 71% 63%)" />
                <Bar dataKey="delivered" fill="hsl(150 60% 50%)" />
                <Bar dataKey="read" fill="hsl(45 90% 55%)" />
                <Bar dataKey="replied" fill="hsl(280 60% 60%)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {perProgram.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">PER PROGRAM</div>
            {(perProgram as any[]).map((p) => (
              <div key={p.program} className="flex items-center justify-between border-b py-1.5 last:border-0 text-sm">
                <div className="flex items-center gap-2"><span>{p.emoji}</span><span className="font-medium">{p.program}</span></div>
                <div className="flex gap-3 text-xs font-mono">
                  <span>{p.sent} sent</span>
                  <span className="text-success">{pct(p.delivered, p.sent)}% delivered</span>
                  <span className="text-warning">{pct(p.read, p.sent)}% read</span>
                  <span className="text-primary">{pct(p.replied, p.sent)}% replied</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
