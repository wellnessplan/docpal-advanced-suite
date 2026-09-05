import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bot, Play, Loader2, ShieldCheck, CalendarDays, Users, Receipt, Activity } from "lucide-react";

type ToolKey = "clinic_snapshot" | "list_appointments" | "list_patients" | "list_invoices";

const TOOLS: { key: ToolKey; title: string; description: string; icon: typeof Bot }[] = [
  { key: "clinic_snapshot", title: "clinic_snapshot", description: "Today's appointments, live queue, new patients and money collected.", icon: Activity },
  { key: "list_appointments", title: "list_appointments", description: "Schedule for a chosen date, with patient name, time and status.", icon: CalendarDays },
  { key: "list_patients", title: "list_patients", description: "Recent patient records, searchable by name or phone.", icon: Users },
  { key: "list_invoices", title: "list_invoices", description: "Recent bills with totals, amount paid and outstanding balance.", icon: Receipt },
];

export default function AgentPreview() {
  const { clinicId } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [running, setRunning] = useState<ToolKey | null>(null);
  const [results, setResults] = useState<Partial<Record<ToolKey, unknown>>>({});

  const run = async (key: ToolKey) => {
    if (!clinicId) return;
    setRunning(key);
    try {
      let payload: unknown = null;

      if (key === "clinic_snapshot") {
        const monthStart = date.slice(0, 8) + "01";
        const [appts, queue, patients, invoices] = await Promise.all([
          supabase.from("appointments").select("status").eq("clinic_id", clinicId).eq("appointment_date", date),
          supabase.from("queue_tokens").select("status").eq("clinic_id", clinicId).eq("queue_date", date),
          supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).gte("created_at", `${monthStart}T00:00:00Z`),
          supabase.from("invoices").select("total, paid_amount, balance").eq("clinic_id", clinicId).gte("invoice_date", monthStart),
        ]);
        const rows = invoices.data ?? [];
        const byStatus = (list: { status: string | null }[] | null) =>
          (list ?? []).reduce<Record<string, number>>((acc, r) => {
            const k = r.status ?? "unknown";
            acc[k] = (acc[k] ?? 0) + 1;
            return acc;
          }, {});
        payload = {
          date,
          appointments_today: { total: appts.data?.length ?? 0, by_status: byStatus(appts.data) },
          queue_today: { total: queue.data?.length ?? 0, by_status: byStatus(queue.data) },
          new_patients_this_month: patients.count ?? 0,
          billing_this_month: {
            invoiced: rows.reduce((s, r) => s + Number(r.total ?? 0), 0),
            collected: rows.reduce((s, r) => s + Number(r.paid_amount ?? 0), 0),
            outstanding: rows.reduce((s, r) => s + Number(r.balance ?? 0), 0),
          },
        };
      }

      if (key === "list_appointments") {
        const { data } = await supabase
          .from("appointments")
          .select("id, appointment_date, appointment_time, duration_minutes, type, status, patients(full_name, phone)")
          .eq("clinic_id", clinicId)
          .eq("appointment_date", date)
          .order("appointment_time", { ascending: true })
          .limit(50);
        payload = { date, count: data?.length ?? 0, appointments: data ?? [] };
      }

      if (key === "list_patients") {
        let q = supabase
          .from("patients")
          .select("id, full_name, phone, gender, date_of_birth, op_number, created_at")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(25);
        if (search.trim()) q = q.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`);
        const { data } = await q;
        payload = { query: search.trim() || null, count: data?.length ?? 0, patients: data ?? [] };
      }

      if (key === "list_invoices") {
        const { data } = await supabase
          .from("invoices")
          .select("id, invoice_number, invoice_date, total, paid_amount, balance, status, patients(full_name, phone)")
          .eq("clinic_id", clinicId)
          .order("invoice_date", { ascending: false })
          .limit(25);
        payload = { count: data?.length ?? 0, invoices: data ?? [] };
      }

      setResults((prev) => ({ ...prev, [key]: payload }));
    } finally {
      setRunning(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-start gap-3 flex-wrap justify-between">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl gradient-primary flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">Assistant preview</h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Run each assistant skill and see exactly what an AI assistant receives from your clinic — nothing more.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary bg-primary/5">
            <ShieldCheck className="h-3.5 w-3.5" /> Your clinic only
          </Badge>
        </div>

        <Card className="shadow-card border-0">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Date</p>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-[160px] text-sm" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Patient search</p>
              <Input
                placeholder="Name or phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-[220px] text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {TOOLS.map((tool) => {
            const result = results[tool.key];
            return (
              <Card key={tool.key} className="shadow-card border-0 flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-3 text-base font-heading">
                    <span className="flex items-center gap-2">
                      <tool.icon className="h-4 w-4 text-primary" />
                      {tool.title}
                    </span>
                    <Button size="sm" onClick={() => run(tool.key)} disabled={running === tool.key || !clinicId}>
                      {running === tool.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 mr-1" /> Run
                        </>
                      )}
                    </Button>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{tool.description}</p>
                </CardHeader>
                <CardContent className="flex-1">
                  {result === undefined ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                      Not run yet
                    </div>
                  ) : (
                    <pre className="max-h-72 overflow-auto rounded-lg bg-muted/50 p-3 text-[11px] font-mono leading-relaxed">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
