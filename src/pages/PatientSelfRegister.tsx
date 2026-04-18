import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Stethoscope, CheckCircle2, UserPlus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// Lazy-load the QR library (~50KB) so the registration form opens instantly
const QRCode = lazy(async () => {
  const m = await import("qrcode.react");
  return { default: m.QRCodeSVG as unknown as React.ComponentType<{ value: string; size?: number }> };
});

const SLOT_INTERVAL_MIN = 15;
const SLOTS_TO_SHOW = 8;

function buildSlots(now: Date): { value: string; date: string; label: string; sublabel: string }[] {
  // Round up to next 15-minute mark
  const start = new Date(now);
  start.setSeconds(0, 0);
  const minutes = start.getMinutes();
  const remainder = minutes % SLOT_INTERVAL_MIN;
  if (remainder !== 0) start.setMinutes(minutes + (SLOT_INTERVAL_MIN - remainder));
  else start.setMinutes(minutes + SLOT_INTERVAL_MIN);

  const slots: { value: string; date: string; label: string; sublabel: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < SLOTS_TO_SHOW; i++) {
    const d = new Date(start.getTime() + i * SLOT_INTERVAL_MIN * 60_000);
    const date = d.toISOString().split("T")[0];
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const dayDiff = Math.round((dayStart.getTime() - today.getTime()) / 86_400_000);
    const dayLabel = dayDiff === 0 ? "Today" : dayDiff === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short" });
    const h = d.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    slots.push({
      value: `${date}|${time}`,
      date,
      label: `${h12}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`,
      sublabel: dayLabel,
    });
  }
  return slots;
}

export default function PatientSelfRegister() {
  const [searchParams] = useSearchParams();
  const clinicId = searchParams.get("clinic");
  const [loading, setLoading] = useState(false);
  const [tokenNumber, setTokenNumber] = useState<number | null>(null);
  const [registered, setRegistered] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string>("now");

  // Compute slots once on mount (cheap, no DB call)
  const slots = useMemo(() => buildSlots(new Date()), []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) { toast.error("Invalid registration link. Please scan the QR code again."); return; }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clinicId)) { toast.error("Invalid clinic ID format."); return; }

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length > 200) { toast.error("Name must be between 1 and 200 characters."); return; }
    if (phone && (phone.length < 7 || phone.length > 20)) { toast.error("Phone number must be between 7 and 20 characters."); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Please enter a valid email address."); return; }

    setLoading(true);
    const patientId = crypto.randomUUID();

    const { error: patientError } = await supabase
      .from("patients")
      .insert({
        id: patientId,
        clinic_id: clinicId,
        full_name: trimmedName,
        phone: phone || null,
        email: email || null,
        date_of_birth: dob || null,
      });

    if (patientError) { toast.error("Registration failed: " + patientError.message); setLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];

    // Create appointment if a future slot was picked
    if (selectedSlot && selectedSlot !== "now") {
      const [aDate, aTime] = selectedSlot.split("|");
      await supabase.from("appointments").insert({
        clinic_id: clinicId,
        patient_id: patientId,
        appointment_date: aDate,
        appointment_time: aTime,
        status: "scheduled",
        type: "checkup",
        duration_minutes: 30,
      });
    }

    // Always issue a queue token for today (so they can be seen if they walk in)
    const { data: nextToken, error: tokenError } = await supabase
      .rpc("get_next_token_number", { p_clinic_id: clinicId, p_date: today });

    if (tokenError) { toast.error("Failed to generate token: " + tokenError.message); setLoading(false); return; }

    const { error: queueError } = await supabase
      .from("queue_tokens")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        token_number: nextToken,
        queue_date: today,
        status: "waiting",
        priority: "normal",
      });

    if (queueError) { toast.error("Failed to add to queue: " + queueError.message); setLoading(false); return; }

    setTokenNumber(nextToken);
    setRegistered(true);
    setLoading(false);
  };

  if (!clinicId) return <QRCodeGenerator />;

  if (registered && tokenNumber !== null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50 p-4">
        <Card className="w-full max-w-sm text-center shadow-lg border-0">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">Registration Successful!</h2>
            <div className="bg-blue-50 rounded-2xl p-6">
              <p className="text-sm text-muted-foreground mb-1">Your Token Number</p>
              <p className="text-6xl font-bold text-blue-600">{tokenNumber}</p>
            </div>
            {selectedSlot !== "now" && (
              <p className="text-sm text-muted-foreground">
                Appointment booked for <strong>{slots.find(s => s.value === selectedSlot)?.sublabel} at {slots.find(s => s.value === selectedSlot)?.label}</strong>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Thank you, <strong>{fullName}</strong>!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-400">
            <UserPlus className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Patient Registration</h1>
          <p className="text-sm text-muted-foreground mt-1">Fill in your details to get a queue token</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardContent className="pt-6">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)}
                  required placeholder="Enter your full name" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210" type="tel" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="patient@email.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input value={dob} onChange={e => setDob(e.target.value)} type="date" max={new Date().toISOString().split("T")[0]} />
              </div>

              {/* Quick Slot Picker */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Preferred Time
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedSlot("now")}
                    className={cn(
                      "rounded-md border p-2 text-xs font-medium transition-all text-center",
                      selectedSlot === "now"
                        ? "bg-blue-600 text-white border-blue-600 shadow"
                        : "bg-white border-border hover:border-blue-400 active:scale-95"
                    )}
                  >
                    <div className="font-bold">Walk-in</div>
                    <div className="text-[10px] opacity-80">Now</div>
                  </button>
                  {slots.slice(0, 5).map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSelectedSlot(s.value)}
                      className={cn(
                        "rounded-md border p-2 text-xs font-medium transition-all text-center",
                        selectedSlot === s.value
                          ? "bg-blue-600 text-white border-blue-600 shadow"
                          : "bg-white border-border hover:border-blue-400 active:scale-95"
                      )}
                    >
                      <div className="font-bold">{s.label}</div>
                      <div className="text-[10px] opacity-80">{s.sublabel}</div>
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
                {loading ? "Registering..." : selectedSlot === "now" ? "Register & Get Token" : "Book Appointment & Get Token"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QRCodeGenerator() {
  const [clinicId, setClinicId] = useState("");
  const registrationUrl = clinicId
    ? `${window.location.origin}/register?clinic=${clinicId}`
    : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Generate Patient Registration QR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Clinic ID</Label>
            <Input value={clinicId} onChange={e => setClinicId(e.target.value)}
              placeholder="Enter your clinic ID" />
          </div>
          {registrationUrl && (
            <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-xl border">
              <Suspense fallback={<div className="h-[200px] w-[200px] animate-pulse rounded bg-muted" />}>
                <QRCode value={registrationUrl} size={200} />
              </Suspense>
              <p className="text-xs text-muted-foreground text-center break-all">{registrationUrl}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
