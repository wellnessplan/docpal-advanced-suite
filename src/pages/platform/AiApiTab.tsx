import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Sparkles, AlertCircle, CheckCircle, RefreshCw, Activity, MessageSquare } from "lucide-react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";

export default function AiApiTab() {
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; ms?: number; error?: string } | null>(null);

  const { data: usage = [], isLoading } = useQuery({
    queryKey: ["admin-ai-usage-30d"],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await (supabase.from("ai_usage_log" as any) as any)
        .select("clinic_id, function_name, model, prompt_tokens, completion_tokens, cost_inr, status, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: clinics = [] } = useQuery({
    queryKey: ["admin-clinic-names"],
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("id, name");
      return new Map((data || []).map((c: any) => [c.id, c.name]));
    },
  });

  const { data: whatsappStats } = useQuery({
    queryKey: ["admin-whatsapp-7d"],
    queryFn: async () => {
      const since = subDays(new Date(), 7).toISOString();
      const { data } = await supabase
        .from("whatsapp_logs" as any)
        .select("delivery_status")
        .gte("created_at", since);
      const out: Record<string, number> = { queued: 0, sent: 0, delivered: 0, failed: 0 };
      ((data as any[]) || []).forEach((r) => {
        out[r.delivery_status || "queued"] = (out[r.delivery_status || "queued"] || 0) + 1;
      });
      return out;
    },
  });

  // Aggregate
  const totals = useMemo(() => {
    const reqsByDay = new Map<string, number>();
    for (let i = 29; i >= 0; i--) reqsByDay.set(format(subDays(new Date(), i), "MMM d"), 0);
    let totalCost = 0, totalTokens = 0, failed = 0;
    const byClinic = new Map<string, { clinic_id: string; requests: number; cost: number; tokens: number }>();
    const byModel = new Map<string, number>();
    usage.forEach((r: any) => {
      const k = format(new Date(r.created_at), "MMM d");
      if (reqsByDay.has(k)) reqsByDay.set(k, (reqsByDay.get(k) || 0) + 1);
      totalCost += Number(r.cost_inr || 0);
      totalTokens += Number(r.prompt_tokens || 0) + Number(r.completion_tokens || 0);
      if (r.status !== "success") failed++;
      const cur = byClinic.get(r.clinic_id) || { clinic_id: r.clinic_id, requests: 0, cost: 0, tokens: 0 };
      cur.requests++; cur.cost += Number(r.cost_inr || 0);
      cur.tokens += Number(r.prompt_tokens || 0) + Number(r.completion_tokens || 0);
      byClinic.set(r.clinic_id, cur);
      byModel.set(r.model, (byModel.get(r.model) || 0) + 1);
    });
    return {
      reqsByDay: Array.from(reqsByDay.entries()).map(([day, requests]) => ({ day, requests })),
      totalCost, totalTokens, failed,
      topClinics: Array.from(byClinic.values()).sort((a, b) => b.cost - a.cost).slice(0, 10),
      modelMix: Array.from(byModel.entries()).map(([model, count]) => ({ model, count })),
    };
  }, [usage]);

  const pingGateway = async () => {
    setPinging(true); setPingResult(null);
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("ai-ping", { body: {} });
      const ms = Math.round(performance.now() - t0);
      if (error) throw error;
      setPingResult({ ok: data?.ok === true, ms, error: data?.error });
      if (data?.ok) toast.success(`Gateway healthy (${ms}ms)`);
      else toast.error(data?.error || "Gateway returned an error");
    } catch (e: any) {
      setPingResult({ ok: false, error: e.message });
      toast.error(e.message);
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="AI requests (30d)" value={usage.length} icon={Sparkles} accent="text-primary" />
        <Kpi label="Tokens (30d)" value={totals.totalTokens.toLocaleString()} icon={Activity} accent="text-primary" />
        <Kpi label="Spend (30d)" value={`₹${totals.totalCost.toFixed(2)}`} icon={Sparkles} accent="text-foreground" />
        <Kpi label="Failed calls" value={totals.failed} icon={AlertCircle}
          accent={totals.failed > 0 ? "text-destructive" : "text-green-600"} />
      </div>

      {/* Gateway health */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Lovable AI Gateway
          </CardTitle>
          <Button size="sm" variant="outline" onClick={pingGateway} disabled={pinging}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${pinging ? "animate-spin" : ""}`} />
            Ping gateway
          </Button>
        </CardHeader>
        <CardContent>
          {pingResult ? (
            <div className="flex items-center gap-2 text-sm">
              {pingResult.ok ? (
                <><CheckCircle className="h-4 w-4 text-green-600" /> Healthy · {pingResult.ms}ms</>
              ) : (
                <><AlertCircle className="h-4 w-4 text-destructive" /> {pingResult.error || "Unhealthy"}</>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Click "Ping gateway" to verify LOVABLE_API_KEY and connectivity.</p>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">AI requests / day (30d)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={totals.reqsByDay}>
                <defs>
                  <linearGradient id="ai" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="requests" stroke="hsl(var(--primary))" fill="url(#ai)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Model mix (30d)</CardTitle></CardHeader>
          <CardContent>
            {totals.modelMix.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No AI calls logged yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={totals.modelMix} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="model" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top clinics by spend */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top clinics by AI spend (30d)</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : totals.topClinics.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No AI usage in last 30 days</TableCell></TableRow>
              ) : totals.topClinics.map((c) => (
                <TableRow key={c.clinic_id}>
                  <TableCell className="font-medium">{(clinics as Map<string,string>).get?.(c.clinic_id) || c.clinic_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-right">{c.requests}</TableCell>
                  <TableCell className="text-right">{c.tokens.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">₹{c.cost.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* WhatsApp / integrations health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> WhatsApp delivery (last 7 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatPill label="Queued" value={whatsappStats?.queued ?? 0} tone="bg-blue-500/10 text-blue-700 dark:text-blue-300" />
            <StatPill label="Sent" value={whatsappStats?.sent ?? 0} tone="bg-amber-500/10 text-amber-700 dark:text-amber-300" />
            <StatPill label="Delivered" value={whatsappStats?.delivered ?? 0} tone="bg-green-500/10 text-green-700 dark:text-green-300" />
            <StatPill label="Failed" value={whatsappStats?.failed ?? 0} tone="bg-destructive/10 text-destructive" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent }: { label: string; value: any; icon: any; accent: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold mt-0.5 truncate">{value}</p>
        </div>
        <Icon className={`h-5 w-5 shrink-0 ${accent}`} />
      </CardContent>
    </Card>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg px-4 py-3 ${tone}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
