import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plus, Clock, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export default function TodaySchedule() {
  const { clinicId } = useAuth();
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["today-schedule", clinicId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, patients(full_name, phone)")
        .eq("clinic_id", clinicId!)
        .eq("appointment_date", today)
        .order("appointment_time", { ascending: true });
      return data || [];
    },
    enabled: !!clinicId,
  });

  const statusColor: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700",
    confirmed: "bg-green-100 text-green-700",
    "in-progress": "bg-yellow-100 text-yellow-700",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Today's Schedule</h1>
            <p className="text-muted-foreground text-sm">{format(new Date(), "EEEE, MMMM d, yyyy")} — {appointments.length} appointments</p>
          </div>
          <Button size="sm" onClick={() => navigate("/appointments")} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Appointment
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : appointments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No appointments today</h3>
              <p className="text-muted-foreground text-sm mt-1">Schedule your first appointment to see it here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {appointments.map((apt: any) => (
              <Card key={apt.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/patients/${apt.patient_id}`)}>
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <div className="flex flex-col items-center min-w-[60px]">
                    <Clock className="h-4 w-4 text-muted-foreground mb-0.5" />
                    <span className="text-sm font-bold">{apt.appointment_time?.slice(0, 5)}</span>
                    <span className="text-[10px] text-muted-foreground">{apt.duration_minutes}min</span>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{apt.patients?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{apt.type || "Checkup"} {apt.notes ? `· ${apt.notes}` : ""}</p>
                  </div>
                  <Badge variant="secondary" className={statusColor[apt.status] || ""}>
                    {apt.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
