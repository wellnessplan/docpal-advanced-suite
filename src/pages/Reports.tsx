import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, Users, Stethoscope, CalendarDays } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";

const COLORS = ["hsl(187,72%,39%)", "hsl(152,44%,46%)", "hsl(38,92%,50%)", "hsl(0,72%,58%)", "hsl(280,60%,50%)", "hsl(199,89%,48%)"];

export default function ReportsPage() {
  const { clinicId } = useAuth();
  const [period, setPeriod] = useState("6");

  const { data: invoices = [] } = useQuery({
    queryKey: ["report-invoices", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("amount, status, paid_at, created_at, payment_method")
        .eq("clinic_id", clinicId!);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["report-expenses", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("amount, category, expense_date")
        .eq("clinic_id", clinicId!);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["report-appointments", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("appointments").select("status, appointment_date, type, provider_id")
        .eq("clinic_id", clinicId!);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["report-patients", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("id, gender, date_of_birth, created_at")
        .eq("clinic_id", clinicId!);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ["report-treatments", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("tooth_treatments")
        .select("treatment_name, cost, status, created_at, tooth_record_id");
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // === REVENUE TAB DATA ===
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; revenue: number; expenses: number; profit: number; invoices: number; noShows: number }> = {};
    const now = new Date();
    const n = parseInt(period);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = { month: d.toLocaleString("default", { month: "short" }), revenue: 0, expenses: 0, profit: 0, invoices: 0, noShows: 0 };
    }
    invoices.forEach((inv: any) => {
      const d = inv.paid_at || inv.created_at;
      const key = d?.substring(0, 7);
      if (months[key]) {
        if (inv.status === "paid") months[key].revenue += Number(inv.amount);
        months[key].invoices++;
      }
    });
    expenses.forEach((exp: any) => {
      const key = exp.expense_date?.substring(0, 7);
      if (months[key]) months[key].expenses += Number(exp.amount);
    });
    appointments.forEach((apt: any) => {
      const key = apt.appointment_date?.substring(0, 7);
      if (months[key] && apt.status === "no_show") months[key].noShows++;
    });
    Object.values(months).forEach(m => { m.profit = m.revenue - m.expenses; });
    return Object.values(months);
  }, [invoices, expenses, appointments, period]);

  const totals = useMemo(() => {
    const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
    const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0);
    const totalNoShows = monthlyData.reduce((s, m) => s + m.noShows, 0);
    const totalInvoices = monthlyData.reduce((s, m) => s + m.invoices, 0);
    return { totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses, totalNoShows, totalInvoices };
  }, [monthlyData]);

  const expenseByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    expenses.forEach((e: any) => { cats[e.category || "Other"] = (cats[e.category || "Other"] || 0) + Number(e.amount); });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  // === TREATMENT TAB DATA ===
  const treatmentBreakdown = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number; completed: number }> = {};
    treatments.forEach((t: any) => {
      if (!map[t.treatment_name]) map[t.treatment_name] = { name: t.treatment_name, count: 0, revenue: 0, completed: 0 };
      map[t.treatment_name].count++;
      map[t.treatment_name].revenue += Number(t.cost || 0);
      if (t.status === "completed") map[t.treatment_name].completed++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [treatments]);

  const treatmentStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    treatments.forEach((t: any) => { map[t.status || "unknown"] = (map[t.status || "unknown"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [treatments]);

  // === PATIENT TAB DATA ===
  const patientDemographics = useMemo(() => {
    const genderDist: Record<string, number> = {};
    const ageBuckets: Record<string, number> = { "0-18": 0, "19-30": 0, "31-45": 0, "46-60": 0, "60+": 0, "Unknown": 0 };

    patients.forEach((p: any) => {
      genderDist[p.gender || "Unknown"] = (genderDist[p.gender || "Unknown"] || 0) + 1;
      if (p.date_of_birth) {
        const age = Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age <= 18) ageBuckets["0-18"]++;
        else if (age <= 30) ageBuckets["19-30"]++;
        else if (age <= 45) ageBuckets["31-45"]++;
        else if (age <= 60) ageBuckets["46-60"]++;
        else ageBuckets["60+"]++;
      } else {
        ageBuckets["Unknown"]++;
      }
    });

    return {
      gender: Object.entries(genderDist).map(([name, value]) => ({ name, value })),
      age: Object.entries(ageBuckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })),
    };
  }, [patients]);

  const patientGrowth = useMemo(() => {
    const months: Record<string, number> = {};
    const now = new Date();
    const n = parseInt(period);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
    }
    patients.forEach((p: any) => {
      const key = p.created_at?.substring(0, 7);
      if (months[key] !== undefined) months[key]++;
    });
    let cumulative = 0;
    return Object.entries(months).map(([key, count]) => {
      cumulative += count;
      const d = new Date(key + "-01");
      return { month: d.toLocaleString("default", { month: "short" }), newPatients: count, totalPatients: cumulative };
    });
  }, [patients, period]);

  // === APPOINTMENT TAB DATA ===
  const appointmentByType = useMemo(() => {
    const map: Record<string, number> = {};
    appointments.forEach((a: any) => { map[a.type || "Other"] = (map[a.type || "Other"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [appointments]);

  const appointmentByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    appointments.forEach((a: any) => { map[a.status || "unknown"] = (map[a.status || "unknown"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [appointments]);

  const margin = totals.totalRevenue > 0 ? ((totals.profit / totals.totalRevenue) * 100).toFixed(1) : "0.0";

  const exportCSV = () => {
    const headers = ["Month", "Revenue", "Expenses", "Profit", "Invoices"];
    const rows = monthlyData.map(m => [m.month, m.revenue, m.expenses, m.profit, m.invoices]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "reports.csv"; a.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Comprehensive practice performance insights</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 Months</SelectItem>
                <SelectItem value="6">Last 6 Months</SelectItem>
                <SelectItem value="12">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export</Button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-card border-0">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-2xl font-bold font-heading mt-1">₹{totals.totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Net Profit</p>
              <p className={`text-2xl font-bold font-heading mt-1 ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>₹{totals.profit.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total Patients</p>
              <p className="text-2xl font-bold font-heading mt-1">{patients.length}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Treatments Done</p>
              <p className="text-2xl font-bold font-heading mt-1">{treatments.filter((t: any) => t.status === "completed").length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Reports */}
        <Tabs defaultValue="revenue">
          <TabsList>
            <TabsTrigger value="revenue" className="gap-1"><TrendingUp className="h-3 w-3" /> Revenue</TabsTrigger>
            <TabsTrigger value="treatments" className="gap-1"><Stethoscope className="h-3 w-3" /> Treatments</TabsTrigger>
            <TabsTrigger value="patients" className="gap-1"><Users className="h-3 w-3" /> Patients</TabsTrigger>
            <TabsTrigger value="appointments" className="gap-1"><CalendarDays className="h-3 w-3" /> Appointments</TabsTrigger>
          </TabsList>

          {/* REVENUE TAB */}
          <TabsContent value="revenue" className="mt-4 space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="shadow-card border-0 lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Revenue Trend</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(152,44%,46%)" fill="hsl(152,44%,46%)" fillOpacity={0.1} name="Revenue" strokeWidth={2} />
                      <Area type="monotone" dataKey="expenses" stroke="hsl(0,72%,58%)" fill="hsl(0,72%,58%)" fillOpacity={0.1} name="Expenses" strokeWidth={2} />
                      <Line type="monotone" dataKey="profit" stroke="hsl(187,72%,39%)" name="Profit" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Gross Revenue</p>
                    <p className="text-xl font-bold font-heading">₹{totals.totalRevenue.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Total Expenses</p>
                    <p className="text-xl font-bold font-heading text-destructive">₹{totals.totalExpenses.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Net Profit</p>
                    <p className={`text-xl font-bold font-heading ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>₹{totals.profit.toLocaleString()}</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Profit Margin</span>
                      <span className="font-medium">{margin}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, parseFloat(margin)))}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Expense by Category</CardTitle></CardHeader>
                <CardContent>
                  {expenseByCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={expenseByCategory} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground py-8 text-center">No expense data</p>}
                </CardContent>
              </Card>

              <Card className="shadow-card border-0 lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Monthly Performance</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Expenses</TableHead>
                        <TableHead>Profit</TableHead>
                        <TableHead>Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyData.map(m => (
                        <TableRow key={m.month}>
                          <TableCell className="font-medium">{m.month}</TableCell>
                          <TableCell>₹{m.revenue.toLocaleString()}</TableCell>
                          <TableCell className="text-destructive">₹{m.expenses.toLocaleString()}</TableCell>
                          <TableCell className={m.profit >= 0 ? "text-success" : "text-destructive"}>₹{m.profit.toLocaleString()}</TableCell>
                          <TableCell>{m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(1) : "0.0"}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TREATMENTS TAB */}
          <TabsContent value="treatments" className="mt-4 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Top Treatments</CardTitle></CardHeader>
                <CardContent>
                  {treatmentBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={treatmentBreakdown.slice(0, 8)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(187,72%,39%)" name="Procedures" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No treatment data</p>}
                </CardContent>
              </Card>

              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Treatment Status</CardTitle></CardHeader>
                <CardContent>
                  {treatmentStatusDist.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={treatmentStatusDist} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                          {treatmentStatusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-card border-0">
              <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Treatment Details</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Treatment</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Completion Rate</TableHead>
                      <TableHead>Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treatmentBreakdown.map(t => (
                      <TableRow key={t.name}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>{t.count}</TableCell>
                        <TableCell>{t.completed}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {t.count > 0 ? ((t.completed / t.count) * 100).toFixed(0) : 0}%
                          </Badge>
                        </TableCell>
                        <TableCell>₹{t.revenue.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {!treatmentBreakdown.length && (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No treatments</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PATIENTS TAB */}
          <TabsContent value="patients" className="mt-4 space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Gender Distribution</CardTitle></CardHeader>
                <CardContent>
                  {patientDemographics.gender.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={patientDemographics.gender} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                          {patientDemographics.gender.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
                </CardContent>
              </Card>

              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Age Distribution</CardTitle></CardHeader>
                <CardContent>
                  {patientDemographics.age.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={patientDemographics.age}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(152,44%,46%)" name="Patients" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
                </CardContent>
              </Card>

              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Patient Growth</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={patientGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="newPatients" stroke="hsl(187,72%,39%)" fill="hsl(187,72%,39%)" fillOpacity={0.15} name="New Patients" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* APPOINTMENTS TAB */}
          <TabsContent value="appointments" className="mt-4 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">By Type</CardTitle></CardHeader>
                <CardContent>
                  {appointmentByType.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={appointmentByType}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(187,72%,39%)" name="Count" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
                </CardContent>
              </Card>

              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">By Status</CardTitle></CardHeader>
                <CardContent>
                  {appointmentByStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={appointmentByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                          {appointmentByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-card border-0">
              <CardContent className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold font-heading">{appointments.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-heading text-success">{appointments.filter((a: any) => a.status === "completed").length}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-heading text-destructive">{appointments.filter((a: any) => a.status === "no_show").length}</p>
                    <p className="text-xs text-muted-foreground">No-Shows</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-heading text-warning">{appointments.filter((a: any) => a.status === "cancelled").length}</p>
                    <p className="text-xs text-muted-foreground">Cancelled</p>
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
