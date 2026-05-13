import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const statusColor: Record<string, string> = {
  scheduled: "bg-accent text-accent-foreground",
  confirmed: "bg-accent text-primary",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  no_show: "bg-muted text-muted-foreground",
};

export default function TodayAppointments() {
  const { clinicId } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["dashboard-today-appts", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("appointments")
        .select("*, patients(full_name, phone)")
        .eq("clinic_id", clinicId!)
        .eq("appointment_date", today)
        .order("appointment_time", { ascending: true });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-heading text-base">
          <Clock className="h-4 w-4 text-primary" />
          Today's Schedule
          <Badge variant="outline" className="ml-auto text-xs font-normal">{appointments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        ) : !appointments.length ? (
          <p className="text-sm text-muted-foreground py-4">No appointments today.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {appointments.map((apt: any) => (
              <div
                key={apt.id}
                className="flex items-center justify-between rounded-lg bg-muted/50 p-3 cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => navigate(`/patient/${apt.patient_id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                    {(apt.patients?.full_name || "?")[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{apt.patients?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{apt.type} • {apt.appointment_time?.slice(0, 5)}</p>
                  </div>
                </div>
                <Badge variant="secondary" className={`text-xs capitalize ${statusColor[apt.status] || ""}`}>
                  {apt.status?.replace(/_/g, " ")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
