import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Heart, AlertTriangle, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function TenantHealthTab() {
  const [search, setSearch] = useState("");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["tenant-health"],
    queryFn: async () => ((await supabase.from("tenant_health" as any).select("*").order("appts_30d", { ascending: false })).data as any[]) || [],
  });

  const scored = useMemo(() => rows.map((r: any) => {
    let score = 100;
    const lastAppt = r.last_appointment_at ? new Date(r.last_appointment_at).getTime() : 0;
    const daysSince = lastAppt ? (Date.now() - lastAppt) / 86400000 : 999;
    if (daysSince > 14) score -= 30;
    else if (daysSince > 7) score -= 15;
    if (r.appts_7d === 0) score -= 20;
    if ((r.failures_7d || 0) > 5) score -= 15;
    if ((r.unresolved_errors_7d || 0) > 5) score -= 15;
    if (r.subscription_status === "suspended") score -= 30;
    return { ...r, daysSince, score: Math.max(0, score), atRisk: score < 50 };
  }), [rows]);

  const filtered = scored.filter((r: any) => !search || r.name?.toLowerCase().includes(search.toLowerCase()));
  const atRiskCount = scored.filter((r: any) => r.atRisk).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total tenants</p><p className="text-2xl font-bold">{scored.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Healthy</p><p className="text-2xl font-bold text-green-600">{scored.length - atRiskCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">At risk</p><p className="text-2xl font-bold text-destructive">{atRiskCount}</p></CardContent></Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Search clinic…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Last appt</TableHead>
                <TableHead className="text-right">Appts 7d</TableHead>
                <TableHead className="text-right">Appts 30d</TableHead>
                <TableHead className="text-right">Patients</TableHead>
                <TableHead className="text-right">Staff</TableHead>
                <TableHead className="text-right">Failures 7d</TableHead>
                <TableHead className="text-right">Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No clinics</TableCell></TableRow>
              ) : filtered.map((r: any) => (
                <TableRow key={r.clinic_id}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{r.subscription_status || "no sub"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {r.atRisk ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Heart className="h-4 w-4 text-green-600" />}
                      <Badge variant="outline" className={r.atRisk ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-green-500/15 text-green-700 border-green-500/30"}>
                        {r.score}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.last_appointment_at ? formatDistanceToNow(new Date(r.last_appointment_at), { addSuffix: true }) : "never"}</TableCell>
                  <TableCell className="text-right">{r.appts_7d}</TableCell>
                  <TableCell className="text-right">{r.appts_30d}</TableCell>
                  <TableCell className="text-right">{r.patient_count}</TableCell>
                  <TableCell className="text-right">{r.staff_count}</TableCell>
                  <TableCell className="text-right text-destructive">{r.failures_7d || 0}</TableCell>
                  <TableCell className="text-right text-destructive">{r.unresolved_errors_7d || 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
