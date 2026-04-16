import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Users, IndianRupee, Wallet, Search, Plus } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";

const statusStyle: Record<string, string> = {
  scheduled: "border-primary/40 text-primary bg-primary/5",
  confirmed: "border-primary/40 text-primary bg-primary/5",
  in_progress: "border-warning/40 text-warning bg-warning/5",
  completed: "border-success/40 text-success bg-success/5",
  cancelled: "border-destructive/40 text-destructive bg-destructive/5",
  no_show: "border-muted-foreground/40 text-muted-foreground bg-muted",
};

export default function DrDashboard() {
  const { profile, clinicId } = useAuth();
  const navigate = useNavigate();
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<"today" | "yesterday" | "month">("today");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const dateFilter = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    if (dateFrom && dateTo) return { from: dateFrom, to: dateTo };
    if (dateRange === "today") return { from: today, to: today };
    if (dateRange === "yesterday") {
      const y = subDays(new Date(), 1).toISOString().split("T")[0];
      return { from: y, to: y };
    }
    return { from: startOfMonth(new Date()).toISOString().split("T")[0], to: today };
  }, [dateRange, dateFrom, dateTo]);

  // Doctors list
  const { data: doctors = [] } = useQuery({
    queryKey: ["dr-dash-doctors", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, role")
        .eq("clinic_id", clinicId!).in("role", ["owner", "dentist"]);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Appointments
  const { data: appointments = [] } = useQuery({
    queryKey: ["dr-dash-appts", clinicId, dateFilter],
    queryFn: async () => {
      const { data } = await supabase.from("appointments")
        .select("*, patients(full_name, phone, gender, date_of_birth, chief_complaint), provider:profiles!appointments_provider_id_fkey(full_name)")
        .eq("clinic_id", clinicId!)
        .gte("appointment_date", dateFilter.from)
        .lte("appointment_date", dateFilter.to)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: true });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // KPI: Billing
  const { data: todayBilling = 0 } = useQuery({
    queryKey: ["dr-dash-billing", clinicId, dateFilter],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("total")
        .eq("clinic_id", clinicId!)
        .gte("created_at", dateFilter.from + "T00:00:00")
        .lte("created_at", dateFilter.to + "T23:59:59");
      return data?.reduce((s, i) => s + Number(i.total), 0) ?? 0;
    },
    enabled: !!clinicId,
  });

  const { data: todayPayments = 0 } = useQuery({
    queryKey: ["dr-dash-payments", clinicId, dateFilter],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("paid_amount")
        .eq("clinic_id", clinicId!).eq("status", "paid")
        .gte("paid_at", dateFilter.from + "T00:00:00");
      return data?.reduce((s, i) => s + Number(i.paid_amount), 0) ?? 0;
    },
    enabled: !!clinicId,
  });

  const filtered = useMemo(() => {
    let list = appointments;
    if (selectedDoctor !== "all") list = list.filter((a: any) => a.provider_id === selectedDoctor);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a: any) =>
        (a.patients?.full_name || "").toLowerCase().includes(q) ||
        (a.patients?.phone || "").includes(q)
      );
    }
    return list;
  }, [appointments, selectedDoctor, search]);

  const checkinCount = filtered.filter((a: any) => ["in_progress", "completed"].includes(a.status)).length;

  const calcAge = (dob: string | null) => {
    if (!dob) return "-";
    return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
  };

  const kpis = [
    { label: "Appointments", value: filtered.length, sub: "Nos", icon: CalendarDays, color: "bg-primary/10 text-primary" },
    { label: "Check-Ins", value: checkinCount, sub: "Nos", icon: Users, color: "bg-warning/10 text-warning" },
    { label: "Billings", value: `₹ ${todayBilling.toLocaleString("en-IN")}`, icon: IndianRupee, color: "bg-success/10 text-success" },
    { label: "Payments", value: `₹ ${todayPayments.toLocaleString("en-IN")}`, icon: Wallet, color: "bg-accent text-accent-foreground" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">
            👋 Hi {profile?.full_name?.split(" ").slice(0, 2).join(" ") || "Doctor"},
          </h1>
          <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Doctors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Doctors</SelectItem>
              {doctors.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="shadow-card border-0">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-bold font-heading text-foreground leading-tight">
                    {kpi.value} {typeof kpi.value === "number" && <span className="text-xs font-normal text-muted-foreground">{kpi.sub}</span>}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search & Filters */}
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="font-heading text-base font-semibold">Appointments</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search (Patient name / phone)"
                    className="pl-8 w-[250px] h-9 text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Input type="date" className="h-9 w-[140px] text-sm" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDateRange("today"); }} />
                <span className="text-muted-foreground text-sm">-</span>
                <Input type="date" className="h-9 w-[140px] text-sm" value={dateTo} onChange={e => { setDateTo(e.target.value); setDateRange("today"); }} />
                <div className="flex gap-1">
                  {(["today", "yesterday", "month"] as const).map(r => (
                    <Button
                      key={r}
                      size="sm"
                      variant={dateRange === r && !dateFrom ? "default" : "outline"}
                      className="h-9 text-xs capitalize"
                      onClick={() => { setDateRange(r); setDateFrom(""); setDateTo(""); }}
                    >
                      {r === "month" ? "This Month" : r.charAt(0).toUpperCase() + r.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">No.</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Patient</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Phone</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Gender</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Age</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Chief Complaints</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Doctor</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No Appointments Found</td></tr>
                  ) : filtered.map((apt: any, idx: number) => (
                    <tr
                      key={apt.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/patients/${apt.patient_id}`)}
                    >
                      <td className="px-3 py-3 text-muted-foreground">{idx + 1}</td>
                      <td className="px-3 py-3 text-muted-foreground text-xs">
                        {apt.appointment_date ? format(new Date(apt.appointment_date + "T00:00:00"), "dd-MM-yy") : "-"}
                        <br />
                        <span className="text-[11px]">
                          {apt.appointment_time ? format(new Date(`2000-01-01T${apt.appointment_time}`), "h:mm a") : ""}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
                            {(apt.patients?.full_name || "?")[0]}
                          </div>
                          <span className="font-medium text-foreground">{apt.patients?.full_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground text-xs">{apt.patients?.phone || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground capitalize">{apt.patients?.gender || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{calcAge(apt.patients?.date_of_birth)}</td>
                      <td className="px-3 py-3 text-muted-foreground text-xs max-w-[150px] truncate">
                        {(apt.patients as any)?.chief_complaint || apt.type || "-"}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{apt.provider?.full_name || "-"}</td>
                      <td className="px-3 py-3">
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
      </div>
    </DashboardLayout>
  );
}
