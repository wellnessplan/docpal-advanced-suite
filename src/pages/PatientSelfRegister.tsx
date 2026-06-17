import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, UserPlus, Clock, ExternalLink, User, Phone, Mail, Cake, MapPin, FileText, ShieldCheck, CalendarClock, Timer, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import TokenShareActions from "@/components/patients/TokenShareActions";

const QRCodeGenerator = lazy(() => import("./PatientSelfRegisterQR"));

interface WorkingHour {
  day_of_week: number; is_closed: boolean;
  open_time: string; close_time: string;
  break_start: string | null; break_end: string | null;
  slot_duration_minutes: number;
}
interface ActionLink { label: string; url: string; color: string; }
interface RegSettings {
  welcome_heading: string; welcome_subheading: string;
  banner_image_url: string | null; brand_color: string;
  thank_you_heading: string; thank_you_message: string;
  show_logo: boolean; action_links: ActionLink[];
}
interface ClinicBrand { name: string; logo_url: string | null; brand_color: string; }

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

interface Slot { value: string; date: string; time: string; label: string; sublabel: string; duration: number; }
const SLOTS_TO_SHOW = 9;
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const pad = (n: number) => String(n).padStart(2, "0");
const fmt12 = (h: number, m: number) => {
  const ampm = h >= 12 ? "PM" : "AM"; const h12 = h % 12 || 12;
  return `${h12}:${pad(m)} ${ampm}`;
};

function buildSlots(now: Date, hours: WorkingHour[], booked: Set<string>): Slot[] {
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
    let startMin = openMin;
    if (dayOffset === 0) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin > startMin) {
        const remainder = (nowMin - openMin) % slotMin;
        startMin = nowMin + (remainder === 0 ? 0 : slotMin - remainder);
      }
    }
    for (let m = startMin; m + slotMin <= closeMin && out.length < SLOTS_TO_SHOW; m += slotMin) {
      if (brkStart != null && brkEnd != null && m >= brkStart && m < brkEnd) continue;
      const hh = Math.floor(m / 60), mm = m % 60;
      const time = `${pad(hh)}:${pad(mm)}`;
      if (booked.has(`${dateStr}|${time}`)) continue;
      const label = fmt12(hh, mm);
      const sublabel = dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow" : DAYS_SHORT[dow];
      out.push({ value: `${dateStr}|${time}`, date: dateStr, time, label, sublabel, duration: slotMin });
    }
  }
  return out;
}

export default function PatientSelfRegister() {
  const [searchParams] = useSearchParams();
  const clinicId = searchParams.get("clinic");
  const [loading, setLoading] = useState(false);
  const [tokenNumber, setTokenNumber] = useState<number | null>(null);
  const [registered, setRegistered] = useState(false);

  // Form fields — mirror the in-clinic "Add Patient" intake
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string>("now");

  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [settings, setSettings] = useState<RegSettings>(DEFAULT_SETTINGS);
  const [clinic, setClinic] = useState<ClinicBrand | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      const [whRes, rsRes, brandRes] = await Promise.all([
        (supabase as any).from("clinic_working_hours").select("*").eq("clinic_id", clinicId).order("day_of_week"),
        (supabase as any).from("clinic_registration_settings").select("*").eq("clinic_id", clinicId).maybeSingle(),
        (supabase as any).rpc("get_public_clinic_brand", { p_clinic_id: clinicId }),
      ]);
      if (whRes.data) setHours(whRes.data);
      const brand = (brandRes?.data ?? null) as ClinicBrand | null;
      if (brand) setClinic(brand);
      if (rsRes.data) {
        setSettings({
          welcome_heading: rsRes.data.welcome_heading ?? DEFAULT_SETTINGS.welcome_heading,
          welcome_subheading: rsRes.data.welcome_subheading ?? DEFAULT_SETTINGS.welcome_subheading,
          banner_image_url: rsRes.data.banner_image_url,
          // Prefer clinic's theme color, fall back to registration brand_color, then default
          brand_color: brand?.brand_color ?? rsRes.data.brand_color ?? DEFAULT_SETTINGS.brand_color,
          thank_you_heading: rsRes.data.thank_you_heading ?? DEFAULT_SETTINGS.thank_you_heading,
          thank_you_message: rsRes.data.thank_you_message ?? DEFAULT_SETTINGS.thank_you_message,
          show_logo: rsRes.data.show_logo ?? true,
          action_links: Array.isArray(rsRes.data.action_links) ? rsRes.data.action_links : [],
        });
      } else if (brand?.brand_color) {
        setSettings((s) => ({ ...s, brand_color: brand.brand_color }));
      }
    })();
  }, [clinicId]);

  const slots = useMemo(() => buildSlots(new Date(), hours), [hours]);
  const isOpenNow = useMemo(() => {
    if (!hours.length) return true;
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

  useEffect(() => {
    if (!isOpenNow && slots.length > 0 && selectedSlot === "now") setSelectedSlot(slots[0].value);
  }, [isOpenNow, slots, selectedSlot]);

  const brand = settings.brand_color;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) { toast.error("Invalid registration link."); return; }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clinicId)) { toast.error("Invalid clinic ID."); return; }

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length > 200) { toast.error("Enter your name."); return; }
    if (phone && phone.length !== 10) { toast.error("Phone must be 10 digits."); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Enter a valid email."); return; }

    setLoading(true);
    let aDate: string | null = null;
    let aTime: string | null = null;
    if (selectedSlot && selectedSlot !== "now") {
      const [d, t] = selectedSlot.split("|"); aDate = d; aTime = t;
    }

    const { data, error } = await (supabase as any).rpc("self_register_patient", {
      p_clinic_id: clinicId,
      p_full_name: trimmedName,
      p_phone: phone || null,
      p_email: email || null,
      p_dob: dob || null,
      p_appointment_date: aDate,
      p_appointment_time: aTime,
      p_gender: gender || null,
      p_address: address || null,
    });
    if (error) { toast.error("Registration failed: " + error.message); setLoading(false); return; }

    const result = data as { token_number: number; reused?: boolean; op_number?: string };
    if (result?.reused) toast.success(`Welcome back! UHID ${result.op_number}`);
    setTokenNumber(result.token_number);
    setRegistered(true);
    setLoading(false);
  };

  if (!clinicId) return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-pulse rounded-full bg-muted" /></div>}>
      <QRCodeGenerator />
    </Suspense>
  );

  if (registered && tokenNumber !== null) {
    const selected = slots.find((s) => s.value === selectedSlot);
    return (
      <div className="flex min-h-screen items-center justify-center p-4"
        style={{ background: `linear-gradient(135deg, ${brand}15, ${brand}05)` }}>
        <Card className="w-full max-w-sm text-center shadow-lg border-0">
          <CardContent className="pt-8 pb-8 space-y-4">
            {settings.show_logo && clinic?.logo_url && (
              <img src={clinic.logo_url} alt={`${clinic.name} logo`} loading="lazy" decoding="async" className="mx-auto h-16 object-contain" />
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

            <TokenShareActions
              tokenNumber={tokenNumber}
              patientName={fullName}
              clinicName={clinic?.name}
              clinicLogoUrl={settings.show_logo ? clinic?.logo_url ?? null : null}
              slotLabel={selected ? `${selected.sublabel} at ${selected.label}` : "Walk-in"}
              brandColor={brand}
              thankYouHeading={settings.thank_you_heading}
            />

            {phone && (
              <a href={`/r/status?clinic=${clinicId}&phone=${encodeURIComponent(phone)}`}
                 className="inline-block text-xs underline underline-offset-2" style={{ color: brand }}>
                Track confirmation message status
              </a>
            )}

            {settings.action_links.length > 0 && (
              <div className="space-y-2 pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">While you wait</p>
                {settings.action_links.filter((l) => l.label && l.url).map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noreferrer"
                     className="flex items-center justify-center gap-2 w-full rounded-lg py-2.5 text-sm font-semibold text-white shadow active:scale-95 transition-transform"
                     style={{ background: link.color || brand }}>
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

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="flex min-h-screen items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${brand}15, ${brand}05)` }}>
      <div className="w-full max-w-md">
        {settings.banner_image_url && (
          <img src={settings.banner_image_url} alt="Banner" loading="lazy" decoding="async"
            className="w-full h-32 object-cover rounded-xl mb-4 shadow" />
        )}

        <div className="mb-6 text-center">
          {settings.show_logo && clinic?.logo_url ? (
            <img src={clinic.logo_url} alt={`${clinic.name} logo`} loading="lazy" decoding="async"
              className="mx-auto mb-3 h-16 object-contain" />
          ) : (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: brand }}>
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
              <div className="space-y-1.5">
                <Label>Full Name <span style={{ color: brand }}>*</span></Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required
                  maxLength={100} placeholder="Patient full name" autoComplete="name" enterKeyHint="next" className="h-11" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone (10 digits)</Label>
                  <Input value={phone} onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(v);
                    setPhoneError(v && v.length !== 10 ? "Must be 10 digits" : "");
                  }} placeholder="9876543210" maxLength={10} inputMode="numeric"
                    autoComplete="tel" enterKeyHint="next" className="h-11" />
                  {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
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
                  <Input type="date" max={today} min="1900-01-01" value={dob}
                    onChange={(e) => setDob(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="optional" inputMode="email" autoComplete="email" className="h-11" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="optional" className="h-11" />
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  rows={2} placeholder="Any notes for the clinic" />
              </div>

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
                    <button type="button" onClick={() => setSelectedSlot("now")}
                      className={cn("rounded-md border p-2 text-xs font-medium transition-all text-center",
                        selectedSlot === "now" ? "text-white shadow" : "bg-card border-border hover:opacity-80 active:scale-95")}
                      style={selectedSlot === "now" ? { background: brand, borderColor: brand } : undefined}>
                      <div className="font-bold">Walk-in</div>
                      <div className="text-[10px] opacity-80">Now</div>
                    </button>
                  )}
                  {slots.map((s) => (
                    <button key={s.value} type="button" onClick={() => setSelectedSlot(s.value)}
                      className={cn("rounded-md border p-2 text-xs font-medium transition-all text-center",
                        selectedSlot === s.value ? "text-white shadow" : "bg-card border-border hover:opacity-80 active:scale-95")}
                      style={selectedSlot === s.value ? { background: brand, borderColor: brand } : undefined}>
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

              <Button type="submit" className="w-full h-12 text-base text-white border-0"
                style={{ background: brand }}
                disabled={loading || !!phoneError || (!isOpenNow && slots.length === 0)}>
                {loading ? "Registering..." : selectedSlot === "now" ? "Register & Get Token" : "Book Appointment & Get Token"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
