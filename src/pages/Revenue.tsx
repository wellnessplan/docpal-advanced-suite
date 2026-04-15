import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IndianRupee, TrendingUp, TrendingDown, ArrowUpRight, AlertTriangle, CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

const COLORS = ["hsl(197, 71%, 63%)", "hsl(152, 44%, 46%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 58%)", "hsl(280, 60%, 50%)", "hsl(199, 89%, 48%)"];

export default function Revenue() {
  const { clinicId } = useAuth();
  const [period, setPeriod] = useState("6");

  const { data: invoices = [] } = useQuery({
    queryKey: ["rev-invoices", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("amount, total, status, paid_at, created_at, payment_method, balance")
        .eq("clinic_id", clinicId!);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ["rev-treatments", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("tooth_treatments")
        .select("treatment_name, cost, status, created_at");
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["rev-patients", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("id").eq("clinic_id", clinicId!);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Monthly revenue trend
  const monthlyRevenue = useMemo(() => {
    const n = parseInt(period);
    return Array.from({ length: n }, (_, i) => {
      const d = subMonths(new Date(), n - 1 - i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const monthInvoices = invoices.filter((inv: any) =>
        inv.status === "paid" && inv.paid_at &&
        new Date(inv.paid_at) >= start && new Date(inv.paid_at) <= end
      );
      return {
        month: format(d, "MMM yy"),
        revenue: monthInvoices.reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
      };
    });
  }, [invoices, period]);

  // Payment method distribution
  const paymentMethods = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.filter((i: any) => i.status === "paid").forEach((i: any) => {
      const method = i.payment_method || "Other";
      map[method] = (map[method] || 0) + Number(i.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name: name.replace("_", " ").toUpperCase(), value })).sort((a, b) => b.value - a.value);
  }, [invoices]);

  // Treatment-wise revenue
  const treatmentRevenue = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; count: number }> = {};
    treatments.filter((t: any) => t.status === "completed").forEach((t: any) => {
      const name = t.treatment_name || "Other";
      if (!map[name]) map[name] = { name, revenue: 0, count: 0 };
      map[name].revenue += Number(t.cost || 0);
      map[name].count++;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [treatments]);

  // KPIs
  const totalRevenue = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
  const thisMonthStart = startOfMonth(new Date());
  const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
  const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));

  const thisMonthRev = invoices.filter((i: any) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= thisMonthStart)
    .reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
  const lastMonthRev = invoices.filter((i: any) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= lastMonthStart && new Date(i.paid_at) <= lastMonthEnd)
    .reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

  const monthGrowth = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev * 100).toFixed(1) : "0";
  const outstanding = invoices.filter((i: any) => i.status !== "paid").reduce((s: number, i: any) => s + Number(i.balance || i.amount || 0), 0);
  const arpp = patients.length > 0 ? Math.round(totalRevenue / patients.length) : 0;

  const fmt = (n: number) => `Rs ${n.toLocaleString("en-IN")}`;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold">Revenue Analytics</h1>
            <p className="text-muted-foreground text-sm">Track income trends, payment modes & treatment revenue</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 Months</SelectItem>
              <SelectItem value="6">Last 6 Months</SelectItem>
              <SelectItem value="12">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[
            { label: "This Month", value: fmt(thisMonthRev), icon: IndianRupee, color: "bg-success/10 text-success", sub: `${Number(monthGrowth) >= 0 ? "+" : ""}${monthGrowth}% vs last month`, subColor: Number(monthGrowth) >= 0 ? "text-success" : "text-destructive" },
            { label: "Total Revenue", value: fmt(totalRevenue), icon: TrendingUp, color: "bg-primary/10 text-primary", sub: "All time" },
            { label: "Outstanding", value: fmt(outstanding), icon: AlertTriangle, color: "bg-destructive/10 text-destructive", sub: "Unpaid invoices" },
            { label: "Avg per Patient", value: fmt(arpp), icon: ArrowUpRight, color: "bg-accent text-accent-foreground", sub: `${patients.length} patients` },
          ].map(kpi => (
            <Card key={kpi.label} className="shadow-card border-0">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.color}`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold font-heading">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
                {kpi.sub && <p className={`text-xs mt-0.5 ${kpi.subColor || "text-muted-foreground"}`}>{kpi.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Revenue Trend */}
        <Card className="shadow-card border-0">
          <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Monthly Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(152, 44%, 46%)" fill="hsl(152, 44%, 46%)" fillOpacity={0.12} strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Payment Methods Pie */}
          <Card className="shadow-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-heading">
                <CreditCard className="h-4 w-4" /> Payment Modes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentMethods.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={paymentMethods} cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {paymentMethods.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12 text-sm">No payment data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Treatment-wise Revenue */}
          <Card className="shadow-card border-0">
            <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Revenue by Treatment</CardTitle></CardHeader>
            <CardContent>
              {treatmentRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={treatmentRevenue} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="revenue" fill="hsl(197, 71%, 63%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12 text-sm">No treatment revenue data</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Revenue Leakage */}
        <Card className="shadow-card border-0">
          <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Revenue Leakage Analysis</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-4">
                <p className="text-xs text-muted-foreground mb-1">Unpaid Invoices</p>
                <p className="text-xl font-bold text-destructive">{fmt(outstanding)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {invoices.filter((i: any) => i.status === "overdue").length} overdue
                </p>
              </div>
              <div className="rounded-xl bg-warning/5 border border-warning/10 p-4">
                <p className="text-xs text-muted-foreground mb-1">Cancelled Treatments</p>
                <p className="text-xl font-bold text-warning">
                  {fmt(treatments.filter((t: any) => t.status === "cancelled").reduce((s: number, t: any) => s + Number(t.cost || 0), 0))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {treatments.filter((t: any) => t.status === "cancelled").length} treatments
                </p>
              </div>
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
                <p className="text-xs text-muted-foreground mb-1">Pending Plans</p>
                <p className="text-xl font-bold text-primary">
                  {fmt(treatments.filter((t: any) => t.status === "planned").reduce((s: number, t: any) => s + Number(t.cost || 0), 0))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {treatments.filter((t: any) => t.status === "planned").length} not started
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
