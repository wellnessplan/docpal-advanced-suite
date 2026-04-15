import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Clock, Users, IndianRupee, TrendingUp, AlertTriangle, UserCheck, Timer, CalendarDays, Star } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfMonth, subMonths } from "date-fns";

const PERF_COLORS = {
  high: "hsl(142, 71%, 45%)",
  medium: "hsl(48, 96%, 53%)",
  low: "hsl(0, 84%, 60%)",
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 71%, 45%)",
  "hsl(48, 96%, 53%)",
  "hsl(280, 67%, 55%)",
  "hsl(0, 84%, 60%)",
  "hsl(199, 89%, 48%)",
];

function getPerformanceColor(value: number, thresholds: { high: number; low: number }) {
  if (value >= thresholds.high) return PERF_COLORS.high;
  if (value >= thresholds.low) return PERF_COLORS.medium;
  return PERF_COLORS.low;
}

function getPerformanceBadge(value: number, thresholds: { high: number; low: number }) {
  if (value >= thresholds.high) return <Badge className="bg-success/10 text-success border-success/20">High</Badge>;
  if (value >= thresholds.low) return <Badge className="bg-warning/10 text-warning border-warning/20">Average</Badge>;
  return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Low</Badge>;
}

export default function Performance() {
  const { clinicId } = useAuth();
  const [dateRange, setDateRange] = useState("30");
  const [selectedDoctor, setSelectedDoctor] = useState("all");

  const startDate = subDays(new Date(), parseInt(dateRange));
  const startISO = startOfDay(startDate).toISOString();
  const endISO = endOfDay(new Date()).toISOString();

  // Fetch doctors
  const { data: doctors = [] } = useQuery({
    queryKey: ["perf-doctors", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role, specialization")
        .eq("clinic_id", clinicId!)
        .in("role", ["doctor", "admin"]);
      return data || [];
    },
    enabled: !!clinicId,
  });

  // Fetch appointments for the period
  const { data: appointments = [] } = useQuery({
    queryKey: ["perf-appointments", clinicId, startISO, endISO],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("clinic_id", clinicId!)
        .gte("appointment_date", startDate.toISOString().split("T")[0])
        .lte("appointment_date", new Date().toISOString().split("T")[0]);
      return data || [];
    },
    enabled: !!clinicId,
  });

  // Fetch invoices for revenue
  const { data: invoices = [] } = useQuery({
    queryKey: ["perf-invoices", clinicId, startISO, endISO],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("clinic_id", clinicId!)
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      return data || [];
    },
    enabled: !!clinicId,
  });

  // Fetch treatments
  const { data: treatments = [] } = useQuery({
    queryKey: ["perf-treatments", clinicId, startISO, endISO],
    queryFn: async () => {
      const { data } = await supabase
        .from("tooth_treatments")
        .select("*")
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      return data || [];
    },
    enabled: !!clinicId,
  });

  // Queue tokens for timing
  const { data: queueTokens = [] } = useQuery({
    queryKey: ["perf-queue", clinicId, startISO, endISO],
    queryFn: async () => {
      const { data } = await supabase
        .from("queue_tokens")
        .select("*")
        .eq("clinic_id", clinicId!)
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      return data || [];
    },
    enabled: !!clinicId,
  });

  // Consultation logs
  const { data: consultationLogs = [] } = useQuery({
    queryKey: ["perf-consultation-logs", clinicId, startISO, endISO],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultation_logs")
        .select("*")
        .eq("clinic_id", clinicId!)
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      return data || [];
    },
    enabled: !!clinicId,
  });

  // ---- COMPUTED METRICS ----
  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.total || 0), 0);

  const totalPatients = new Set(appointments.map((a) => a.patient_id)).size;

  const noShowCount = appointments.filter((a) => a.status === "no_show").length;
  const noShowRate = appointments.length ? Math.round((noShowCount / appointments.length) * 100) : 0;

  const walkinCount = appointments.filter((a) => a.type === "walk-in" || a.type === "walkin").length;
  const scheduledCount = appointments.filter((a) => a.type !== "walk-in" && a.type !== "walkin").length;

  const completedTreatments = treatments.filter((t) => t.status === "completed").length;
  const plannedTreatments = treatments.filter((t) => t.status === "planned" || t.status === "pending").length;
  const caseAcceptance = (completedTreatments + plannedTreatments) > 0
    ? Math.round((completedTreatments / (completedTreatments + plannedTreatments)) * 100) : 0;

  const totalDiscount = invoices.reduce((s, i) => s + Number(i.discount || 0), 0);

  // Doctor-level metrics
  const doctorMetrics = doctors.map((doc) => {
    const docAppointments = appointments.filter((a) => a.doctor_id === doc.id || a.provider_id === doc.id);
    const docPatients = new Set(docAppointments.map((a) => a.patient_id)).size;
    const docTreatments = treatments.filter((t) => t.performed_by === doc.id);
    const docCompleted = docTreatments.filter((t) => t.status === "completed").length;
    const docPlanned = docTreatments.filter((t) => t.status === "planned" || t.status === "pending").length;
    const docAcceptance = (docCompleted + docPlanned) > 0 ? Math.round((docCompleted / (docCompleted + docPlanned)) * 100) : 0;

    // Revenue from treatments
    const docRevenue = docTreatments
      .filter((t) => t.status === "completed")
      .reduce((s, t) => s + Number(t.cost || 0), 0);

    // Queue timing
    const docQueue = queueTokens.filter((q) => q.provider_id === doc.id);
    const avgWaitMins = docQueue.length > 0
      ? Math.round(docQueue.reduce((sum, q) => {
          if (q.called_at && q.created_at) {
            return sum + (new Date(q.called_at).getTime() - new Date(q.created_at).getTime()) / 60000;
          }
          return sum;
        }, 0) / docQueue.filter(q => q.called_at).length || 0)
      : 0;

    const avgConsultMins = docQueue.length > 0
      ? Math.round(docQueue.reduce((sum, q) => {
          if (q.completed_at && q.called_at) {
            return sum + (new Date(q.completed_at).getTime() - new Date(q.called_at).getTime()) / 60000;
          }
          return sum;
        }, 0) / docQueue.filter(q => q.completed_at && q.called_at).length || 0)
      : 0;

    return {
      id: doc.id,
      name: doc.full_name || "Unknown",
      specialization: doc.specialization || "General",
      patients: docPatients,
      revenue: docRevenue,
      treatments: docCompleted,
      planned: docPlanned,
      acceptance: docAcceptance,
      avgWaitMins,
      avgConsultMins,
      appointmentCount: docAppointments.length,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Revenue trend (daily)
  const revenueTrend = Array.from({ length: Math.min(parseInt(dateRange), 30) }, (_, i) => {
    const day = subDays(new Date(), Math.min(parseInt(dateRange), 30) - 1 - i);
    const dayStr = format(day, "yyyy-MM-dd");
    const dayLabel = format(day, "dd MMM");
    const dayRevenue = invoices
      .filter((inv) => inv.status === "paid" && inv.paid_at && format(new Date(inv.paid_at), "yyyy-MM-dd") === dayStr)
      .reduce((s, i) => s + Number(i.total || 0), 0);
    const dayPatients = appointments.filter(
      (a) => a.appointment_date === dayStr
    ).length;
    return { date: dayLabel, revenue: dayRevenue, patients: dayPatients };
  });

  // Procedure distribution
  const procedureMap: Record<string, { count: number; revenue: number }> = {};
  treatments.forEach((t) => {
    const name = t.treatment_name || "Other";
    if (!procedureMap[name]) procedureMap[name] = { count: 0, revenue: 0 };
    procedureMap[name].count++;
    procedureMap[name].revenue += Number(t.cost || 0);
  });
  const procedureData = Object.entries(procedureMap)
    .map(([name, d]) => ({ name, count: d.count, revenue: d.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Hourly distribution
  const hourlyMap: Record<number, number> = {};
  appointments.forEach((a) => {
    if (a.appointment_time) {
      const hour = parseInt(a.appointment_time.split(":")[0]);
      hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
    }
  });
  const hourlyData = Array.from({ length: 12 }, (_, i) => ({
    hour: `${(i + 8).toString().padStart(2, "0")}:00`,
    count: hourlyMap[i + 8] || 0,
  }));

  const topDoctor = doctorMetrics[0];

  // Filter metrics for selected doctor
  const filteredDoctorMetrics = selectedDoctor === "all"
    ? doctorMetrics
    : doctorMetrics.filter((d) => d.id === selectedDoctor);

  const chartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--primary))" },
    patients: { label: "Patients", color: "hsl(142, 71%, 45%)" },
    count: { label: "Count", color: "hsl(var(--primary))" },
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Performance Analytics</h1>
            <p className="text-muted-foreground text-sm">Doctor productivity, revenue insights & clinic efficiency</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
          {[
            { label: "Total Revenue", value: `Rs ${totalRevenue.toLocaleString()}`, icon: IndianRupee, color: "bg-success/10 text-success" },
            { label: "Patients Seen", value: totalPatients, icon: Users, color: "bg-accent text-primary" },
            { label: "Treatments Done", value: completedTreatments, icon: Activity, color: "bg-accent text-primary" },
            { label: "Case Acceptance", value: `${caseAcceptance}%`, icon: UserCheck, color: caseAcceptance >= 70 ? "bg-success/10 text-success" : "bg-warning/10 text-warning" },
            { label: "No-show Rate", value: `${noShowRate}%`, icon: AlertTriangle, color: noShowRate <= 10 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive" },
            { label: "Discounts Given", value: `Rs ${totalDiscount.toLocaleString()}`, icon: TrendingUp, color: "bg-warning/10 text-warning" },
          ].map((kpi) => (
            <Card key={kpi.label} className="shadow-card border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${kpi.color}`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-xl md:text-2xl font-bold font-heading">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="doctors" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="doctors">Doctor Performance</TabsTrigger>
            <TabsTrigger value="analytics">Revenue Analytics</TabsTrigger>
            <TabsTrigger value="clinic">Clinic Efficiency</TabsTrigger>
          </TabsList>

          {/* Doctor Performance Tab */}
          <TabsContent value="doctors" className="space-y-4">
            {/* Top Performer Alert */}
            {topDoctor && topDoctor.revenue > 0 && (
              <Card className="border-success/30 bg-success/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <Star className="h-5 w-5 text-success" />
                  <span className="text-sm">
                    <strong>{topDoctor.name}</strong> is the top performer with{" "}
                    <strong>Rs {topDoctor.revenue.toLocaleString()}</strong> revenue and{" "}
                    <strong>{topDoctor.patients}</strong> patients in the selected period.
                  </span>
                </CardContent>
              </Card>
            )}

            {/* Doctor Cards */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredDoctorMetrics.map((doc, idx) => (
                <Card key={doc.id} className="shadow-card border-0 hover:shadow-lg transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                          {doc.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.specialization}</p>
                        </div>
                      </div>
                      {idx === 0 && doc.revenue > 0 && (
                        <Badge className="bg-success/10 text-success border-success/20 text-xs">
                          <Star className="h-3 w-3 mr-1" /> Top
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 rounded-lg p-2.5">
                        <p className="text-xs text-muted-foreground">Revenue</p>
                        <p className="font-bold text-sm">Rs {doc.revenue.toLocaleString()}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2.5">
                        <p className="text-xs text-muted-foreground">Patients</p>
                        <p className="font-bold text-sm">{doc.patients}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2.5">
                        <p className="text-xs text-muted-foreground">Avg Consult</p>
                        <p className="font-bold text-sm">{doc.avgConsultMins} min</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2.5">
                        <p className="text-xs text-muted-foreground">Acceptance</p>
                        <p className="font-bold text-sm" style={{ color: getPerformanceColor(doc.acceptance, { high: 70, low: 40 }) }}>
                          {doc.acceptance}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {doc.treatments} treatments completed
                      </span>
                      {getPerformanceBadge(doc.revenue > 0 ? (doc.acceptance + Math.min(doc.patients * 5, 50)) / 2 : 0, { high: 50, low: 25 })}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredDoctorMetrics.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No doctor data available for the selected period.
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Doctor Revenue Comparison Bar Chart */}
            {doctorMetrics.length > 0 && doctorMetrics.some(d => d.revenue > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Doctor-wise Revenue Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <BarChart data={doctorMetrics.filter(d => d.revenue > 0)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Revenue Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Revenue Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Revenue Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <LineChart data={revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Patient Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Daily Patient Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <BarChart data={revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="patients" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Procedure Distribution */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Procedure Revenue Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {procedureData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[280px] w-full">
                      <PieChart>
                        <Pie
                          data={procedureData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          dataKey="revenue"
                          nameKey="name"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {procedureData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
                      No procedure data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Treatment Conversion Funnel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Treatment Conversion</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 py-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Planned Treatments</span>
                        <span className="font-medium">{plannedTreatments + completedTreatments}</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full">
                        <div className="h-full bg-primary/30 rounded-full" style={{ width: "100%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Completed</span>
                        <span className="font-medium">{completedTreatments}</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${caseAcceptance}%`,
                            backgroundColor: getPerformanceColor(caseAcceptance, { high: 70, low: 40 }),
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Pending</span>
                        <span className="font-medium">{plannedTreatments}</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full">
                        <div
                          className="h-full bg-warning rounded-full"
                          style={{ width: `${(plannedTreatments + completedTreatments) > 0 ? (plannedTreatments / (plannedTreatments + completedTreatments)) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Revenue Leakage (from pending treatments)</p>
                      <p className="text-lg font-bold text-destructive mt-1">
                        Rs {treatments.filter(t => t.status === "planned" || t.status === "pending").reduce((s, t) => s + Number(t.cost || 0), 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Clinic Efficiency Tab */}
          <TabsContent value="clinic" className="space-y-4">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              {[
                { label: "Avg Revenue/Day", value: `Rs ${Math.round(totalRevenue / Math.max(parseInt(dateRange), 1)).toLocaleString()}`, icon: IndianRupee },
                { label: "Walk-in Ratio", value: `${appointments.length ? Math.round((walkinCount / appointments.length) * 100) : 0}%`, icon: Users },
                { label: "Avg Billing/Patient", value: `Rs ${totalPatients ? Math.round(totalRevenue / totalPatients).toLocaleString() : 0}`, icon: TrendingUp },
                { label: "Total Appointments", value: appointments.length, icon: CalendarDays },
              ].map((item) => (
                <Card key={item.label} className="shadow-card border-0">
                  <CardContent className="p-4">
                    <item.icon className="h-4 w-4 text-muted-foreground mb-2" />
                    <p className="text-xl font-bold">{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Peak Hours */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Peak Hours Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {hourlyData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.count >= 5 ? PERF_COLORS.high : entry.count >= 2 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Appointment Mix */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Appointment Type Mix</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Scheduled", value: scheduledCount },
                          { name: "Walk-in", value: walkinCount },
                          { name: "No-show", value: noShowCount },
                        ].filter((d) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        <Cell fill="hsl(var(--primary))" />
                        <Cell fill="hsl(142, 71%, 45%)" />
                        <Cell fill="hsl(0, 84%, 60%)" />
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Financial Control */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Financial Control Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Discounts</p>
                    <p className="text-lg font-bold text-warning">Rs {totalDiscount.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Pending Collections</p>
                    <p className="text-lg font-bold text-destructive">
                      Rs {invoices.filter(i => i.status !== "paid").reduce((s, i) => s + Number(i.balance || i.total || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Avg Discount %</p>
                    <p className="text-lg font-bold">
                      {invoices.length ? Math.round(invoices.reduce((s, i) => s + Number(i.discount_percent || 0), 0) / invoices.length) : 0}%
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Free Treatments</p>
                    <p className="text-lg font-bold">{treatments.filter(t => Number(t.cost || 0) === 0 && t.status === "completed").length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
