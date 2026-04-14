import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Target, UserX, Clock, IndianRupee, Stethoscope, ChevronRight } from "lucide-react";
import { subDays } from "date-fns";

interface ActionItem {
  icon: React.ElementType;
  label: string;
  count: number;
  color: string;
  route: string;
  description: string;
}

export default function DailyActionCenter() {
  const { clinicId } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = subDays(new Date(), 30).toISOString().split("T")[0];

  const { data: noShows = 0 } = useQuery({
    queryKey: ["action-noshows", clinicId],
    queryFn: async () => {
      const { count } = await supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId!).eq("status", "no_show")
        .gte("appointment_date", monthAgo);
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  const { data: pendingTreatments = 0 } = useQuery({
    queryKey: ["action-pending-treatments", clinicId],
    queryFn: async () => {
      const { count } = await supabase.from("tooth_treatments")
        .select("*", { count: "exact", head: true })
        .in("status", ["planned", "pending"]);
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  const { data: overduePayments = 0 } = useQuery({
    queryKey: ["action-overdue", clinicId],
    queryFn: async () => {
      const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId!).in("status", ["overdue", "sent"]);
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  const { data: todayUncompleted = 0 } = useQuery({
    queryKey: ["action-today-uncompleted", clinicId],
    queryFn: async () => {
      const { count } = await supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId!).eq("appointment_date", today)
        .in("status", ["scheduled", "confirmed"]);
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  const actions: ActionItem[] = [
    { icon: UserX, label: "Missed Appointments", count: noShows, color: "text-destructive bg-destructive/10", route: "/tasks", description: "Patients who didn't show up" },
    { icon: Stethoscope, label: "Pending Treatments", count: pendingTreatments, color: "text-warning bg-warning/10", route: "/treatment-plans", description: "Planned but not started" },
    { icon: IndianRupee, label: "Overdue Payments", count: overduePayments, color: "text-primary bg-primary/10", route: "/billing", description: "Unpaid invoices" },
    { icon: Clock, label: "Today Remaining", count: todayUncompleted, color: "text-success bg-success/10", route: "/today-schedule", description: "Appointments yet to complete" },
  ];

  const totalActions = actions.reduce((s, a) => s + a.count, 0);

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <Target className="h-4 w-4 text-primary" />
            Daily Action Center
          </CardTitle>
          {totalActions > 0 && (
            <Badge className="bg-destructive/10 text-destructive border-destructive/20">
              {totalActions} pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.route)}
            className="w-full flex items-center gap-3 rounded-xl p-3 hover:bg-muted/50 transition-all group text-left"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${action.color}`}>
              <action.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">{action.count}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
