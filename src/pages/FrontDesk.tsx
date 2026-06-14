import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { arrivePatient } from "@/lib/queue-sync";
import { toast } from "sonner";
import {
  CalendarClock, ListOrdered, IndianRupee, LogIn, Plus, Search,
  Phone, ChevronRight, Clock, CheckCircle, Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusStyle: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary",
  confirmed: "bg-primary/10 text-primary",
  checked_in: "bg-warning/10 text-warning",
  in_progress: "bg-info/10 text-info",
  waiting: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  no_show: "bg-muted text-muted-foreground",
};

export default function FrontDesk() {
  const { clinicId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: appts = [] } = useQuery({
    queryKey: ["fd-appts", clinicId, today],
    queryFn: async () => {
      const { data } = await supabase.from("appointments")
        .select("*, patients(id, full_name, phone)")
        .eq("clinic_id", clinicId!).eq("appointment_date", today)
        .order("appointment_time", { ascending: true });
      return data ?? [];
    },
    enabled: !!clinicId,
    refetchInterval: 30000,
  });

  const { data: queue = [] } = useQuery({
    queryKey: ["fd-queue", clinicId, today],
    queryFn: async () => {
      const { data } = await supabase.from("queue_tokens")
        .select("*, patients(full_name, phone)")
        .eq("clinic_id", clinicId!).eq("queue_date", today)
        .order("token_number", { ascending: true });
      return data ?? [];
    },
    enabled: !!clinicId,
    refetchInterval: 15000,
  });

  const { data: pendingInvoices = [] } = useQuery({
    queryKey: ["fd-pending-inv", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices")
        .select("id, total, paid_amount, invoice_number, status, patient_id, patients(full_name, phone)")
        .eq("clinic_id", clinicId!)
        .in("status", ["unpaid", "partial", "pending"] as any)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const filter = (arr: any[], path = "patients.full_name") =>
    !search.trim() ? arr : arr.filter((x: any) => {
      const name = x.patients?.full_name?.toLowerCase() || "";
      const phone = x.patients?.phone || "";
      const q = search.toLowerCase();
      return name.includes(q) || phone.includes(search);
    });

  const apptsF = useMemo(() => filter(appts), [appts, search]);
  const queueF = useMemo(() => filter(queue), [queue, search]);
  const invF = useMemo(() => filter(pendingInvoices), [pendingInvoices, search]);

  const stats = {
    today: appts.length,
    arrived: appts.filter((a: any) => ["checked_in", "in_progress"].includes(a.status)).length,
    waiting: queue.filter((q: any) => q.status === "waiting").length,
    dues: pendingInvoices.reduce((s: number, i: any) => s + (Number(i.total) - Number(i.paid_amount || 0)), 0),
  };

  const handleArrive = async (apt: any) => {
    if (!clinicId) return;
    try {
      const r = await arrivePatient({ clinicId, patientId: apt.patient_id, appointmentId: apt.id });
      toast.success(r.reused ? `Already in queue (#${r.token_number})` : `Token #${r.token_number} assigned`);
      qc.invalidateQueries({ queryKey: ["fd-appts"] });
      qc.invalidateQueries({ queryKey: ["fd-queue"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const advanceToken = async (t: any) => {
    const next = t.status === "waiting" ? "in_progress" : "completed";
    const updates: any = { status: next };
    if (next === "in_progress") updates.called_at = new Date().toISOString();
    if (next === "completed") updates.completed_at = new Date().toISOString();
    await supabase.from("queue_tokens").update(updates).eq("id", t.id);
    qc.invalidateQueries({ queryKey: ["fd-queue"] });
    toast.success(`Token #${t.token_number} → ${next.replace("_", " ")}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Front Desk</h1>
            <p className="text-muted-foreground text-xs md:text-sm">{format(new Date(), "EEEE, dd MMM yyyy")}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate("/patients?new=1")} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Walk-in
            </Button>
            <Button size="sm" onClick={() => navigate("/appointments")} className="gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> New Appt
            </Button>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground font-semibold">Today</p><p className="text-2xl font-bold font-heading">{stats.today}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground font-semibold">Arrived</p><p className="text-2xl font-bold font-heading text-warning">{stats.arrived}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground font-semibold">In Queue</p><p className="text-2xl font-bold font-heading text-info">{stats.waiting}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground font-semibold">Open Dues</p><p className="text-2xl font-bold font-heading text-destructive">₹{stats.dues.toLocaleString()}</p></CardContent></Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone…" className="pl-9 h-10" inputMode={/^\d/.test(search) ? "tel" : "text"} />
        </div>

        {/* 3-column layout */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Today's appointments */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> Today's Schedule <Badge variant="secondary" className="ml-auto">{apptsF.length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
              {apptsF.length === 0 ? <p className="text-xs text-muted-foreground py-4 text-center">Nothing scheduled</p> :
                apptsF.map((a: any) => {
                  const canArrive = ["scheduled", "confirmed"].includes(a.status);
                  return (
                    <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/70 group cursor-pointer" onClick={() => navigate(`/patients/${a.patient_id}`)}>
                      <div className="min-w-[44px] text-center">
                        <p className="text-xs font-bold">{a.appointment_time?.slice(0, 5)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.patients?.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.type || "Checkup"}</p>
                      </div>
                      {canArrive ? (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={(e) => { e.stopPropagation(); handleArrive(a); }}>
                          <LogIn className="h-3 w-3 mr-1" /> Arrive
                        </Button>
                      ) : (
                        <Badge variant="secondary" className={cn("text-[9px] capitalize", statusStyle[a.status])}>{a.status?.replace(/_/g, " ")}</Badge>
                      )}
                    </div>
                  );
                })}
            </CardContent>
          </Card>

          {/* Live queue */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ListOrdered className="h-4 w-4 text-info" /> Live Queue <Badge variant="secondary" className="ml-auto">{queueF.length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
              {queueF.length === 0 ? <p className="text-xs text-muted-foreground py-4 text-center">Queue empty</p> :
                queueF.map((t: any) => (
                  <div key={t.id} className={cn("flex items-center gap-2 p-2 rounded-lg", t.status === "in_progress" ? "bg-info/10 ring-1 ring-info/30" : "bg-muted/40")}>
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">#{t.token_number}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.patients?.full_name}</p>
                      <Badge variant="secondary" className={cn("text-[9px] capitalize mt-0.5", statusStyle[t.status])}>{t.status?.replace(/_/g, " ")}</Badge>
                    </div>
                    {t.status !== "completed" && t.status !== "cancelled" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => advanceToken(t)}>
                        {t.status === "waiting" ? <Play className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* Pending payments */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><IndianRupee className="h-4 w-4 text-destructive" /> Open Dues <Badge variant="secondary" className="ml-auto">{invF.length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
              {invF.length === 0 ? <p className="text-xs text-muted-foreground py-4 text-center">All clear 🎉</p> :
                invF.map((i: any) => {
                  const balance = Number(i.total) - Number(i.paid_amount || 0);
                  return (
                    <div key={i.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/70 cursor-pointer" onClick={() => navigate(`/patients/${i.patient_id}?tab=billing`)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{i.patients?.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{i.invoice_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-destructive">₹{balance.toLocaleString()}</p>
                        <Badge variant="secondary" className={cn("text-[9px]", statusStyle[i.status])}>{i.status}</Badge>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
