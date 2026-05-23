import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Filter, CalendarIcon, Sparkles, Coins, Activity, AlertCircle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";

/**
 * Per-clinic AI usage report — filter by clinic, date range, function, and model.
 * Charts daily token consumption and estimated cost (₹), lists individual calls.
 */
export default function ClinicAiReportTab() {
  const [clinicId, setClinicId] = useState<string>("all");
  const [from, setFrom] = useState<Date>(subDays(new Date(), 30));
  const [to, setTo] = useState<Date>(new Date());
  const [fn, setFn] = useState<string>("all");
  const [model, setModel] = useState<string>("all");

  const { data: clinics = [] } = useQuery({
    queryKey: ["report-clinics"],
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("id, name").order("name");
      return (data as any[]) || [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["clinic-ai-report", clinicId, from.toISOString(), to.toISOString(), fn, model],
    queryFn: async () => {
      let q = (supabase.from("ai_usage_log" as any) as any)
        .select("id, clinic_id, function_name, model, prompt_tokens, completion_tokens, total_tokens, cost_inr, status, latency_ms, error_message, created_at")
        .gte("created_at", startOfDay(from).toISOString())
        .lte("created_at", endOfDay(to).toISOString())
        .order("created_at", { ascending: false })
        .limit(5000);
      if (clinicId !== "all") q = q.eq("clinic_id", clinicId);
      if (fn !== "all") q = q.eq("function_name", fn);
      if (model !== "all") q = q.eq("model", model);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Distinct function / model values across selection
  const { data: dimensions = { functions: [], models: [] } } = useQuery({
    queryKey: ["ai-report-dimensions"],
    queryFn: async () => {
      const { data } = await (supabase.from("ai_usage_log" as any) as any)
        .select("function_name, model")
        .limit(2000);
      const fnSet = new Set<string>(), modelSet = new Set<string>();
      ((data as any[]) || []).forEach((r) => { fnSet.add(r.function_name); modelSet.add(r.model); });
      return { functions: Array.from(fnSet).sort(), models: Array.from(modelSet).sort() };
    },
  });

  const clinicNameMap = useMemo(
    () => new Map(clinics.map((c: any) => [c.id, c.name])), [clinics]
  );

  const agg = useMemo(() => {
    const days = eachDayOfInterval({ start: from, end: to });
    const tokensByDay = new Map(days.map(d => [format(d, "MMM d"), { day: format(d, "MMM d"), prompt: 0, completion: 0, total: 0, cost: 0 }]));
    const byFn = new Map<string, { fn: string; requests: number; tokens: number; cost: number }>();
    let tokens = 0, cost = 0, failed = 0;
    rows.forEach((r: any) => {
      const k = format(new Date(r.created_at), "MMM d");
      const bucket = tokensByDay.get(k);
      const t = Number(r.total_tokens || (Number(r.prompt_tokens || 0) + Number(r.completion_tokens || 0)));
      const c = Number(r.cost_inr || 0);
      if (bucket) {
        bucket.prompt += Number(r.prompt_tokens || 0);
        bucket.completion += Number(r.completion_tokens || 0);
        bucket.total += t;
        bucket.cost += c;
      }
      tokens += t;
      cost += c;
      if (r.status !== "success") failed++;
      const cur = byFn.get(r.function_name) || { fn: r.function_name, requests: 0, tokens: 0, cost: 0 };
      cur.requests++; cur.tokens += t; cur.cost += c;
      byFn.set(r.function_name, cur);
    });
    return {
      tokensByDay: Array.from(tokensByDay.values()),
      byFn: Array.from(byFn.values()).sort((a, b) => b.cost - a.cost),
      tokens, cost, failed, requests: rows.length,
    };
  }, [rows, from, to]);

  const exportCsv = () => {
    const header = "created_at,clinic,function,model,prompt_tokens,completion_tokens,total_tokens,cost_inr,status,latency_ms\n";
    const body = rows.map((r: any) => [
      r.created_at,
      JSON.stringify(clinicNameMap.get(r.clinic_id) || r.clinic_id),
      r.function_name, r.model,
      r.prompt_tokens ?? 0, r.completion_tokens ?? 0, r.total_tokens ?? 0,
      r.cost_inr ?? 0, r.status, r.latency_ms ?? "",
    ].join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ai-usage-${format(from, "yyyyMMdd")}-${format(to, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setPreset = (days: number) => { setTo(new Date()); setFrom(subDays(new Date(), days)); };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
            <Filter className="h-3.5 w-3.5" /> Filters
          </div>

          <Select value={clinicId} onValueChange={setClinicId}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Clinic" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clinics</SelectItem>
              {clinics.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DatePicker label="From" date={from} onChange={setFrom} />
          <DatePicker label="To" date={to} onChange={setTo} />

          <Select value={fn} onValueChange={setFn}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Function" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All functions</SelectItem>
              {(dimensions.functions as string[]).map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-[210px] h-9"><SelectValue placeholder="Model" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All models</SelectItem>
              {(dimensions.models as string[]).map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1 ml-auto">
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setPreset(7)}>7d</Button>
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setPreset(30)}>30d</Button>
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setPreset(90)}>90d</Button>
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={exportCsv} disabled={!rows.length}>
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Requests" value={agg.requests} icon={Sparkles} accent="text-primary" />
        <Kpi label="Tokens" value={agg.tokens.toLocaleString()} icon={Activity} accent="text-primary" />
        <Kpi label="Estimated cost" value={`₹${agg.cost.toFixed(2)}`} icon={Coins} accent="text-foreground" />
        <Kpi label="Failed" value={agg.failed} icon={AlertCircle} accent={agg.failed ? "text-destructive" : "text-green-600"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Tokens / day</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={agg.tokensByDay}>
                <defs>
                  <linearGradient id="tok" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(agg.tokensByDay.length / 8))} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#tok)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Estimated cost (₹) / day</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={agg.tokensByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(agg.tokensByDay.length / 8))} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: any) => `₹${Number(v).toFixed(2)}`}
                />
                <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown by function */}
      <Card>
        <CardHeader><CardTitle className="text-base">By function</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agg.byFn.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
              ) : agg.byFn.map((r) => (
                <TableRow key={r.fn}>
                  <TableCell className="font-medium">{r.fn}</TableCell>
                  <TableCell className="text-right">{r.requests}</TableCell>
                  <TableCell className="text-right">{r.tokens.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">₹{r.cost.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Raw log */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent calls (latest 200)</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Clinic</TableHead>
                <TableHead>Function</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No calls in this window</TableCell></TableRow>
              ) : rows.slice(0, 200).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(r.created_at), "MMM d HH:mm")}
                  </TableCell>
                  <TableCell className="text-sm">{clinicNameMap.get(r.clinic_id) || "—"}</TableCell>
                  <TableCell className="text-xs">{r.function_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.model}</TableCell>
                  <TableCell className="text-right">{Number(r.total_tokens || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{Number(r.cost_inr || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      r.status === "success"
                        ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
                        : "bg-destructive/10 text-destructive border-destructive/30"
                    }>{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

function DatePicker({ label, date, onChange }: { label: string; date: Date; onChange: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 text-xs justify-start gap-1.5", !date && "text-muted-foreground")}>
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="text-muted-foreground">{label}:</span>
          {format(date, "MMM d, yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={(d) => d && onChange(d)} initialFocus />
      </PopoverContent>
    </Popover>
  );
}
