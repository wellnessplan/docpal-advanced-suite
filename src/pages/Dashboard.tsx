import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users, IndianRupee, Wallet, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import DashboardLayout from "@/components/DashboardLayout";
import ProfileCompletionModal from "@/components/ProfileCompletionModal";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";
import ProductTour from "@/components/onboarding/ProductTour";
import MorningBrief from "@/components/dashboard/MorningBrief";
import ClinicPulse from "@/components/dashboard/ClinicPulse";
import { format } from "date-fns";

const statusStyle: Record<string, string> = {
  scheduled: "border-primary/40 text-primary bg-primary/5",
  confirmed: "border-primary/40 text-primary bg-primary/5",
  in_progress: "border-warning/40 text-warning bg-warning/5",
  completed: "border-success/40 text-success bg-success/5",
  cancelled: "border-destructive/40 text-destructive bg-destructive/5",
  no_show: "border-muted-foreground/40 text-muted-foreground bg-muted",
};

export default function DashboardPage() {
  const { profile, clinicId } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const today = new Date().toISOString().split("T")[0];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  // KPI: Today's Appointments
  const { data: apptCount = 0 } = useQuery({
    queryKey: ["dash-kpi-appts", clinicId, today],
    queryFn: async () => {
      const { count } = await supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId!).eq("appointment_date", today);
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  const { data: cancelledCount = 0 } = useQuery({
    queryKey: ["dash-kpi-cancelled", clinicId, today],
    queryFn: async () => {
      const { count } = await supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId!).eq("appointment_date", today).eq("status", "cancelled");
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  // KPI: Check-Ins
  const { data: checkinCount = 0 } = useQuery({
    queryKey: ["dash-kpi-checkins", clinicId, today],
    queryFn: async () => {
      const { count } = await supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId!).eq("appointment_date", today).in("status", ["in_progress", "completed"]);
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  // KPI: Today's Billing
  const { data: todayBilling = 0 } = useQuery({
    queryKey: ["dash-kpi-billing", clinicId, today],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("total")
        .eq("clinic_id", clinicId!).gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59");
      return data?.reduce((s, i) => s + Number(i.total), 0) ?? 0;
    },
    enabled: !!clinicId,
  });

  // KPI: Today's Payments
  const { data: todayPayments = 0 } = useQuery({
    queryKey: ["dash-kpi-payments", clinicId, today],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("paid_amount")
        .eq("clinic_id", clinicId!).eq("status", "paid").gte("paid_at", today + "T00:00:00");
      return data?.reduce((s, i) => s + Number(i.paid_amount), 0) ?? 0;
    },
    enabled: !!clinicId,
  });

  // Appointments table
  const { data: appointments = [] } = useQuery({
    queryKey: ["dash-appts-table", clinicId, today],
    queryFn: async () => {
      const { data } = await supabase.from("appointments")
        .select("*, patients(full_name, phone, gender, date_of_birth), provider:profiles!appointments_provider_id_fkey(full_name)")
        .eq("clinic_id", clinicId!).eq("appointment_date", today)
        .order("appointment_time", { ascending: true });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Doctors list
  const { data: doctors = [] } = useQuery({
    queryKey: ["dash-doctors", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, role")
        .eq("clinic_id", clinicId!).in("role", ["owner", "dentist"]);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Latest transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["dash-transactions", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices")
        .select("id, invoice_number, total, status, patients(full_name)")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const calcAge = (dob: string | null) => {
    if (!dob) return "-";
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / 31557600000);
  };

  const kpis = [
    { label: "Appointments", value: apptCount, sub: cancelledCount > 0 ? `(${cancelledCount} Cancelled)` : "Nos", subColor: cancelledCount > 0 ? "text-destructive" : "", icon: CalendarDays, color: "bg-primary/10 text-primary" },
    { label: "Check-Ins", value: checkinCount, sub: "Nos", icon: Users, color: "bg-warning/10 text-warning" },
    { label: "Billing", value: `₹ ${todayBilling.toLocaleString("en-IN")}`, icon: IndianRupee, color: "bg-success/10 text-success" },
    { label: "Payment", value: `₹ ${todayPayments.toLocaleString("en-IN")}`, icon: Wallet, color: "bg-accent text-accent-foreground" },
  ];

  // Doctor activity: count appointments per doctor today
  const doctorActivity = doctors.map((d: any) => {
    const count = appointments.filter((a: any) => a.provider_id === d.id).length;
    const hasOngoing = appointments.some((a: any) => a.provider_id === d.id && a.status === "in_progress");
    return { ...d, apptCount: count, available: !hasOngoing };
  });

  return (
    <DashboardLayout>
      <ProfileCompletionModal />
      <ProductTour />
      <div className="space-y-5 animate-fade-in">
        <OnboardingChecklist />
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">
              👋 Welcome, {profile?.full_name?.split(" ").slice(0, 2).join(" ") || "Doctor"}
            </h1>
          </div>
          <Button size="sm" onClick={() => navigate("/patients")} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Patient
          </Button>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="shadow-card border-0 hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg md:text-xl font-bold font-heading text-foreground leading-tight">
                    {kpi.value} {typeof kpi.value === "number" && <span className={`text-xs font-normal ${kpi.subColor || "text-muted-foreground"}`}>{kpi.sub}</span>}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Appointments Table */}
        <Card className="shadow-card border-0">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="font-heading text-base">Appointments</CardTitle>
            <Button variant="link" size="sm" className="text-primary text-xs p-0 h-auto" onClick={() => navigate("/appointments")}>View All</Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">No</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Time</th>
                    {!isMobile && <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Age</th>}
                    {!isMobile && <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Gender</th>}
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Doctor</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No appointments today</td></tr>
                  ) : appointments.slice(0, 10).map((apt: any, idx: number) => (
                    <tr
                      key={apt.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/patients/${apt.patient_id}`)}
                    >
                      <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
                            {(apt.patients?.full_name || "?")[0]}
                          </div>
                          <span className="font-medium text-foreground">{apt.patients?.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {apt.appointment_time ? format(new Date(`2000-01-01T${apt.appointment_time}`), "h:mm a") : "-"}
                      </td>
                      {!isMobile && <td className="px-4 py-3 text-muted-foreground">{calcAge(apt.patients?.date_of_birth)}</td>}
                      {!isMobile && <td className="px-4 py-3 text-muted-foreground capitalize">{apt.patients?.gender || "-"}</td>}
                      <td className="px-4 py-3 text-muted-foreground">{apt.provider?.full_name || "-"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[11px] capitalize ${statusStyle[apt.status] || ""}`}>
                          {apt.status?.replace(/_/g, " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Row: Doctors Activity + Latest Transactions */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Doctors Activity */}
          <Card className="shadow-card border-0">
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="font-heading text-base">Doctors Activity Window</CardTitle>
              <Button variant="link" size="sm" className="text-primary text-xs p-0 h-auto" onClick={() => navigate("/staff")}>View All</Button>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Appointments</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {doctorActivity.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-sm">No doctors found</td></tr>
                  ) : doctorActivity.map((doc: any, idx: number) => (
                    <tr key={doc.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{doc.full_name}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{doc.apptCount}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={doc.available ? "border-success/40 text-success bg-success/5" : "border-warning/40 text-warning bg-warning/5"}>
                          {doc.available ? "Available" : "Busy"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Latest Transactions */}
          <Card className="shadow-card border-0">
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="font-heading text-base">Latest Transactions</CardTitle>
              <Button variant="link" size="sm" className="text-primary text-xs p-0 h-auto" onClick={() => navigate("/billing")}>View All</Button>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Inv No</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Patient</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-sm">No transactions yet</td></tr>
                  ) : transactions.map((txn: any) => (
                    <tr key={txn.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => navigate("/billing")}>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{txn.invoice_number || "-"}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{txn.patients?.full_name || "-"}</td>
                      <td className="px-4 py-3 text-foreground font-medium">₹ {Number(txn.total).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[11px] capitalize ${statusStyle[txn.status] || ""}`}>
                          {txn.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
