import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope, MessageSquare, Receipt, CalendarDays, FileText, Pill,
} from "lucide-react";

interface AuditTrailTabProps {
  patientId: string;
}

interface AuditEvent {
  id: string;
  date: string;
  type: "treatment" | "communication" | "invoice" | "appointment" | "prescription" | "condition";
  title: string;
  detail: string;
  status?: string;
  amount?: number;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  treatment: { icon: Stethoscope, color: "bg-primary/10 text-primary", label: "Treatment" },
  condition: { icon: FileText, color: "bg-warning/10 text-warning", label: "Condition" },
  communication: { icon: MessageSquare, color: "bg-accent/80 text-accent-foreground", label: "Communication" },
  invoice: { icon: Receipt, color: "bg-success/10 text-success", label: "Invoice" },
  appointment: { icon: CalendarDays, color: "bg-secondary text-secondary-foreground", label: "Appointment" },
  prescription: { icon: Pill, color: "bg-destructive/10 text-destructive", label: "Prescription" },
};

export default function AuditTrailTab({ patientId }: AuditTrailTabProps) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["audit-trail", patientId],
    queryFn: async () => {
      const items: AuditEvent[] = [];

      // Fetch all in parallel
      const [treatmentsRes, conditionsRes, commsRes, invoicesRes, appointmentsRes, prescriptionsRes] =
        await Promise.all([
          supabase
            .from("tooth_treatments")
            .select("id, treatment_name, status, cost, created_at, tooth_records!inner(tooth_number)")
            .eq("tooth_records.patient_id", patientId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("tooth_conditions")
            .select("id, condition_name, severity, surface, created_at, tooth_records!inner(tooth_number)")
            .eq("tooth_records.patient_id", patientId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("patient_communications")
            .select("*")
            .eq("patient_id", patientId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("invoices")
            .select("*")
            .eq("patient_id", patientId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("appointments")
            .select("*")
            .eq("patient_id", patientId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("prescriptions")
            .select("id, chief_complaint, status, created_at")
            .eq("patient_id", patientId)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

      treatmentsRes.data?.forEach((t: any) =>
        items.push({
          id: `tx-${t.id}`,
          date: t.created_at,
          type: "treatment",
          title: t.treatment_name,
          detail: `Tooth #${t.tooth_records?.tooth_number}`,
          status: t.status,
          amount: t.cost ? Number(t.cost) : undefined,
        })
      );

      conditionsRes.data?.forEach((c: any) =>
        items.push({
          id: `dx-${c.id}`,
          date: c.created_at,
          type: "condition",
          title: c.condition_name,
          detail: `Tooth #${c.tooth_records?.tooth_number}${c.surface ? ` · ${c.surface}` : ""}`,
          status: c.severity,
        })
      );

      commsRes.data?.forEach((c: any) =>
        items.push({
          id: `comm-${c.id}`,
          date: c.created_at,
          type: "communication",
          title: `${c.type} — ${c.direction || "outbound"}`,
          detail: c.subject || c.content?.slice(0, 60) || "No content",
          status: c.status,
        })
      );

      invoicesRes.data?.forEach((i: any) =>
        items.push({
          id: `inv-${i.id}`,
          date: i.created_at,
          type: "invoice",
          title: i.invoice_number || "Invoice",
          detail: `₹${Number(i.total || i.amount).toLocaleString()}`,
          status: i.status,
          amount: Number(i.total || i.amount),
        })
      );

      appointmentsRes.data?.forEach((a: any) =>
        items.push({
          id: `apt-${a.id}`,
          date: a.created_at,
          type: "appointment",
          title: a.type || "Appointment",
          detail: `${a.appointment_date} at ${a.appointment_time}`,
          status: a.status,
        })
      );

      prescriptionsRes.data?.forEach((p: any) =>
        items.push({
          id: `rx-${p.id}`,
          date: p.created_at,
          type: "prescription",
          title: p.chief_complaint || "Prescription",
          detail: "",
          status: p.status,
        })
      );

      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return items;
    },
    enabled: !!patientId,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Loading audit trail…</div>;
  }

  if (!events.length) {
    return (
      <Card className="shadow-card border-0">
        <CardContent className="py-12 text-center text-muted-foreground">
          No activity recorded for this patient yet.
        </CardContent>
      </Card>
    );
  }

  // Group by date
  const grouped: Record<string, AuditEvent[]> = {};
  events.forEach((e) => {
    const day = new Date(e.date).toLocaleDateString("en-IN", {
      year: "numeric", month: "short", day: "numeric",
    });
    (grouped[day] ??= []).push(e);
  });

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([day, dayEvents]) => (
        <div key={day}>
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-1 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{day}</span>
          </div>
          <div className="relative ml-3 border-l-2 border-muted pl-4 space-y-3">
            {dayEvents.map((ev) => {
              const cfg = TYPE_CONFIG[ev.type];
              const Icon = cfg.icon;
              return (
                <div key={ev.id} className="relative flex items-start gap-3">
                  <div className={`absolute -left-[25px] top-1 h-5 w-5 rounded-full flex items-center justify-center ${cfg.color}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{ev.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{cfg.label}</Badge>
                      {ev.status && (
                        <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
                          {ev.status.replace("_", " ")}
                        </Badge>
                      )}
                      {ev.amount !== undefined && (
                        <span className="text-xs font-medium text-muted-foreground ml-auto">
                          ₹{ev.amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {ev.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{ev.detail}</p>
                    )}
                    <span className="text-[10px] text-muted-foreground/60">
                      {new Date(ev.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
