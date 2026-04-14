import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { subDays, format } from "date-fns";

const COLORS = ["hsl(197, 71%, 63%)", "hsl(152, 44%, 46%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 58%)", "hsl(280, 60%, 50%)"];

export function AppointmentHeatmap() {
  const { clinicId } = useAuth();

  const { data: hourlyData = [] } = useQuery({
    queryKey: ["heatmap-hourly", clinicId],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split("T")[0];
      const { data } = await supabase.from("appointments").select("appointment_time")
        .eq("clinic_id", clinicId!)
        .gte("appointment_date", thirtyDaysAgo);
      const hourMap: Record<number, number> = {};
      data?.forEach(a => {
        if (a.appointment_time) {
          const hour = parseInt(a.appointment_time.split(":")[0]);
          hourMap[hour] = (hourMap[hour] || 0) + 1;
        }
      });
      return Array.from({ length: 12 }, (_, i) => ({
        hour: `${(i + 8).toString().padStart(2, "0")}:00`,
        count: hourMap[i + 8] || 0,
      }));
    },
    enabled: !!clinicId,
  });

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-heading">Peak Hours (30d)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill="hsl(197, 71%, 63%)" radius={[4, 4, 0, 0]} name="Appointments" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function RevenueTrendMini() {
  const { clinicId } = useAuth();

  const { data: trendData = [] } = useQuery({
    queryKey: ["revenue-trend-mini", clinicId],
    queryFn: async () => {
      const trend: { day: string; revenue: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const dayStr = format(d, "yyyy-MM-dd");
        const { data } = await supabase.from("invoices").select("amount")
          .eq("clinic_id", clinicId!).eq("status", "paid")
          .gte("paid_at", dayStr + "T00:00:00")
          .lt("paid_at", dayStr + "T23:59:59");
        trend.push({
          day: format(d, "dd"),
          revenue: data?.reduce((s, i) => s + Number(i.amount), 0) ?? 0,
        });
      }
      return trend;
    },
    enabled: !!clinicId,
  });

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-heading">Revenue (14d)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
            <Area type="monotone" dataKey="revenue" stroke="hsl(152, 44%, 46%)" fill="hsl(152, 44%, 46%)" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function WalkinVsBookedChart() {
  const { clinicId } = useAuth();

  const { data: chartData = [] } = useQuery({
    queryKey: ["walkin-vs-booked", clinicId],
    queryFn: async () => {
      const monthAgo = subDays(new Date(), 30).toISOString().split("T")[0];
      const { data } = await supabase.from("appointments").select("type")
        .eq("clinic_id", clinicId!)
        .gte("appointment_date", monthAgo);
      const walkin = data?.filter(a => a.type === "walk-in" || a.type === "walkin").length ?? 0;
      const booked = (data?.length ?? 0) - walkin;
      return [
        { name: "Walk-in", value: walkin },
        { name: "Booked", value: booked },
      ].filter(d => d.value > 0);
    },
    enabled: !!clinicId,
  });

  if (chartData.length === 0) {
    return (
      <Card className="shadow-card border-0">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Walk-in vs Booked</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No data yet</CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-heading">Walk-in vs Booked (30d)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" outerRadius={70} innerRadius={40} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
