import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, User, CalendarDays } from "lucide-react";

interface AppointmentSlotPickerProps {
  selectedDate: string;
  selectedTime: string;
  selectedDoctor: string;
  appointmentType: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onDoctorChange: (doctorId: string) => void;
  onTypeChange: (type: string) => void;
  required?: boolean;
}

const SLOT_START_HOUR = 9; // 9 AM
const SLOT_END_HOUR = 21; // 9 PM
const SLOT_INTERVAL = 30; // minutes

function generateTimeSlots() {
  const slots: string[] = [];
  for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_INTERVAL) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

function formatTime12(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const ALL_SLOTS = generateTimeSlots();

export default function AppointmentSlotPicker({
  selectedDate, selectedTime, selectedDoctor, appointmentType,
  onDateChange, onTimeChange, onDoctorChange, onTypeChange,
  required = false,
}: AppointmentSlotPickerProps) {
  const { clinicId } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  // Fetch doctors
  const { data: doctors } = useQuery({
    queryKey: ["doctors-list", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, specialization")
        .eq("clinic_id", clinicId)
        .in("role", ["doctor", "admin"]);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Fetch booked appointments for selected date + doctor
  const { data: bookedAppointments } = useQuery({
    queryKey: ["booked-slots", clinicId, selectedDate, selectedDoctor],
    queryFn: async () => {
      if (!clinicId || !selectedDate) return [];
      let q = supabase
        .from("appointments")
        .select("appointment_time, status, patient_id, duration_minutes")
        .eq("clinic_id", clinicId)
        .eq("appointment_date", selectedDate)
        .neq("status", "cancelled");
      if (selectedDoctor && selectedDoctor !== "any") {
        q = q.eq("doctor_id", selectedDoctor);
      }
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!clinicId && !!selectedDate,
  });

  const bookedTimesSet = useMemo(() => {
    const set = new Set<string>();
    bookedAppointments?.forEach((apt) => {
      // Mark the slot and subsequent slots based on duration
      const [h, m] = apt.appointment_time.split(":").map(Number);
      const duration = apt.duration_minutes || 30;
      const slotsNeeded = Math.ceil(duration / SLOT_INTERVAL);
      for (let i = 0; i < slotsNeeded; i++) {
        const totalMin = h * 60 + m + i * SLOT_INTERVAL;
        const sh = Math.floor(totalMin / 60);
        const sm = totalMin % 60;
        set.add(`${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`);
      }
    });
    return set;
  }, [bookedAppointments]);

  // Group slots by morning/afternoon/evening
  const slotGroups = useMemo(() => {
    const morning: string[] = [];
    const afternoon: string[] = [];
    const evening: string[] = [];
    ALL_SLOTS.forEach((slot) => {
      const h = parseInt(slot.split(":")[0]);
      if (h < 12) morning.push(slot);
      else if (h < 17) afternoon.push(slot);
      else evening.push(slot);
    });
    return { morning, afternoon, evening };
  }, []);

  const totalBooked = bookedTimesSet.size;
  const totalSlots = ALL_SLOTS.length;
  const totalAvailable = totalSlots - totalBooked;

  return (
    <div className="space-y-4">
      {/* Doctor Selection */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" /> Doctor
        </Label>
        <Select value={selectedDoctor} onValueChange={onDoctorChange}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select doctor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Available Doctor</SelectItem>
            {doctors?.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.full_name}{d.specialization ? ` — ${d.specialization}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date + Type Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> Date {required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            type="date"
            min={today}
            value={selectedDate}
            onChange={(e) => { onDateChange(e.target.value); onTimeChange(""); }}
            required={required}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={appointmentType} onValueChange={onTypeChange}>
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

      {/* Slot Grid */}
      {selectedDate && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-primary/10 border border-primary/30" />
              <span className="text-muted-foreground">Available ({totalAvailable})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-destructive/20 border border-destructive/30" />
              <span className="text-muted-foreground">Booked ({totalBooked})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-primary border border-primary" />
              <span className="text-muted-foreground">Selected</span>
            </div>
          </div>

          {/* Time Period Groups */}
          {([
            { label: "🌅 Morning", slots: slotGroups.morning },
            { label: "☀️ Afternoon", slots: slotGroups.afternoon },
            { label: "🌙 Evening", slots: slotGroups.evening },
          ] as const).map(({ label, slots }) => (
            slots.length > 0 && (
              <div key={label} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {slots.map((slot) => {
                    const isBooked = bookedTimesSet.has(slot);
                    const isSelected = selectedTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBooked}
                        onClick={() => onTimeChange(slot)}
                        className={cn(
                          "h-9 rounded-md text-xs font-medium transition-all border",
                          isBooked
                            ? "bg-destructive/10 border-destructive/20 text-destructive/50 cursor-not-allowed line-through"
                            : isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                              : "bg-card border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer active:scale-95"
                        )}
                      >
                        {formatTime12(slot)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ))}

          {selectedTime && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                Selected: <span className="text-primary">{formatTime12(selectedTime)}</span>
                {selectedDoctor && selectedDoctor !== "any" && doctors?.find(d => d.id === selectedDoctor) && (
                  <span className="text-muted-foreground"> with Dr. {doctors.find(d => d.id === selectedDoctor)?.full_name}</span>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
