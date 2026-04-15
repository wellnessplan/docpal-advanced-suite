import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Pill, Receipt, CalendarDays, MessageSquare, FileCheck } from "lucide-react";

interface TreatmentTimelineProps {
  patientId: string;
}

interface TimelineEvent {
  id: string;
  date: string;
  type: "treatment" | "appointment" | "invoice" | "communication" | "prescription" | "consent";
  title: string;
  detail?: string;
  cost?: number;
  status?: string;
  icon: React.ElementType;
  color: string;
}

export default function TreatmentTimeline({ patientId }: TreatmentTimelineProps) {
  const { data: treatments = [] } = useQuery({
    queryKey: ["timeline-treatments", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("tooth_treatments")
        .select("*, tooth_records!inner(tooth_number)")
        .eq("tooth_records.patient_id", patientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["timeline-appointments", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("appointments")
        .select("*").eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["timeline-invoices", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices")
        .select("*").eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: communications = [] } = useQuery({
    queryKey: ["timeline-comms", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("patient_communications")
        .select("*").eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ["timeline-rx", patientId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("prescriptions")
        .select("*").eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: consents = [] } = useQuery({
    queryKey: ["timeline-consents", patientId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("consent_forms")
        .select("*").eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Merge into unified timeline
  const events: TimelineEvent[] = [
    ...treatments.map((t: any) => ({
      id: `t-${t.id}`, date: t.created_at, type: "treatment" as const,
      title: `${t.treatment_name} — Tooth #${t.tooth_records?.tooth_number}`,
      detail: t.notes, cost: t.cost ? Number(t.cost) : undefined, status: t.status,
      icon: Stethoscope, color: "bg-primary/10 text-primary",
    })),
    ...appointments.map((a: any) => ({
      id: `a-${a.id}`, date: a.created_at, type: "appointment" as const,
      title: `${a.type || "Appointment"} — ${a.appointment_date}`,
      detail: a.notes, status: a.status,
      icon: CalendarDays, color: "bg-accent text-accent-foreground",
    })),
    ...invoices.map((i: any) => ({
      id: `i-${i.id}`, date: i.created_at, type: "invoice" as const,
      title: `Invoice ${i.invoice_number || ""}`, cost: Number(i.total),
      status: i.status, icon: Receipt, color: "bg-warning/10 text-warning",
    })),
    ...communications.map((c: any) => ({
      id: `c-${c.id}`, date: c.created_at, type: "communication" as const,
      title: `${c.type} — ${c.subject || "Message"}`, detail: c.content,
      status: c.status, icon: MessageSquare, color: "bg-success/10 text-success",
    })),
    ...prescriptions.map((p: any) => ({
      id: `p-${p.id}`, date: p.created_at, type: "prescription" as const,
      title: `Prescription${p.chief_complaint ? ` — ${p.chief_complaint}` : ""}`,
      status: p.status, icon: Pill, color: "bg-primary/10 text-primary",
    })),
    ...consents.map((f: any) => ({
      id: `f-${f.id}`, date: f.created_at, type: "consent" as const,
      title: `Consent — ${f.procedure_name}`,
      detail: f.consented_at ? `Signed ${new Date(f.consented_at).toLocaleDateString()}` : "Pending",
      status: f.consented_at ? "signed" : "pending",
      icon: FileCheck, color: "bg-success/10 text-success",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (!events.length) {
    return (
      <Card className="shadow-card border-0">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-30" />
          No history yet. Start from the Dental Chart.
        </CardContent>
      </Card>
    );
  }

  const statusColor = (s?: string) => {
    if (!s) return "";
    if (s === "completed" || s === "paid" || s === "signed" || s === "confirmed") return "bg-success/10 text-success";
    if (s === "planned" || s === "pending" || s === "draft") return "bg-muted text-muted-foreground";
    if (s === "in_progress") return "bg-warning/10 text-warning";
    if (s === "cancelled" || s === "overdue") return "bg-destructive/10 text-destructive";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="relative space-y-0 max-h-[70vh] overflow-y-auto pr-2">
      <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border" />
      {events.map((ev) => {
        const Icon = ev.icon;
        return (
          <div key={ev.id} className="relative pl-12 pb-4">
            <div className={`absolute left-2 top-1 h-6 w-6 rounded-full flex items-center justify-center ${ev.color}`}>
              <Icon className="h-3 w-3" />
            </div>
            <div className="bg-card rounded-lg p-3 shadow-card border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{ev.title}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {ev.cost !== undefined && ev.cost > 0 && (
                    <span className="text-xs font-semibold">Rs {ev.cost.toLocaleString()}</span>
                  )}
                  {ev.status && (
                    <Badge variant="secondary" className={`text-[10px] ${statusColor(ev.status)}`}>
                      {ev.status.replace("_", " ")}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(ev.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {" · "}
                  {new Date(ev.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {ev.detail && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ev.detail}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
