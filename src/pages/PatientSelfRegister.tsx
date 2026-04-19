import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Stethoscope, CheckCircle2, UserPlus, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// Lazy-load the QR library so the form opens instantly
const QRCode = lazy(async () => {
  const m = await import("qrcode.react");
  return { default: m.QRCodeSVG as unknown as React.ComponentType<{ value: string; size?: number }> };
});

// ─── Types ───────────────────────────────────────────────
interface WorkingHour {
  day_of_week: number;
  is_closed: boolean;
  open_time: string;       // "HH:MM" or "HH:MM:SS"
  close_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_duration_minutes: number;
}

interface ActionLink { label: string; url: string; color: string; }

interface RegSettings {
  welcome_heading: string;
  welcome_subheading: string;
  banner_image_url: string | null;
  brand_color: string;
  thank_you_heading: string;
  thank_you_message: string;
  show_logo: boolean;
  action_links: ActionLink[];
}

interface ClinicMini { name: string; logo_url: string | null; }

const DEFAULT_SETTINGS: RegSettings = {
  welcome_heading: "Patient Registration",
  welcome_subheading: "Fill in your details to get a queue token",
  banner_image_url: null,
  brand_color: "#2563eb",
  thank_you_heading: "Registration Successful!",
  thank_you_message: "Thank you for registering. Please wait for your token to be called.",
  show_logo: true,
  action_links: [],
};

// ─── Slot generation ──────────────────────────────────────
interface Slot { value: string; date: string; label: string; sublabel: string; }

const SLOTS_TO_SHOW = 6;
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function pad(n: number) { return String(n).padStart(2, "0"); }
function fmt12(h: number, m: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${pad(m)} ${ampm}`;
}

/**
 * Build appointment slots that fall inside the clinic's working hours.
 * Walks forward day-by-day (max 7 days) until SLOTS_TO_SHOW are collected.
 */
function buildSlots(now: Date, hours: WorkingHour[]): Slot[] {
  if (!hours.length) return [];
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const out: Slot[] = [];

  for (let dayOffset = 0; dayOffset < 7 && out.length < SLOTS_TO_SHOW; dayOffset++) {
    const d = new Date(today.getTime() + dayOffset * 86_400_000);
    const dow = d.getDay();
    const wh = hours.find((h) => h.day_of_week === dow);
    if (!wh || wh.is_closed) continue;

    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const slotMin = wh.slot_duration_minutes || 30;
    const openMin = toMinutes(wh.open_time);
    const closeMin = toMinutes(wh.close_time);
    const brkStart = wh.break_start ? toMinutes(wh.break_start) : null;
    const brkEnd = wh.break_end ? toMinutes(wh.break_end) : null;

    // Determine starting minute of the day
    let startMin = openMin;
    if (dayOffset === 0) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin > startMin) {
        // Round up to next slot boundary
        const remainder = (nowMin - openMin) % slotMin;
        startMin = nowMin + (remainder === 0 ? 0 : slotMin - remainder);
      }
    }

    for (let m = startMin; m + slotMin <= closeMin && out.length < SLOTS_TO_SHOW; m += slotMin) {
      // Skip break window
      if (brkStart != null && brkEnd != null && m >= brkStart && m < brkEnd) continue;
      const hh = Math.floor(m / 60), mm = m % 60;
      const time = `${pad(hh)}:${pad(mm)}`;
      const label = fmt12(hh, mm);
      const sublabel = dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow" : DAYS_SHORT[dow];
      out.push({ value: `${dateStr}|${time}`, date: dateStr, label, sublabel });
    }
  }
  return out;
}

// ─── Main component ──────────────────────────────────────
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

  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [settings, setSettings] = useState<RegSettings>(DEFAULT_SETTINGS);
  const [clinic, setClinic] = useState<ClinicMini | null>(null);

  // Fetch working hours, registration settings, and clinic info in parallel
  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      const [whRes, rsRes, cRes] = await Promise.all([
        (supabase as any).from("clinic_working_hours").select("*").eq("clinic_id", clinicId).order("day_of_week"),
        (supabase as any).from("clinic_registration_settings").select("*").eq("clinic_id", clinicId).maybeSingle(),
        supabase.from("clinics").select("name, logo_url").eq("id", clinicId).maybeSingle(),
      ]);
      if (whRes.data) setHours(whRes.data);
      if (rsRes.data) {
        setSettings({
          welcome_heading: rsRes.data.welcome_heading ?? DEFAULT_SETTINGS.welcome_heading,
          welcome_subheading: rsRes.data.welcome_subheading ?? DEFAULT_SETTINGS.welcome_subheading,
          banner_image_url: rsRes.data.banner_image_url,
          brand_color: rsRes.data.brand_color ?? DEFAULT_SETTINGS.brand_color,
          thank_you_heading: rsRes.data.thank_you_heading ?? DEFAULT_SETTINGS.thank_you_heading,
          thank_you_message: rsRes.data.thank_you_message ?? DEFAULT_SETTINGS.thank_you_message,
          show_logo: rsRes.data.show_logo ?? true,
          action_links: Array.isArray(rsRes.data.action_links) ? rsRes.data.action_links : [],
        });
      }
      if (cRes.data) setClinic(cRes.data as ClinicMini);
    })();
  }, [clinicId]);

  const slots = useMemo(() => buildSlots(new Date(), hours), [hours]);

  // Is the clinic currently open?
  const isOpenNow = useMemo(() => {
    if (!hours.length) return true; // assume open until config loads
    const now = new Date();
    const wh = hours.find((h) => h.day_of_week === now.getDay());
    if (!wh || wh.is_closed) return false;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < toMinutes(wh.open_time) || nowMin >= toMinutes(wh.close_time)) return false;
    if (wh.break_start && wh.break_end) {
      const bs = toMinutes(wh.break_start), be = toMinutes(wh.break_end);
      if (nowMin >= bs && nowMin < be) return false;
    }
    return true;
  }, [hours]);

  // Default selection: walk-in if open, else first available slot
  useEffect(() => {
    if (!isOpenNow && slots.length > 0 && selectedSlot === "now") {
      setSelectedSlot(slots[0].value);
    }
  }, [isOpenNow, slots, selectedSlot]);

  const brand = settings.brand_color;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) { toast.error("Invalid registration link."); return; }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clinicId)) { toast.error("Invalid clinic ID."); return; }

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length > 200) { toast.error("Enter your name."); return; }
    if (phone && (phone.length < 7 || phone.length > 20)) { toast.error("Phone number must be 7–20 characters."); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Enter a valid email."); return; }

    setLoading(true);
    const patientId = crypto.randomUUID();

    const { error: patientError } = await supabase.from("patients").insert({
      id: patientId, clinic_id: clinicId, full_name: trimmedName,
      phone: phone || null, email: email || null, date_of_birth: dob || null,
    });
    if (patientError) { toast.error("Registration failed: " + patientError.message); setLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];

    if (selectedSlot && selectedSlot !== "now") {
      const [aDate, aTime] = selectedSlot.split("|");
      await supabase.from("appointments").insert({
        clinic_id: clinicId, patient_id: patientId,
        appointment_date: aDate, appointment_time: aTime,
        status: "scheduled", type: "checkup", duration_minutes: 30,
      });
    }

    const { data: nextToken, error: tokenError } = await supabase
      .rpc("get_next_token_number", { p_clinic_id: clinicId, p_date: today });
    if (tokenError) { toast.error("Failed to generate token: " + tokenError.message); setLoading(false); return; }

    const { error: queueError } = await supabase.from("queue_tokens").insert({
      clinic_id: clinicId, patient_id: patientId, token_number: nextToken,
      queue_date: today, status: "waiting", priority: "normal",
    });
    if (queueError) { toast.error("Failed to add to queue: " + queueError.message); setLoading(false); return; }

    setTokenNumber(nextToken);
    setRegistered(true);
    setLoading(false);
  };

  if (!clinicId) return <QRCodeGenerator />;

  // ── Thank-you / Token screen ────────────────────────────
  if (registered && tokenNumber !== null) {
    const selected = slots.find((s) => s.value === selectedSlot);
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4"
        style={{ background: `linear-gradient(135deg, ${brand}15, ${brand}05)` }}
      >
        <Card className="w-full max-w-sm text-center shadow-lg border-0">
          <CardContent className="pt-8 pb-8 space-y-4">
            {settings.show_logo && clinic?.logo_url && (
              <img src={clinic.logo_url} alt="Clinic logo" className="mx-auto h-14 object-contain" />
            )}
            <CheckCircle2 className="h-16 w-16 mx-auto" style={{ color: brand }} />
            <h2 className="text-2xl font-bold text-foreground">{settings.thank_you_heading}</h2>
            <div className="rounded-2xl p-6" style={{ background: `${brand}15` }}>
              <p className="text-sm text-muted-foreground mb-1">Your Token Number</p>
              <p className="text-6xl font-bold" style={{ color: brand }}>{tokenNumber}</p>
            </div>
            {selected && (
              <p className="text-sm text-muted-foreground">
                Appointment for <strong>{selected.sublabel} at {selected.label}</strong>
              </p>
            )}
            <p className="text-sm text-muted-foreground">{settings.thank_you_message}</p>
            <p className="text-sm font-semibold">Thank you, {fullName}!</p>

            {settings.action_links.length > 0 && (
              <div className="space-y-2 pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">While you wait</p>
                {settings.action_links.filter((l) => l.label && l.url).map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-lg py-2.5 text-sm font-semibold text-white shadow active:scale-95 transition-transform"
                    style={{ background: link.color || brand }}
                  >
                    {link.label} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Registration form ───────────────────────────────────
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${brand}15, ${brand}05)` }}
    >
      <div className="w-full max-w-md">
        {settings.banner_image_url && (
          <img
            src={settings.banner_image_url}
            alt="Banner"
            className="w-full h-32 object-cover rounded-xl mb-4 shadow"
          />
        )}

        <div className="mb-6 text-center">
          {settings.show_logo && clinic?.logo_url ? (
            <img src={clinic.logo_url} alt="Clinic logo" className="mx-auto mb-3 h-14 object-contain" />
          ) : (
            <div
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: brand }}
            >
              <UserPlus className="h-7 w-7 text-white" />
            </div>
          )}
          {clinic?.name && <p className="text-xs text-muted-foreground mb-1">{clinic.name}</p>}
          <h1 className="text-2xl font-bold text-foreground">{settings.welcome_heading}</h1>
          <p className="text-sm text-muted-foreground mt-1">{settings.welcome_subheading}</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardContent className="pt-6">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Enter your full name" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="patient@email.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input value={dob} onChange={(e) => setDob(e.target.value)} type="date" max={new Date().toISOString().split("T")[0]} />
              </div>

              {/* Slot picker */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Preferred Time
                </Label>
                {!isOpenNow && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Clinic is currently closed. Pick the next available slot.
                  </p>
                )}
                <div className="grid grid-cols-3 gap-1.5">
                  {isOpenNow && (
                    <button
                      type="button"
                      onClick={() => setSelectedSlot("now")}
                      className={cn(
                        "rounded-md border p-2 text-xs font-medium transition-all text-center",
                        selectedSlot === "now"
                          ? "text-white shadow"
                          : "bg-card border-border hover:opacity-80 active:scale-95"
                      )}
                      style={selectedSlot === "now" ? { background: brand, borderColor: brand } : undefined}
                    >
                      <div className="font-bold">Walk-in</div>
                      <div className="text-[10px] opacity-80">Now</div>
                    </button>
                  )}
                  {slots.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSelectedSlot(s.value)}
                      className={cn(
                        "rounded-md border p-2 text-xs font-medium transition-all text-center",
                        selectedSlot === s.value
                          ? "text-white shadow"
                          : "bg-card border-border hover:opacity-80 active:scale-95"
                      )}
                      style={selectedSlot === s.value ? { background: brand, borderColor: brand } : undefined}
                    >
                      <div className="font-bold">{s.label}</div>
                      <div className="text-[10px] opacity-80">{s.sublabel}</div>
                    </button>
                  ))}
                  {slots.length === 0 && !isOpenNow && (
                    <p className="col-span-3 text-xs text-muted-foreground italic text-center py-3">
                      No slots available this week. Please contact the clinic.
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full text-white border-0"
                style={{ background: brand }}
                disabled={loading || (!isOpenNow && slots.length === 0)}
              >
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
  const registrationUrl = clinicId ? `${window.location.origin}/register?clinic=${clinicId}` : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" /> Generate Patient Registration QR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Clinic ID</Label>
            <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Enter your clinic ID" />
          </div>
          {registrationUrl && (
            <div className="flex flex-col items-center gap-4 p-4 bg-card rounded-xl border">
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
