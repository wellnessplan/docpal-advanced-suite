import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertTriangle, UserX, Clock, CalendarClock, Phone,
  MessageCircle, CheckCircle2, Loader2
} from "lucide-react";

type FollowUpType = "no_show" | "incomplete" | "reschedule";

interface FollowUpItem {
  id: string;
  type: FollowUpType;
  patientName: string;
  patientPhone: string | null;
  detail: string;
  priority: "high" | "medium" | "low";
  patientId: string;
}

const TYPE_CONFIG: Record<FollowUpType, { label: string; icon: React.ReactNode; badgeClass: string }> = {
  no_show: {
    label: "No Show",
    icon: <UserX className="w-4 h-4 text-red-500" />,
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  },
  incomplete: {
    label: "Incomplete Treatment",
    icon: <Clock className="w-4 h-4 text-amber-500" />,
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  reschedule: {
    label: "Reschedule",
    icon: <CalendarClock className="w-4 h-4 text-blue-500" />,
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "bg-red-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-primary text-primary-foreground",
};

export default function TasksPage() {
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | FollowUpType>("all");

  // Fetch no-show appointments (status = 'no-show' or 'no_show', last 30 days)
  const { data: noShows, isLoading: loadingNS } = useQuery({
    queryKey: ["followup-noshows", clinicId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from("appointments")
        .select("id, patient_id, appointment_date, appointment_time, type, patients(full_name, phone)")
        .eq("clinic_id", clinicId!)
        .in("status", ["no-show", "no_show", "No Show"])
        .gte("appointment_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("appointment_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Fetch incomplete treatments (status = 'planned' or 'in-progress')
  const { data: incompleteTx, isLoading: loadingTx } = useQuery({
    queryKey: ["followup-incomplete", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tooth_treatments")
        .select("id, treatment_name, status, tooth_record_id, tooth_records(tooth_number, patient_id, clinic_id, patients(full_name, phone))")
        .in("status", ["planned", "in-progress", "in_progress"])
        .order("created_at", { ascending: false });
      // Filter client-side by clinic_id since it's on tooth_records
      return (data ?? []).filter((t: any) => t.tooth_records?.clinic_id === clinicId);
    },
    enabled: !!clinicId,
  });

  // Fetch reschedule appointments (status = 'rescheduled' or 'cancelled')
  const { data: reschedules, isLoading: loadingRS } = useQuery({
    queryKey: ["followup-reschedule", clinicId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from("appointments")
        .select("id, patient_id, appointment_date, appointment_time, type, status, patients(full_name, phone)")
        .eq("clinic_id", clinicId!)
        .in("status", ["rescheduled", "cancelled", "Rescheduled", "Cancelled"])
        .gte("appointment_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("appointment_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const isLoading = loadingNS || loadingTx || loadingRS;

  const items: FollowUpItem[] = useMemo(() => {
    const list: FollowUpItem[] = [];

    (noShows ?? []).forEach((a: any) => {
      list.push({
        id: `ns-${a.id}`,
        type: "no_show",
        patientName: a.patients?.full_name || "Unknown",
        patientPhone: a.patients?.phone || null,
        detail: `${a.type || "Appointment"} on ${a.appointment_date}`,
        priority: "high",
        patientId: a.patient_id,
      });
    });

    (incompleteTx ?? []).forEach((t: any) => {
      list.push({
        id: `it-${t.id}`,
        type: "incomplete",
        patientName: t.patients?.full_name || "Unknown",
        patientPhone: t.patients?.phone || null,
        detail: `${t.treatment_name} (Tooth #${t.tooth_number}) — ${t.status}`,
        priority: "low",
        patientId: t.patient_id,
      });
    });

    (reschedules ?? []).forEach((a: any) => {
      list.push({
        id: `rs-${a.id}`,
        type: "reschedule",
        patientName: a.patients?.full_name || "Unknown",
        patientPhone: a.patients?.phone || null,
        detail: `${a.type || "Appointment"} on ${a.appointment_date} — ${a.status}`,
        priority: "medium",
        patientId: a.patient_id,
      });
    });

    return list;
  }, [noShows, incompleteTx, reschedules]);

  const filtered = activeTab === "all" ? items : items.filter(i => i.type === activeTab);

  const counts = {
    total: items.length,
    no_show: items.filter(i => i.type === "no_show").length,
    incomplete: items.filter(i => i.type === "incomplete").length,
    reschedule: items.filter(i => i.type === "reschedule").length,
  };

  const statCards = [
    { label: "Total", value: counts.total, icon: <AlertTriangle className="w-4 h-4 text-amber-500" /> },
    { label: "No Shows", value: counts.no_show, icon: <UserX className="w-4 h-4 text-red-500" /> },
    { label: "Incomplete", value: counts.incomplete, icon: <Clock className="w-4 h-4 text-amber-500" /> },
    { label: "Reschedule", value: counts.reschedule, icon: <CalendarClock className="w-4 h-4 text-blue-500" /> },
  ];

  const tabs: { value: "all" | FollowUpType; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.total },
    { value: "no_show", label: "No Shows", count: counts.no_show },
    { value: "incomplete", label: "Incomplete", count: counts.incomplete },
    { value: "reschedule", label: "Reschedule", count: counts.reschedule },
  ];

  const handleRemind = (item: FollowUpItem) => {
    if (!item.patientPhone) {
      toast.error("No phone number available");
      return;
    }
    const phone = item.patientPhone.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(`Hi ${item.patientName}, this is a reminder regarding your pending ${item.detail}. Please contact us to schedule your visit.`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    toast.success("WhatsApp opened for " + item.patientName);
  };

  const handleCall = (item: FollowUpItem) => {
    if (!item.patientPhone) {
      toast.error("No phone number available");
      return;
    }
    window.open(`tel:${item.patientPhone}`, "_self");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">
            Follow-Ups & Reminders
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track no-shows, incomplete treatments, and send reminders
          </p>
        </div>

        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map(s => (
            <Card key={s.label} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  {s.icon}
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-foreground">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap gap-1.5">
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.value
                  ? "bg-foreground text-background shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Follow-Up List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-accent/60 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-heading text-lg font-semibold mb-1">All caught up!</h3>
              <p className="text-muted-foreground text-sm">No follow-ups pending in this category.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const config = TYPE_CONFIG[item.type];
              return (
                <Card key={item.id} className="group border hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: info */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {config.icon}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">{item.patientName}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLOR[item.priority]}`}>
                              {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.badgeClass}`}>
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                          {item.patientPhone && (
                            <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {item.patientPhone}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemind(item)}
                          className="gap-1.5 h-8 text-xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Remind</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCall(item)}
                          className="h-8 w-8"
                          title="Call"
                        >
                          <Phone className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Mark done"
                          onClick={() => toast.success(`Marked ${item.patientName} as done`)}
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
