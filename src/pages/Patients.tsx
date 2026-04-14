import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, Search, Users, Smile, CalendarDays, Activity, Phone
} from "lucide-react";
import AppointmentSlotPicker from "@/components/patients/AppointmentSlotPicker";

export default function PatientsPage() {
  const navigate = useNavigate();
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [bookAppointment, setBookAppointment] = useState(false);

  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", date_of_birth: "", address: "", notes: "", gender: "",
    appointment_date: "", appointment_time: "", appointment_type: "checkup", doctor_id: "any"
  });

  const { data: patients, isLoading } = useQuery({
    queryKey: ["patients", clinicId, search],
    queryFn: async () => {
      if (!clinicId) return [];
      let q = supabase.from("patients").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false });
      if (search) {
        q = q.or(`full_name.ilike.%${search}%,op_number.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: patientStats } = useQuery({
    queryKey: ["patient-stats", clinicId],
    queryFn: async () => {
      if (!clinicId) return { total: 0, newThisMonth: 0 };
      const { count: total } = await supabase.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId);
      const firstDay = new Date(); firstDay.setDate(1);
      const { count: newThisMonth } = await supabase.from("patients").select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId).gte("created_at", firstDay.toISOString());
      return { total: total ?? 0, newThisMonth: newThisMonth ?? 0 };
    },
    enabled: !!clinicId,
  });

  const validatePhone = (phone: string) => {
    if (!phone) return true;
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setPhoneError("Phone must be exactly 10 digits");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const addPatient = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      if (!form.full_name.trim()) throw new Error("Patient name is required");
      if (form.phone && !validatePhone(form.phone)) throw new Error("Phone must be 10 digits");
      if (form.date_of_birth) {
        const dob = new Date(form.date_of_birth);
        if (dob > new Date()) throw new Error("Date of birth cannot be in the future");
        if (dob < new Date("1900-01-01")) throw new Error("Invalid date of birth");
      }

      const { data: patient, error } = await supabase.from("patients").insert({
        full_name: form.full_name.trim(),
        clinic_id: clinicId,
        email: form.email?.trim() || null,
        phone: form.phone ? form.phone.replace(/\D/g, "") : null,
        date_of_birth: form.date_of_birth || null,
        address: form.address?.trim() || null,
        notes: form.notes?.trim() || null,
        gender: form.gender || null,
      }).select().single();
      if (error) throw error;

      if (bookAppointment && form.appointment_date && form.appointment_time) {
        const insertData: any = {
          clinic_id: clinicId,
          patient_id: patient.id,
          appointment_date: form.appointment_date,
          appointment_time: form.appointment_time,
          type: form.appointment_type,
          status: "scheduled",
        };
        if (form.doctor_id && form.doctor_id !== "any") {
          insertData.doctor_id = form.doctor_id;
        }
        const { error: aptError } = await supabase.from("appointments").insert(insertData);
        if (aptError) {
          toast.warning("Patient added but appointment failed: " + aptError.message);
        }
      }

      return patient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patient-stats"] });
      setOpen(false);
      setForm({ full_name: "", email: "", phone: "", date_of_birth: "", address: "", notes: "", gender: "", appointment_date: "", appointment_time: "", appointment_type: "checkup" });
      setBookAppointment(false);
      setPhoneError("");
      toast.success("Patient added successfully!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const calcAge = (dob: string | null) => {
    if (!dob) return "—";
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const today = new Date().toISOString().split("T")[0];

  // Form content shared between Dialog and Drawer
  const formContent = (
    <form onSubmit={e => { e.preventDefault(); addPatient.mutate(); }} className="space-y-4 p-1">
      <div className="space-y-1.5">
        <Label>Full Name <span className="text-destructive">*</span></Label>
        <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Patient full name" required maxLength={100} className="h-11" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Phone (10 digits)</Label>
          <Input
            value={form.phone}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 10);
              setForm(f => ({ ...f, phone: val }));
              if (val && val.length === 10) setPhoneError("");
              else if (val) setPhoneError("Must be 10 digits");
              else setPhoneError("");
            }}
            placeholder="9876543210" maxLength={10} inputMode="numeric" className="h-11"
          />
          {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Gender</Label>
          <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Date of Birth</Label>
          <Input type="date" max={today} min="1900-01-01" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="optional" className="h-11" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Address</Label>
        <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="optional" className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any notes" />
      </div>
      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Book Appointment Now?</Label>
          <Switch checked={bookAppointment} onCheckedChange={setBookAppointment} />
        </div>
        {bookAppointment && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date <span className="text-destructive">*</span></Label>
                <Input type="date" min={today} value={form.appointment_date} onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))} required={bookAppointment} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Time <span className="text-destructive">*</span></Label>
                <Input type="time" value={form.appointment_time} onChange={e => setForm(f => ({ ...f, appointment_time: e.target.value }))} required={bookAppointment} className="h-11" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={form.appointment_type} onValueChange={v => setForm(f => ({ ...f, appointment_type: v }))}>
                <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checkup">Checkup</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                  <SelectItem value="filling">Filling</SelectItem>
                  <SelectItem value="extraction">Extraction</SelectItem>
                  <SelectItem value="root_canal">Root Canal</SelectItem>
                  <SelectItem value="crown">Crown/Bridge</SelectItem>
                  <SelectItem value="ortho">Orthodontics</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
      <Button type="submit" className="w-full h-12 text-base" disabled={addPatient.isPending || !!phoneError}>
        {addPatient.isPending ? "Registering..." : bookAppointment ? "Register & Book" : "Register Patient"}
      </Button>
    </form>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Patients</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Register and manage patient records</p>
          </div>
          {/* Desktop: Dialog, Mobile: hidden (use FAB) */}
          {!isMobile && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> New Patient</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Register New Patient</DialogTitle></DialogHeader>
                {formContent}
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid gap-3 grid-cols-3">
          <Card className="shadow-card border-0">
            <CardContent className="p-3 md:p-5 flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Total</p>
                <p className="text-lg md:text-2xl font-bold font-heading">{patientStats?.total ?? 0}</p>
              </div>
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-accent flex items-center justify-center"><Users className="h-4 w-4 md:h-5 md:w-5 text-primary" /></div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="p-3 md:p-5 flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">New</p>
                <p className="text-lg md:text-2xl font-bold font-heading">{patientStats?.newThisMonth ?? 0}</p>
              </div>
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-accent flex items-center justify-center"><CalendarDays className="h-4 w-4 md:h-5 md:w-5 text-primary" /></div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="p-3 md:p-5 flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Active</p>
                <p className="text-lg md:text-2xl font-bold font-heading">{patients?.length ?? 0}</p>
              </div>
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-accent flex items-center justify-center"><Activity className="h-4 w-4 md:h-5 md:w-5 text-primary" /></div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, OP#, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11" />
        </div>

        {/* Mobile: Contact card list */}
        {isMobile ? (
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Loading...</p>
            ) : !patients?.length ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No patients yet. Tap + to register.</p>
            ) : patients.map(p => (
              <Card
                key={p.id}
                className="shadow-card border-0 cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/patients/${p.id}`)}
              >
                <CardContent className="p-3 flex items-center gap-3 min-h-[56px]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-sm font-bold text-primary-foreground shrink-0">
                    {p.full_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.full_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {p.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />{p.phone}
                        </span>
                      )}
                      <span>Age: {calcAge(p.date_of_birth)}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {(p as any).op_number || "—"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Desktop: Table */
          <Card className="shadow-card border-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>OP #</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : !patients?.length ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No patients yet. Click "New Patient" to register.</TableCell></TableRow>
                  ) : patients.map(p => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/patients/${p.id}`)}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{(p as any).op_number || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                            {p.full_name[0].toUpperCase()}
                          </div>
                          <span className="font-medium">{p.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{p.phone || "—"}</TableCell>
                      <TableCell>{calcAge(p.date_of_birth)}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); navigate(`/dental-chart/${p.id}`); }}>
                          <Smile className="h-3 w-3 mr-1" /> Chart
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mobile FAB */}
      {isMobile && (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <button className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full gradient-primary shadow-lg flex items-center justify-center active:scale-95 transition-transform">
              <Plus className="h-6 w-6 text-primary-foreground" />
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>Register New Patient</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 overflow-y-auto max-h-[75vh]">
              {formContent}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </DashboardLayout>
  );
}
