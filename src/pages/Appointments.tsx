import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/supabase-paged";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, CalendarDays, Clock, List, RefreshCw, Search, Eye, Pencil, Trash2, Armchair } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, isSameDay, addWeeks, subWeeks, subDays, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import WhoChangedHover from "@/components/shared/WhoChangedHover";

const statusStyle: Record<string, string> = {
  scheduled: "border-primary/40 text-primary bg-primary/5",
  confirmed: "border-primary/40 text-primary bg-primary/5",
  in_progress: "border-warning/40 text-warning bg-warning/5",
  completed: "border-success/40 text-success bg-success/5",
  cancelled: "border-destructive/40 text-destructive bg-destructive/5",
  no_show: "border-muted-foreground/40 text-muted-foreground bg-muted",
};

const typeColors: Record<string, string> = {
  "General Checkup": "border-l-primary",
  "Consultation": "border-l-primary",
  "Cleaning": "border-l-[hsl(var(--success))]",
  "Filling": "border-l-warning",
  "Root Canal": "border-l-destructive",
  "Extraction": "border-l-destructive",
  "Crown": "border-l-[hsl(var(--accent-foreground))]",
  "Whitening": "border-l-[hsl(var(--success))]",
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
const TIME_SLOTS = HOURS.flatMap(h => [`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`]);

export default function AppointmentsPage() {
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [mainTab, setMainTab] = useState<"appointment" | "checkin" | "calendar">("appointment");
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month" | "chair">("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "month">("today");
  const [form, setForm] = useState({ patient_id: "", appointment_date: "", appointment_time: "", duration_minutes: "30", type: "General Checkup", notes: "", provider_id: "" });

  const { data: patients } = useQuery({
    queryKey: ["patients-list", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const data = await fetchAllPaged((from, to) => supabase.from("patients").select("id, full_name, phone").eq("clinic_id", clinicId).order("full_name").range(from, to), { maxRows: 10000 });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors-list", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, role").eq("clinic_id", clinicId).in("role", ["owner", "dentist"]);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Date ranges for different filters
  const today = new Date();
  const yesterday = subDays(today, 1);
  const monthS = startOfMonth(today);
  const monthE = endOfMonth(today);

  const filterDate = dateFilter === "today" ? today : dateFilter === "yesterday" ? yesterday : null;
  const filterStart = filterDate ? format(filterDate, "yyyy-MM-dd") : format(monthS, "yyyy-MM-dd");
  const filterEnd = filterDate ? format(filterDate, "yyyy-MM-dd") : format(monthE, "yyyy-MM-dd");

  // Calendar view date ranges
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const calMonthStart = startOfMonth(currentDate);
  const calMonthEnd = endOfMonth(currentDate);
  const calRangeStart = calendarView === "week" ? weekStart : calendarView === "month" ? calMonthStart : currentDate;
  const calRangeEnd = calendarView === "week" ? weekEnd : calendarView === "month" ? calMonthEnd : currentDate;

  const queryStart = mainTab === "calendar" ? format(calRangeStart, "yyyy-MM-dd") : filterStart;
  const queryEnd = mainTab === "calendar" ? format(calRangeEnd, "yyyy-MM-dd") : filterEnd;

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", clinicId, queryStart, queryEnd, mainTab],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await supabase.from("appointments")
        .select("*, patients(full_name, phone, gender, date_of_birth), provider:profiles!appointments_provider_id_fkey(full_name)")
        .eq("clinic_id", clinicId)
        .gte("appointment_date", queryStart)
        .lte("appointment_date", queryEnd)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const filteredAppointments = useMemo(() => {
    let list = appointments;
    if (doctorFilter !== "all") list = list.filter((a: any) => a.provider_id === doctorFilter);
    if (mainTab === "checkin") list = list.filter((a: any) => ["in_progress", "completed"].includes(a.status));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a: any) =>
        a.patients?.full_name?.toLowerCase().includes(q) ||
        a.patients?.phone?.includes(q)
      );
    }
    return list;
  }, [appointments, doctorFilter, searchQuery, mainTab]);

  const bookedSlots = useMemo(() => {
    if (!form.appointment_date) return new Set<string>();
    return new Set(
      appointments
        .filter((a: any) => a.appointment_date === form.appointment_date && a.status !== "cancelled")
        .map((a: any) => a.appointment_time?.slice(0, 5))
    );
  }, [appointments, form.appointment_date]);

  const addAppointment = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      if (!form.appointment_date || !form.appointment_time) throw new Error("Select date and time slot");
      const scheduledAt = `${form.appointment_date}T${form.appointment_time}:00`;
      const { error } = await (supabase.from("appointments") as any).insert({
        clinic_id: clinicId, patient_id: form.patient_id,
        scheduled_at: scheduledAt,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        duration_minutes: parseInt(form.duration_minutes),
        type: form.type, notes: form.notes || null,
        provider_id: form.provider_id || null,
      });
      if (error) {
        // Postgres unique_violation from appointments_no_double_book index
        if ((error as any).code === "23505") {
          throw new Error("That slot was just booked by someone else — please pick another time.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setOpen(false);
      setForm({ patient_id: "", appointment_date: "", appointment_time: "", duration_minutes: "30", type: "General Checkup", notes: "", provider_id: "" });
      toast.success("Appointment booked!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Status updated!");
    },
  });

  // Drag-drop reschedule: change date / time / provider (chair) in one shot
  const reschedule = useMutation({
    mutationFn: async ({ id, date, time, provider_id, prev }: {
      id: string; date: string; time: string; provider_id?: string | null;
      prev: { date: string; time: string; provider_id: string | null };
    }) => {
      const scheduledAt = `${date}T${time}:00`;
      const payload: any = { appointment_date: date, appointment_time: time, scheduled_at: scheduledAt };
      if (provider_id !== undefined) payload.provider_id = provider_id;
      const { error } = await supabase.from("appointments").update(payload).eq("id", id);
      if (error) throw error;
      return { id, prev };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment rescheduled", {
        action: {
          label: "Undo",
          onClick: async () => {
            const scheduledAt = `${res.prev.date}T${res.prev.time}:00`;
            const { error } = await supabase.from("appointments").update({
              appointment_date: res.prev.date,
              appointment_time: res.prev.time,
              scheduled_at: scheduledAt,
              provider_id: res.prev.provider_id,
            }).eq("id", res.id);
            if (!error) {
              queryClient.invalidateQueries({ queryKey: ["appointments"] });
              toast.success("Reverted");
            }
          },
        },
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete (cancel) with 8-second undo window — soft-cancel pattern
  const cancelAppointment = useMutation({
    mutationFn: async (apt: any) => {
      const prevStatus = apt.status;
      const { error } = await supabase.from("appointments").update({ status: "cancelled" as any }).eq("id", apt.id);
      if (error) throw error;
      return { id: apt.id, prevStatus };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast("Appointment cancelled", {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: async () => {
            const { error } = await supabase.from("appointments")
              .update({ status: (res.prevStatus || "scheduled") as any })
              .eq("id", res.id);
            if (!error) {
              queryClient.invalidateQueries({ queryKey: ["appointments"] });
              toast.success("Restored");
            }
          },
        },
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const navigateDate = (dir: number) => {
    if (calendarView === "month") setCurrentDate(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
    else if (calendarView === "week") setCurrentDate(d => dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    else setCurrentDate(d => dir > 0 ? addDays(d, 1) : subDays(d, 1));
  };

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const monthDays = useMemo(() => {
    const days = eachDayOfInterval({ start: calMonthStart, end: calMonthEnd });
    const startPad = (getDay(calMonthStart) + 6) % 7;
    return [...Array(startPad).fill(null), ...days] as (Date | null)[];
  }, [calMonthStart, calMonthEnd]);

  const getAptsForHour = (hour: number, date?: Date) => {
    const targetDate = date || currentDate;
    return filteredAppointments.filter((a: any) => {
      const aptHour = parseInt(a.appointment_time?.split(":")[0] || "-1");
      return aptHour === hour && isSameDay(new Date(a.appointment_date + "T00:00:00"), targetDate);
    });
  };
  const getAptsForDay = (date: Date) => filteredAppointments.filter((a: any) => isSameDay(new Date(a.appointment_date + "T00:00:00"), date));

  const calcAge = (dob: string | null) => {
    if (!dob) return "-";
    return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
  };

  const AppointmentBlock = ({ apt, compact = false }: { apt: any; compact?: boolean }) => (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/apt", JSON.stringify({
          id: apt.id,
          prev: {
            date: apt.appointment_date,
            time: apt.appointment_time?.slice(0, 5),
            provider_id: apt.provider_id ?? null,
          },
        }));
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`rounded-md border border-l-4 px-2 py-1.5 text-xs ${statusStyle[apt.status] || "bg-muted"} ${typeColors[apt.type] || "border-l-muted-foreground"} cursor-grab active:cursor-grabbing group relative hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="font-medium truncate flex-1">{apt.patients?.full_name}</div>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          <WhoChangedHover table="appointments" recordId={apt.id} />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); cancelAppointment.mutate(apt); }}
            title="Cancel appointment"
            className="text-muted-foreground/70 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {!compact && <div className="text-[10px] opacity-75">{apt.type} · {apt.duration_minutes}m</div>}
    </div>
  );

  // Drop handler shared by day/week/chair grids
  const handleDrop = (e: React.DragEvent, date: Date, time: string, providerId?: string | null) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/apt");
    if (!raw) return;
    try {
      const { id, prev } = JSON.parse(raw);
      const newDate = format(date, "yyyy-MM-dd");
      // No-op if same slot & same provider
      if (newDate === prev.date && time === prev.time && (providerId ?? null) === prev.provider_id) return;
      reschedule.mutate({ id, date: newDate, time, provider_id: providerId, prev });
    } catch {}
  };
  const allowDrop = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  const calDateLabel = calendarView === "month" ? format(currentDate, "MMMM yyyy")
    : calendarView === "week" ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`
    : calendarView === "chair" ? `Chair view · ${format(currentDate, "EEEE, MMMM d")}`
    : format(currentDate, "EEEE, MMMM d, yyyy");

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Top Tabs + New Appointment */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Tabs value={mainTab} onValueChange={v => setMainTab(v as any)}>
            <TabsList className="h-9">
              <TabsTrigger value="appointment" className="text-xs px-4">Appointment</TabsTrigger>
              <TabsTrigger value="checkin" className="text-xs px-4">Check In</TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs px-4">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New Appointment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Appointment</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); addAppointment.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Patient *</Label>
                    <Select value={form.patient_id} onValueChange={v => setForm(f => ({ ...f, patient_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                      <SelectContent>{patients?.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Doctor</Label>
                    <Select value={form.provider_id} onValueChange={v => setForm(f => ({ ...f, provider_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                      <SelectContent>{doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input type="date" value={form.appointment_date} min={new Date().toISOString().split("T")[0]} onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value, appointment_time: "" }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Select value={form.duration_minutes} onValueChange={v => setForm(f => ({ ...f, duration_minutes: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["15", "30", "45", "60", "90"].map(d => <SelectItem key={d} value={d}>{d} mins</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.appointment_date && (
                  <div className="space-y-2">
                    <Label>Available Slots</Label>
                    <div className="grid grid-cols-4 gap-1.5 max-h-[160px] overflow-y-auto p-1">
                      {TIME_SLOTS.map(slot => {
                        const isBooked = bookedSlots.has(slot);
                        const isSelected = form.appointment_time === slot;
                        const hour = parseInt(slot.split(":")[0]);
                        const ampm = hour >= 12 ? "PM" : "AM";
                        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                        return (
                          <button key={slot} type="button" disabled={isBooked}
                            onClick={() => setForm(f => ({ ...f, appointment_time: slot }))}
                            className={cn(
                              "px-2 py-1.5 text-xs rounded-md border transition-all font-medium",
                              isBooked && "bg-muted text-muted-foreground line-through cursor-not-allowed opacity-50",
                              isSelected && !isBooked && "bg-primary text-primary-foreground border-primary",
                              !isSelected && !isBooked && "hover:bg-primary/10 hover:border-primary/30 cursor-pointer"
                            )}>
                            {`${displayHour}:${slot.split(":")[1]} ${ampm}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["General Checkup", "Cleaning", "Filling", "Root Canal", "Extraction", "Crown", "Whitening", "Consultation"].map(t =>
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Enter notes" />
                </div>
                <Button type="submit" className="w-full" disabled={addAppointment.isPending || !form.patient_id || !form.appointment_date || !form.appointment_time}>
                  {addAppointment.isPending ? "Booking..." : "Book Appointment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table Views (appointment & checkin) */}
        {mainTab !== "calendar" && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg font-bold">Appointments</h2>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Patient name / phone"
                    className="pl-8 h-8 w-48 md:w-64 text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border overflow-hidden">
                  {(["today", "yesterday", "month"] as const).map(f => (
                    <button key={f} onClick={() => setDateFilter(f)}
                      className={cn("px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                        dateFilter === f ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      )}>{f === "month" ? "This Month" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
                  ))}
                </div>
                <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Doctors" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Doctors</SelectItem>
                    {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="shadow-card border-0">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">No.</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date/Time</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Patient</th>
                        {!isMobile && <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Phone</th>}
                        {!isMobile && <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Gender</th>}
                        {!isMobile && <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Age</th>}
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Complaints</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Dr Name</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Duration</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
                      ) : !filteredAppointments.length ? (
                        <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">No appointments found</td></tr>
                      ) : filteredAppointments.map((apt: any, idx: number) => (
                        <tr key={apt.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-3 text-xs">
                            <div className="text-foreground">{format(new Date(apt.appointment_date + "T00:00:00"), "dd-MM-yy")}</div>
                            <div className="text-muted-foreground">{apt.appointment_time ? format(new Date(`2000-01-01T${apt.appointment_time}`), "h:mm a") : "-"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full gradient-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0">
                                {(apt.patients?.full_name || "?")[0]}
                              </div>
                              <span className="font-medium text-foreground">{apt.patients?.full_name}</span>
                            </div>
                          </td>
                          {!isMobile && <td className="px-4 py-3 text-muted-foreground text-xs">{apt.patients?.phone || "-"}</td>}
                          {!isMobile && <td className="px-4 py-3 text-muted-foreground capitalize text-xs">{apt.patients?.gender || "-"}</td>}
                          {!isMobile && <td className="px-4 py-3 text-muted-foreground text-xs">{calcAge(apt.patients?.date_of_birth)}</td>}
                          <td className="px-4 py-3 text-xs text-muted-foreground">{apt.type || "-"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{apt.provider?.full_name || "-"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{apt.duration_minutes} mins</td>
                          <td className="px-4 py-3">
                            <Select value={apt.status} onValueChange={v => updateStatus.mutate({ id: apt.id, status: v })}>
                              <SelectTrigger className="h-7 w-28 text-[11px] border-0 p-0">
                                <Badge variant="outline" className={`text-[11px] capitalize ${statusStyle[apt.status] || ""}`}>
                                  {apt.status?.replace(/_/g, " ")}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"].map(s =>
                                  <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace(/_/g, " ")}</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/patients/${apt.patient_id}`)} title="View patient">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => cancelAppointment.mutate(apt)}
                                title="Cancel appointment"
                                disabled={apt.status === "cancelled"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                              <WhoChangedHover table="appointments" recordId={apt.id} className="ml-1" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Calendar View */}
        {mainTab === "calendar" && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => navigateDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setCurrentDate(new Date())}>Today</Button>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => navigateDate(1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <h2 className="font-heading font-semibold text-sm">{calDateLabel}</h2>
              <div className="flex items-center gap-2">
                <Tabs value={calendarView} onValueChange={v => setCalendarView(v as any)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="day" className="text-xs h-7 px-3">Day</TabsTrigger>
                    <TabsTrigger value="week" className="text-xs h-7 px-3">Week</TabsTrigger>
                    <TabsTrigger value="month" className="text-xs h-7 px-3">Month</TabsTrigger>
                    <TabsTrigger value="chair" className="text-xs h-7 px-3 gap-1"><Armchair className="h-3 w-3" />Chairs</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Doctors" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Doctors</SelectItem>
                    {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Day View — drag to reschedule between 30-min slots */}
            {calendarView === "day" && (
              <Card className="shadow-card border-0 overflow-hidden">
                <CardContent className="p-0">
                  <div className="max-h-[65vh] overflow-y-auto">
                    {HOURS.map(hour => {
                      const halves = [0, 30];
                      return (
                        <div key={hour} className="flex border-b">
                          <div className="w-16 shrink-0 px-2 py-2 text-xs text-muted-foreground font-medium border-r bg-muted/30 flex items-start justify-end">
                            {format(new Date(2000, 0, 1, hour), "h a")}
                          </div>
                          <div className="flex-1 flex flex-col">
                            {halves.map(min => {
                              const slot = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
                              const slotApts = filteredAppointments.filter((a: any) =>
                                a.appointment_time?.slice(0, 5) === slot &&
                                isSameDay(new Date(a.appointment_date + "T00:00:00"), currentDate)
                              );
                              return (
                                <div
                                  key={min}
                                  onDragOver={allowDrop}
                                  onDrop={(e) => handleDrop(e, currentDate, slot)}
                                  className="min-h-[30px] p-1 border-b last:border-b-0 hover:bg-primary/[0.04] transition-colors"
                                >
                                  {slotApts.map((apt: any) => <AppointmentBlock key={apt.id} apt={apt} />)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Week View — drag to reschedule */}
            {calendarView === "week" && (
              <Card className="shadow-card border-0 overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex border-b bg-muted/30">
                    <div className="w-14 shrink-0 border-r" />
                    {weekDays.map(day => (
                      <div key={day.toISOString()} className={`flex-1 text-center py-2 border-r last:border-r-0 ${isSameDay(day, new Date()) ? "bg-primary/5" : ""}`}>
                        <div className="text-[10px] text-muted-foreground uppercase">{format(day, "EEE")}</div>
                        <div className={`text-sm font-semibold ${isSameDay(day, new Date()) ? "text-primary" : ""}`}>{format(day, "d")}</div>
                      </div>
                    ))}
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {HOURS.map(hour => (
                      <div key={hour} className="flex border-b">
                        <div className="w-14 shrink-0 px-1 py-1 text-[10px] text-muted-foreground font-medium border-r bg-muted/20 flex items-start justify-end">
                          {format(new Date(2000, 0, 1, hour), "h a")}
                        </div>
                        {weekDays.map(day => {
                          const slot = `${String(hour).padStart(2, "0")}:00`;
                          return (
                            <div
                              key={day.toISOString()}
                              onDragOver={allowDrop}
                              onDrop={(e) => handleDrop(e, day, slot)}
                              className={`flex-1 min-h-[48px] p-0.5 border-r last:border-r-0 hover:bg-primary/[0.04] transition-colors ${isSameDay(day, new Date()) ? "bg-primary/5" : ""}`}
                            >
                              {getAptsForHour(hour, day).map((apt: any) => <AppointmentBlock key={apt.id} apt={apt} />)}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chair / Operatory View — one column per doctor (chair), 30-min slots */}
            {calendarView === "chair" && (
              <Card className="shadow-card border-0 overflow-hidden">
                <CardContent className="p-0">
                  {doctors.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No doctors/chairs configured. Add doctors in Staff settings to see chair utilization.
                    </div>
                  ) : (
                    <>
                      <div className="flex border-b bg-muted/30 sticky top-0 z-10">
                        <div className="w-16 shrink-0 border-r" />
                        {doctors.map((d: any) => {
                          const dayApts = filteredAppointments.filter((a: any) =>
                            a.provider_id === d.id &&
                            isSameDay(new Date(a.appointment_date + "T00:00:00"), currentDate) &&
                            a.status !== "cancelled"
                          );
                          const totalMins = dayApts.reduce((s: number, a: any) => s + (a.duration_minutes || 30), 0);
                          const utilPct = Math.min(100, Math.round((totalMins / (HOURS.length * 60)) * 100));
                          return (
                            <div key={d.id} className="flex-1 text-center py-2 border-r last:border-r-0 min-w-[140px]">
                              <div className="flex items-center justify-center gap-1 text-xs font-semibold">
                                <Armchair className="h-3 w-3 text-primary" />{d.full_name || "Chair"}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {dayApts.length} appts · {utilPct}% used
                              </div>
                              <div className="h-1 bg-muted rounded-full overflow-hidden mt-1 mx-2">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    utilPct < 50 ? "bg-success" : utilPct < 80 ? "bg-warning" : "bg-destructive"
                                  )}
                                  style={{ width: `${utilPct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="max-h-[60vh] overflow-y-auto">
                        {HOURS.map(hour => (
                          <div key={hour}>
                            {[0, 30].map(min => {
                              const slot = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
                              return (
                                <div key={`${hour}-${min}`} className="flex border-b">
                                  <div className="w-16 shrink-0 px-2 py-1 text-[10px] text-muted-foreground font-medium border-r bg-muted/20 flex items-start justify-end">
                                    {min === 0 ? format(new Date(2000, 0, 1, hour), "h a") : ":30"}
                                  </div>
                                  {doctors.map((d: any) => {
                                    const slotApts = filteredAppointments.filter((a: any) =>
                                      a.provider_id === d.id &&
                                      a.appointment_time?.slice(0, 5) === slot &&
                                      isSameDay(new Date(a.appointment_date + "T00:00:00"), currentDate)
                                    );
                                    return (
                                      <div
                                        key={d.id}
                                        onDragOver={allowDrop}
                                        onDrop={(e) => handleDrop(e, currentDate, slot, d.id)}
                                        className="flex-1 min-h-[34px] p-0.5 border-r last:border-r-0 hover:bg-primary/[0.04] transition-colors min-w-[140px]"
                                      >
                                        {slotApts.map((apt: any) => <AppointmentBlock key={apt.id} apt={apt} compact />)}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Month View */}
            {calendarView === "month" && (
              <Card className="shadow-card border-0 overflow-hidden">
                <CardContent className="p-0">
                  <div className="grid grid-cols-7 border-b bg-muted/30">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                      <div key={d} className="text-center py-2 text-xs font-medium text-muted-foreground border-r last:border-r-0">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {monthDays.map((day, idx) => {
                      if (!day) return <div key={`pad-${idx}`} className="min-h-[80px] border-r border-b bg-muted/10" />;
                      const dayApts = getAptsForDay(day);
                      return (
                        <div key={day.toISOString()} className={`min-h-[80px] border-r border-b p-1 ${isSameDay(day, new Date()) ? "bg-primary/5" : ""}`}>
                          <div className={`text-xs font-semibold mb-1 ${isSameDay(day, new Date()) ? "text-primary" : "text-muted-foreground"}`}>{format(day, "d")}</div>
                          <div className="space-y-0.5">
                            {dayApts.slice(0, 3).map((apt: any) => <AppointmentBlock key={apt.id} apt={apt} compact />)}
                            {dayApts.length > 3 && <div className="text-[10px] text-muted-foreground text-center">+{dayApts.length - 3} more</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
