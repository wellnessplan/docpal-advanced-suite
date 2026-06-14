import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FocusLayout from "@/components/focus/FocusLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Clock, Search, ChevronRight, ListOrdered, CalendarClock,
  AlertTriangle, Phone, UserX, MessageCircle, Loader2, LogIn
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { arrivePatient } from "@/lib/queue-sync";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";


const statusStyle: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/30",
  confirmed: "bg-primary/10 text-primary border-primary/30",
  in_progress: "bg-warning/10 text-warning border-warning/30",
  waiting: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  no_show: "bg-muted text-muted-foreground border-border",
};

export default function FocusToday() {
  const { clinicId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const today = format(new Date(), "yyyy-MM-dd");

  // Today's appointments
  const { data: appointments = [], isLoading: loadingAppts } = useQuery({
    queryKey: ["focus-today-appts", clinicId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, patients(id, full_name, phone, gender, date_of_birth)")
        .eq("clinic_id", clinicId!)
        .eq("appointment_date", today)
        .order("appointment_time", { ascending: true });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Live queue (today, waiting/in_progress)
  const { data: queue = [], isLoading: loadingQueue } = useQuery({
    queryKey: ["focus-queue", clinicId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, patients(id, full_name, phone)")
        .eq("clinic_id", clinicId!)
        .eq("appointment_date", today)
        .in("status", ["waiting", "in_progress", "scheduled", "confirmed"])
        .order("appointment_time", { ascending: true });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Follow-ups (no-shows last 30 days)
  const { data: followUps = [], isLoading: loadingFU } = useQuery({
    queryKey: ["focus-followups", clinicId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from("appointments")
        .select("*, patients(id, full_name, phone)")
        .eq("clinic_id", clinicId!)
        .in("status", ["no_show", "cancelled"])
        .gte("appointment_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("appointment_date", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const filterBySearch = (list: any[]) =>
    !search.trim()
      ? list
      : list.filter((a: any) =>
          (a.patients?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
          (a.patients?.phone || "").includes(search)
        );

  const apptsFiltered = useMemo(() => filterBySearch(appointments), [appointments, search]);
  const queueFiltered = useMemo(() => filterBySearch(queue), [queue, search]);
  const fuFiltered = useMemo(() => filterBySearch(followUps), [followUps, search]);

  const goToPatient = (patientId: string) =>
    navigate(`/focus/patient/${patientId}`);

  const handleArrive = async (apt: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!clinicId) return;
    try {
      const r = await arrivePatient({ clinicId, patientId: apt.patient_id, appointmentId: apt.id });
      toast.success(r.reused ? `Already in queue (#${r.token_number})` : `Arrived — token #${r.token_number}`);
      qc.invalidateQueries({ queryKey: ["focus-today-appts"] });
      qc.invalidateQueries({ queryKey: ["focus-queue"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark arrived");
    }
  };

  const renderApptCard = (apt: any) => {
    const canArrive = ["scheduled", "confirmed"].includes(apt.status);
    return (
    <Card
      key={apt.id}
      className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all border-l-4 border-l-primary/40"
      onClick={() => goToPatient(apt.patient_id)}
    >
      <CardContent className="flex items-center gap-3 p-3">
        <div className="flex flex-col items-center min-w-[56px] text-center bg-muted/40 rounded-lg p-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
          <span className="text-sm font-bold text-foreground">
            {apt.appointment_time?.slice(0, 5) || "--:--"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate text-foreground">
            {apt.patients?.full_name || "Unknown"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {apt.type || "Checkup"} {apt.notes ? `· ${apt.notes}` : ""}
          </p>
        </div>
        {canArrive && (
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={(e) => handleArrive(apt, e)}>
            <LogIn className="h-3.5 w-3.5" /> Arrive
          </Button>
        )}
        <Badge variant="outline" className={cn("text-[10px] capitalize", statusStyle[apt.status] || "")}>
          {apt.status?.replace(/_/g, " ")}
        </Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </CardContent>
    </Card>
    );
  };


  const renderFollowUp = (apt: any) => (
    <Card key={apt.id} className="border-l-4 border-l-warning/60 hover:shadow-md transition-shadow">
      <CardContent className="flex items-center gap-3 p-3">
        <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
          <UserX className="h-4 w-4 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{apt.patients?.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {apt.status === "no_show" ? "Missed" : "Cancelled"} on{" "}
            {format(new Date(apt.appointment_date + "T00:00:00"), "dd MMM")}
          </p>
        </div>
        {apt.patients?.phone && (
          <>
            <Button variant="outline" size="sm" className="h-8 px-2" asChild>
              <a href={`tel:${apt.patients.phone}`} onClick={e => e.stopPropagation()}>
                <Phone className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2" asChild>
              <a
                href={`https://wa.me/${apt.patients.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" className="h-8" onClick={() => goToPatient(apt.patient_id)}>
          Open
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <FocusLayout activeStep={1}>
      <div className="max-w-5xl mx-auto space-y-4 animate-fade-in">
        {/* Hero stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Today</p>
              <p className="text-2xl font-bold font-heading">{appointments.length}</p>
              <p className="text-[11px] text-muted-foreground">Appointments</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Now</p>
              <p className="text-2xl font-bold font-heading">{queue.length}</p>
              <p className="text-[11px] text-muted-foreground">In Queue</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Pending</p>
              <p className="text-2xl font-bold font-heading">{followUps.length}</p>
              <p className="text-[11px] text-muted-foreground">Follow-ups</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patient by name or phone..."
            className="pl-9 h-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="schedule">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedule" className="gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>Schedule</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                {apptsFiltered.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-1.5">
              <ListOrdered className="h-3.5 w-3.5" />
              <span>Queue</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                {queueFiltered.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="followups" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Follow-ups</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                {fuFiltered.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-2 mt-3">
            {loadingAppts ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : apptsFiltered.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  No appointments today
                </CardContent>
              </Card>
            ) : (
              apptsFiltered.map(renderApptCard)
            )}
          </TabsContent>

          <TabsContent value="queue" className="space-y-2 mt-3">
            {loadingQueue ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : queueFiltered.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  Queue is empty
                </CardContent>
              </Card>
            ) : (
              queueFiltered.map(renderApptCard)
            )}
          </TabsContent>

          <TabsContent value="followups" className="space-y-2 mt-3">
            {loadingFU ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : fuFiltered.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  No pending follow-ups 🎉
                </CardContent>
              </Card>
            ) : (
              fuFiltered.map(renderFollowUp)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </FocusLayout>
  );
}
