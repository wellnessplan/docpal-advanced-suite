import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import AppointmentSlotPicker from "@/components/patients/AppointmentSlotPicker";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefillPatient?: { id: string; full_name: string } | null;
  onCreated?: (apt: { id: string; patient_id: string }) => void;
}

export default function NewAppointmentDialog({ open, onOpenChange, prefillPatient, onCreated }: Props) {
  const { clinicId } = useAuth();
  const qc = useQueryClient();

  const [patientId, setPatientId] = useState<string>("");
  const [patientName, setPatientName] = useState<string>("");
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [doctor, setDoctor] = useState("any");
  const [type, setType] = useState("checkup");
  const [duration, setDuration] = useState("30");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && prefillPatient) {
      setPatientId(prefillPatient.id);
      setPatientName(prefillPatient.full_name);
    }
    if (!open) {
      setPatientId(""); setPatientName(""); setDate(""); setTime("");
      setDoctor("any"); setType("checkup"); setDuration("30"); setNotes("");
    }
  }, [open, prefillPatient]);

  const { data: patients = [] } = useQuery({
    queryKey: ["new-apt-patients", clinicId],
    queryFn: async () => (await supabase.from("patients")
      .select("id, full_name, phone").eq("clinic_id", clinicId!)
      .order("created_at", { ascending: false }).limit(500)).data ?? [],
    enabled: !!clinicId && open,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      if (!patientId) throw new Error("Please select a patient");
      if (!date || !time) throw new Error("Please pick date and time");
      const payload: any = {
        clinic_id: clinicId,
        patient_id: patientId,
        appointment_date: date,
        appointment_time: time,
        duration_minutes: parseInt(duration, 10) || 30,
        type,
        notes: notes?.trim() || null,
        status: "scheduled",
      };
      if (doctor && doctor !== "any") payload.doctor_id = doctor;
      const { data, error } = await supabase.from("appointments").insert(payload).select("id, patient_id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (apt) => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dash-appts"] });
      qc.invalidateQueries({ queryKey: ["booked-slots"] });
      toast.success("Appointment booked");
      onOpenChange(false);
      onCreated?.(apt);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredPatients = useMemo(() => patients, [patients]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Appointment</DialogTitle>
          <DialogDescription>
            {prefillPatient
              ? `Booking for ${prefillPatient.full_name} — pick a slot to finish.`
              : "Choose patient, date, time and provider."}
          </DialogDescription>
        </DialogHeader>
        {prefillPatient && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">
            Continuing from <strong>New Patient</strong> → <strong>{prefillPatient.full_name}</strong> is pre-selected.
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Patient <span className="text-destructive">*</span></Label>
            <Popover open={patientPickerOpen} onOpenChange={setPatientPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox"
                  className={cn("w-full justify-between h-11 font-normal", !patientName && "text-muted-foreground")}>
                  {patientName || "Select patient..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search patient by name or phone..." />
                  <CommandList>
                    <CommandEmpty>No patient found.</CommandEmpty>
                    <CommandGroup>
                      {filteredPatients.map((p: any) => (
                        <CommandItem key={p.id} value={`${p.full_name} ${p.phone ?? ""}`}
                          onSelect={() => { setPatientId(p.id); setPatientName(p.full_name); setPatientPickerOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", patientId === p.id ? "opacity-100" : "opacity-0")} />
                          <span className="flex-1">{p.full_name}</span>
                          {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <AppointmentSlotPicker
            selectedDate={date}
            selectedTime={time}
            selectedDoctor={doctor}
            appointmentType={type}
            onDateChange={(v) => { setDate(v); setTime(""); }}
            onTimeChange={setTime}
            onDoctorChange={setDoctor}
            onTypeChange={setType}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["15", "30", "45", "60", "90"].map(d => <SelectItem key={d} value={d}>{d} mins</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="optional" className="h-11" />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending || !patientId || !date || !time}>
              {save.isPending ? "Booking..." : "Book Appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
