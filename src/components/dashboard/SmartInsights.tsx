import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/supabase-paged";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingDown, TrendingUp, Users, AlertTriangle, Star, Zap, Clock } from "lucide-react";
import { subDays, format } from "date-fns";

interface Insight {
  icon: React.ElementType;
  message: string;
  type: "warning" | "success" | "info" | "danger";
  metric?: string;
}

export default function SmartInsights() {
  const { clinicId } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = subDays(new Date(), 7).toISOString().split("T")[0];
  const twoWeeksAgo = subDays(new Date(), 14).toISOString().split("T")[0];
  const monthAgo = subDays(new Date(), 30).toISOString().split("T")[0];

  const { data: thisWeekRevenue = 0 } = useQuery({
    queryKey: ["insight-this-week-rev", clinicId],
    queryFn: async () => {
      const data = await fetchAllPaged<{ amount: number | null }>((from, to) =>
        supabase.from("invoices").select("amount")
          .eq("clinic_id", clinicId!).eq("status", "paid")
          .gte("paid_at", weekAgo + "T00:00:00").range(from, to));
      return data.reduce((s, i) => s + Number(i.amount), 0);
    },
    enabled: !!clinicId,
  });

  const { data: lastWeekRevenue = 0 } = useQuery({
    queryKey: ["insight-last-week-rev", clinicId],
    queryFn: async () => {
      const data = await fetchAllPaged<{ amount: number | null }>((from, to) =>
        supabase.from("invoices").select("amount")
          .eq("clinic_id", clinicId!).eq("status", "paid")
          .gte("paid_at", twoWeeksAgo + "T00:00:00")
          .lt("paid_at", weekAgo + "T00:00:00").range(from, to));
      return data.reduce((s, i) => s + Number(i.amount), 0);
    },
    enabled: !!clinicId,
  });

  const { data: pendingFollowups = 0 } = useQuery({
    queryKey: ["insight-pending-followups", clinicId],
    queryFn: async () => {
      const { count } = await supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId!).eq("status", "no_show")
        .gte("appointment_date", monthAgo);
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  const { data: pendingPayments = 0 } = useQuery({
    queryKey: ["insight-pending-payments", clinicId],
    queryFn: async () => {
      const data = await fetchAllPaged<{ balance: number | null; amount: number | null }>((from, to) =>
        supabase.from("invoices").select("balance, amount")
          .eq("clinic_id", clinicId!).in("status", ["sent", "draft", "overdue"]).range(from, to));
      return data.reduce((s, i) => s + Number(i.balance || i.amount || 0), 0);
    },
    enabled: !!clinicId,
  });

  const { data: lowStockItems = 0 } = useQuery({
    queryKey: ["insight-low-stock", clinicId],
    queryFn: async () => {
      const data = await fetchAllPaged<{ quantity: number | null; min_stock_level: number | null }>((from, to) =>
        supabase.from("inventory_items").select("quantity, min_stock_level")
          .eq("clinic_id", clinicId!).range(from, to));
      return data.filter(i => (i.quantity ?? 0) <= (i.min_stock_level ?? 0)).length;
    },
    enabled: !!clinicId,
  });

  const { data: topDoctor } = useQuery({
    queryKey: ["insight-top-doctor", clinicId],
    queryFn: async () => {
      const appts = await fetchAllPaged<{ doctor_id: string | null; provider_id: string | null }>((from, to) =>
        supabase.from("appointments").select("doctor_id, provider_id")
          .eq("clinic_id", clinicId!).eq("status", "completed")
          .gte("appointment_date", monthAgo).range(from, to));
      if (!appts.length) return null;
      const counts: Record<string, number> = {};
      appts.forEach(a => {
        const id = a.doctor_id || a.provider_id;
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
      const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (!topId) return null;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", topId[0]).single();
      return { name: profile?.full_name || "Unknown", count: topId[1] };
    },
    enabled: !!clinicId,
  });

  const insights: Insight[] = [];

  // Revenue comparison
  if (lastWeekRevenue > 0 && thisWeekRevenue > 0) {
    const change = ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100;
    if (change < -5) {
      insights.push({
        icon: TrendingDown,
        message: `Revenue dropped ${Math.abs(Math.round(change))}% this week compared to last week`,
        type: "danger",
        metric: `Rs ${thisWeekRevenue.toLocaleString()} vs Rs ${lastWeekRevenue.toLocaleString()}`,
      });
    } else if (change > 5) {
      insights.push({
        icon: TrendingUp,
        message: `Revenue grew ${Math.round(change)}% this week — great momentum!`,
        type: "success",
        metric: `Rs ${thisWeekRevenue.toLocaleString()}`,
      });
    }
  }

  if (topDoctor) {
    insights.push({
      icon: Star,
      message: `${topDoctor.name} has the highest patient count this month`,
      type: "info",
      metric: `${topDoctor.count} patients`,
    });
  }

  if (pendingFollowups > 0) {
    insights.push({
      icon: Users,
      message: `${pendingFollowups} patients missed appointments and need follow-up`,
      type: "warning",
      metric: "Action needed",
    });
  }

  if (pendingPayments > 0) {
    insights.push({
      icon: AlertTriangle,
      message: `Rs ${pendingPayments.toLocaleString()} in outstanding payments pending collection`,
      type: "danger",
      metric: "Overdue",
    });
  }

  if (lowStockItems > 0) {
    insights.push({
      icon: Zap,
      message: `${lowStockItems} inventory items are below minimum stock level`,
      type: "warning",
      metric: "Reorder now",
    });
  }

  if (insights.length === 0) {
    insights.push({
      icon: Brain,
      message: "Everything looks good! Your clinic is running smoothly today.",
      type: "success",
      metric: "All clear",
    });
  }

  const typeStyles = {
    warning: "border-l-warning bg-warning/5",
    success: "border-l-success bg-success/5",
    info: "border-l-primary bg-primary/5",
    danger: "border-l-destructive bg-destructive/5",
  };

  const badgeStyles = {
    warning: "bg-warning/10 text-warning border-warning/20",
    success: "bg-success/10 text-success border-success/20",
    info: "bg-primary/10 text-primary border-primary/20",
    danger: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-heading text-base">
          <Brain className="h-4 w-4 text-primary" />
          Smart Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-xl border-l-4 p-3 transition-all hover:shadow-sm ${typeStyles[insight.type]}`}
          >
            <insight.icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-relaxed">{insight.message}</p>
              {insight.metric && (
                <Badge variant="outline" className={`mt-1.5 text-[10px] ${badgeStyles[insight.type]}`}>
                  {insight.metric}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
