import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  CheckCircle2, UserPlus, ExternalLink, User, Phone, Mail, Cake, MapPin, FileText,
  ShieldCheck, CalendarClock, Timer, Hourglass, ArrowLeft, Loader2, Download, FileDown,
  CalendarDays, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TokenShareActions from "@/components/patients/TokenShareActions";
import QRCode from "qrcode";
import jsPDF from "jspdf";

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
  require_phone_verification: boolean;
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
  require_phone_verification: true,
};

interface Slot { value: string; date: string; time: string; label: string; sublabel: string; duration: number; }
const SLOTS_TO_SHOW = 12;
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
    out.push(...buildSlotsForDate(d, now, hours, booked));
  }
  return out.slice(0, SLOTS_TO_SHOW);
}

function buildSlotsForDate(d: Date, now: Date, hours: WorkingHour[], booked: Set<string>): Slot[] {
  if (!hours.length) return [];
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const dayOffset = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (dayOffset < 0) return [];
  const dow = target.getDay();
  const wh = hours.find((h) => h.day_of_week === dow);
  if (!wh || wh.is_closed) return [];
  const dateStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
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
  const out: Slot[] = [];
  for (let m = startMin; m + slotMin <= closeMin; m += slotMin) {
    if (brkStart != null && brkEnd != null && m >= brkStart && m < brkEnd) continue;
    const hh = Math.floor(m / 60), mm = m % 60;
    const time = `${pad(hh)}:${pad(mm)}`;
    if (booked.has(`${dateStr}|${time}`)) continue;
    const label = fmt12(hh, mm);
    const sublabel = dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow" : DAYS_SHORT[dow];
    out.push({ value: `${dateStr}|${time}`, date: dateStr, time, label, sublabel, duration: slotMin });
  }
  return out;
}

type Stage = "form" | "otp" | "confirm";

export default function PatientSelfRegister() {
  const [searchParams] = useSearchParams();
  const clinicId = searchParams.get("clinic");
  const [loading, setLoading] = useState(false);
  const [tokenNumber, setTokenNumber] = useState<number | null>(null);
  const [opNumber, setOpNumber] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [stage, setStage] = useState<Stage>("form");

  // Form fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpResendIn, setOtpResendIn] = useState(0);

  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [bookedSet, setBookedSet] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<RegSettings>(DEFAULT_SETTINGS);
  const [clinic, setClinic] = useState<ClinicBrand | null>(null);

  const refetchAppointments = useCallback(async () => {
    if (!clinicId) return;
    const todayIso = new Date().toISOString().split("T")[0];
    const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];
    const { data } = await (supabase as any).from("appointments")
      .select("appointment_date,appointment_time,status")
      .eq("clinic_id", clinicId).gte("appointment_date", todayIso).lte("appointment_date", weekAhead)
      .neq("status", "cancelled");
    if (data) {
      const s = new Set<string>();
      for (const a of data as Array<{ appointment_date: string; appointment_time: string }>) {
        const t = (a.appointment_time || "").slice(0, 5);
        if (a.appointment_date && t) s.add(`${a.appointment_date}|${t}`);
      }
      setBookedSet(s);
    }
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      const [whRes, rsRes, brandRes] = await Promise.all([
        (supabase as any).from("clinic_working_hours").select("*").eq("clinic_id", clinicId).order("day_of_week"),
        (supabase as any).rpc("get_public_registration_settings", { p_clinic_id: clinicId }),
        (supabase as any).rpc("get_public_clinic_brand", { p_clinic_id: clinicId }),
      ]);
      if (whRes.data) setHours(whRes.data);
      const brand = (brandRes?.data ?? null) as ClinicBrand | null;
      if (brand) setClinic(brand);
      const publicSettings = rsRes.data as Partial<RegSettings> | null;
      if (publicSettings) {
        setSettings({
          welcome_heading: publicSettings.welcome_heading ?? DEFAULT_SETTINGS.welcome_heading,
          welcome_subheading: publicSettings.welcome_subheading ?? DEFAULT_SETTINGS.welcome_subheading,
          banner_image_url: publicSettings.banner_image_url ?? null,
          brand_color: brand?.brand_color ?? publicSettings.brand_color ?? DEFAULT_SETTINGS.brand_color,
          thank_you_heading: publicSettings.thank_you_heading ?? DEFAULT_SETTINGS.thank_you_heading,
          thank_you_message: publicSettings.thank_you_message ?? DEFAULT_SETTINGS.thank_you_message,
          show_logo: publicSettings.show_logo ?? true,
          action_links: Array.isArray(publicSettings.action_links) ? publicSettings.action_links : [],
          require_phone_verification: publicSettings.require_phone_verification ?? true,
        });
      } else if (brand?.brand_color) {
        setSettings((s) => ({ ...s, brand_color: brand.brand_color }));
      }
    })();
    refetchAppointments();
  }, [clinicId, refetchAppointments]);

  // Auto-refresh slots every 45s while on form/confirm stages to avoid stale conflicts
  useEffect(() => {
    if (registered) return;
    const id = setInterval(refetchAppointments, 45_000);
    return () => clearInterval(id);
  }, [registered, refetchAppointments]);

  // OTP resend countdown
  useEffect(() => {
    if (otpResendIn <= 0) return;
    const id = setInterval(() => setOtpResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [otpResendIn]);

  const slots = useMemo(() => buildSlots(new Date(), hours, bookedSet), [hours, bookedSet]);
  const pickerSlots = useMemo(
    () => buildSlotsForDate(pickerDate, new Date(), hours, bookedSet),
    [pickerDate, hours, bookedSet]
  );
  const nextSlot = slots[0];
  const slotDuration = nextSlot?.duration ?? hours.find(h => !h.is_closed)?.slot_duration_minutes ?? 30;
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

  // If the user's selected slot got booked while idle, drop it
  useEffect(() => {
    if (selectedSlot && bookedSet.has(selectedSlot)) {
      setSelectedSlot("");
      toast.warning("That slot was just booked — please pick another.");
    }
  }, [bookedSet, selectedSlot]);

  const brand = settings.brand_color;
  const allSlotsForLookup = useMemo(
    () => [...slots, ...pickerSlots],
    [slots, pickerSlots]
  );
  const selectedSlotObj = allSlotsForLookup.find((s) => s.value === selectedSlot);
  const slotLabel = selectedSlotObj ? `${selectedSlotObj.sublabel} at ${selectedSlotObj.label}` : "—";

  // ---------- OTP ----------
  const sendOtp = async () => {
    if (!clinicId || phone.length !== 10) return;
    setOtpSending(true);
    const { error } = await (supabase as any).rpc("request_patient_otp", { p_clinic_id: clinicId, p_phone: phone });
    setOtpSending(false);
    if (error) { toast.error(error.message || "Could not send code"); return; }
    setOtpSent(true);
    setOtpResendIn(30);
    toast.success("Verification code sent via WhatsApp");
  };
  const verifyOtp = async () => {
    if (!clinicId || otpCode.length !== 6) return;
    setOtpVerifying(true);
    const { data, error } = await (supabase as any).rpc("verify_patient_otp", {
      p_clinic_id: clinicId, p_phone: phone, p_code: otpCode,
    });
    setOtpVerifying(false);
    if (error) { toast.error(error.message); return; }
    if (data?.verified) { setOtpVerified(true); toast.success("Phone verified"); setStage("confirm"); }
    else {
      const reason = data?.reason;
      toast.error(reason === "expired" ? "Code expired — request a new one"
        : reason === "locked" ? "Too many attempts — request a new code"
        : "Incorrect code");
    }
  };

  // ---------- Validate & advance ----------
  const validateForm = (): boolean => {
    if (!clinicId) { toast.error("Invalid registration link."); return false; }
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length > 200) { toast.error("Enter your name."); return false; }
    if (!gender) { toast.error("Please select gender."); return false; }
    if (phone && phone.length !== 10) { toast.error("Phone must be 10 digits."); return false; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Enter a valid email."); return false; }
    if (!selectedSlotObj) { toast.error("Please book a slot to continue."); return false; }
    return true;
  };
  const handleFormNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    // If phone provided and not yet verified, force OTP step
    if (phone && !otpVerified && settings.require_phone_verification) { setStage("otp"); return; }
    setStage("confirm");
  };

  // ---------- Final submit ----------
  const handleRegister = async () => {
    if (!clinicId) return;
    setLoading(true);
    let aDate: string | null = null;
    let aTime: string | null = null;
    if (selectedSlot) {
      const [d, t] = selectedSlot.split("|"); aDate = d; aTime = t;
    }
    const { data, error } = await (supabase as any).rpc("self_register_patient", {
      p_clinic_id: clinicId,
      p_full_name: fullName.trim(),
      p_phone: phone || null,
      p_email: email || null,
      p_dob: dob || null,
      p_appointment_date: aDate,
      p_appointment_time: aTime,
      p_gender: gender || null,
      p_address: address || null,
    });
    setLoading(false);
    if (error) {
      // Likely a booking conflict — refresh slots and bounce back
      toast.error("Registration failed: " + error.message);
      await refetchAppointments();
      setStage("form");
      return;
    }
    const result = data as { token_number: number; reused?: boolean; op_number?: string };
    if (result?.reused) toast.success(`Welcome back! UHID ${result.op_number}`);
    setTokenNumber(result.token_number);
    setOpNumber(result.op_number ?? null);
    setRegistered(true);
  };

  // ---------- Token PDF ----------
  const buildTokenPdf = useCallback(async (): Promise<jsPDF> => {
    const doc = new jsPDF({ unit: "mm", format: "a5" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    // brand band
    const rgb = hexToRgb(brand);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(0, 0, W, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(clinic?.name || "Clinic", W / 2, 11, { align: "center" });
    // body
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(settings.thank_you_heading, W / 2, 30, { align: "center" });
    // Token box
    const boxX = 20, boxY = 38, boxW = W - 40, boxH = 46;
    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    doc.setFillColor(rgb.r, rgb.g, rgb.b, 0.08 as any);
    doc.roundedRect(boxX, boxY, boxW, boxH, 4, 4, "S");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("YOUR TOKEN", W / 2, boxY + 10, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(40);
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
    doc.text(String(tokenNumber ?? ""), W / 2, boxY + 34, { align: "center" });

    // Patient details
    let y = boxY + boxH + 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    const rows: Array<[string, string]> = [
      ["Name", fullName],
      ["Gender", gender ? gender[0].toUpperCase() + gender.slice(1) : "—"],
      ["Phone", phone || "—"],
      ["Slot", slotLabel],
    ];
    if (opNumber) rows.unshift(["UHID", opNumber]);
    for (const [k, v] of rows) {
      doc.setTextColor(100, 116, 139); doc.text(`${k}:`, 20, y);
      doc.setTextColor(15, 23, 42); doc.text(v, 45, y);
      y += 7;
    }

    // QR code (verification url)
    try {
      const verifyUrl = `${window.location.origin}/r/status?clinic=${clinicId}${phone ? `&phone=${phone}` : ""}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 256, margin: 1 });
      const qrSize = 32;
      doc.addImage(qrDataUrl, "PNG", W - 20 - qrSize, y - 6, qrSize, qrSize);
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("Scan to track", W - 20 - qrSize / 2, y + qrSize, { align: "center" });
    } catch { /* ignore */ }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated ${new Date().toLocaleString()}`, W / 2, H - 8, { align: "center" });
    return doc;
  }, [brand, clinic, settings, tokenNumber, opNumber, fullName, gender, phone, slotLabel, clinicId]);

  const downloadTokenPdf = async () => {
    try {
      const doc = await buildTokenPdf();
      doc.save(`token-${tokenNumber}-${fullName.replace(/\s+/g, "_")}.pdf`);
    } catch (e: any) {
      toast.error("PDF failed: " + (e?.message ?? "unknown"));
    }
  };

  if (!clinicId) return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-pulse rounded-full bg-muted" /></div>}>
      <QRCodeGenerator />
    </Suspense>
  );

  // ============= Success screen =============
  if (registered && tokenNumber !== null) {
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
              {opNumber && <p className="text-xs text-muted-foreground mt-2">UHID: <strong>{opNumber}</strong></p>}
            </div>
            {selectedSlotObj && (
              <p className="text-sm text-muted-foreground">
                Appointment for <strong>{selectedSlotObj.sublabel} at {selectedSlotObj.label}</strong>
              </p>
            )}
            <p className="text-sm text-muted-foreground">{settings.thank_you_message}</p>
            <p className="text-sm font-semibold">Thank you, {fullName}!</p>

            <button type="button" onClick={downloadTokenPdf}
              className="flex items-center justify-center gap-2 w-full rounded-lg py-2.5 text-sm font-semibold text-white shadow active:scale-95 transition-transform"
              style={{ background: brand }}>
              <FileDown className="h-4 w-4" /> Download Token PDF
            </button>

            <TokenShareActions
              tokenNumber={tokenNumber}
              patientName={fullName}
              clinicName={clinic?.name}
              clinicLogoUrl={settings.show_logo ? clinic?.logo_url ?? null : null}
              slotLabel={selectedSlotObj ? `${selectedSlotObj.sublabel} at ${selectedSlotObj.label}` : "Walk-in"}
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
  const GENDERS = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
  ];
  const fieldWrap = "relative";
  const iconCls = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground";
  const inputPad = "h-12 pl-10 rounded-xl bg-white/80 backdrop-blur border-slate-200/80 focus-visible:ring-2";

  return (
    <div
      className="min-h-screen p-4 sm:p-6"
      style={{
        background: `radial-gradient(1200px 600px at 0% -10%, ${brand}22, transparent 60%),
                     radial-gradient(900px 500px at 110% 10%, ${brand}18, transparent 55%),
                     linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)`,
      }}
    >
      <div className="mx-auto w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-5 overflow-hidden rounded-3xl shadow-xl border border-white/60 bg-white/70 backdrop-blur-xl">
          <div className="px-6 pt-6 pb-5 text-center relative" style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}>
            {settings.show_logo && clinic?.logo_url ? (
              <img src={clinic.logo_url} alt={`${clinic.name} logo`} loading="lazy"
                className="mx-auto mb-2 h-14 w-14 rounded-2xl object-contain bg-white p-1.5 shadow-lg ring-2 ring-white/40" />
            ) : (
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/95 shadow-lg ring-2 ring-white/40">
                <UserPlus className="h-7 w-7" style={{ color: brand }} />
              </div>
            )}
            {clinic?.name && <p className="text-xs text-white/85 font-medium tracking-wide">{clinic.name.toUpperCase()}</p>}
            <h1 className="mt-1 text-xl font-bold text-white">{settings.welcome_heading}</h1>
            <p className="text-xs text-white/85 mt-0.5">{settings.welcome_subheading}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
              <ShieldCheck className="h-3 w-3" /> Secure clinic intake
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-between gap-1 px-4 py-2 bg-white/80">
            {[
              { key: "form", label: "1. Details" },
              { key: "otp", label: "2. Verify" },
              { key: "confirm", label: "3. Confirm" },
            ].map((s) => {
              const idx = ["form", "otp", "confirm"].indexOf(stage);
              const myIdx = ["form", "otp", "confirm"].indexOf(s.key);
              const active = myIdx === idx;
              const done = myIdx < idx;
              return (
                <div key={s.key} className="flex-1 text-center">
                  <div className={cn("h-1 rounded-full", active || done ? "" : "bg-slate-200")}
                    style={(active || done) ? { background: brand } : undefined} />
                  <div className={cn("mt-1 text-[10px] font-semibold",
                    active ? "" : done ? "text-slate-500" : "text-slate-400")}
                    style={active ? { color: brand } : undefined}>{s.label}</div>
                </div>
              );
            })}
          </div>

          {/* Availability strip */}
          <div className="grid grid-cols-3 gap-px bg-slate-100/60">
            <div className="bg-white/70 px-3 py-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", isOpenNow ? "bg-emerald-500" : "bg-amber-500")} />
                {isOpenNow ? "Open Now" : "Closed"}
              </div>
              <div className="mt-0.5 text-xs font-semibold text-foreground">
                {isOpenNow ? "Walk-in OK" : "Book ahead"}
              </div>
            </div>
            <div className="bg-white/70 px-3 py-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Timer className="h-3 w-3" /> Slot
              </div>
              <div className="mt-0.5 text-xs font-semibold text-foreground">{slotDuration} min</div>
            </div>
            <div className="bg-white/70 px-3 py-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Hourglass className="h-3 w-3" /> Next free
              </div>
              <div className="mt-0.5 text-xs font-semibold" style={{ color: brand }}>
                {nextSlot ? `${nextSlot.sublabel} ${nextSlot.label}` : "—"}
              </div>
            </div>
          </div>
        </div>

        {settings.banner_image_url && stage === "form" && (
          <img src={settings.banner_image_url} alt="Banner" loading="lazy"
            className="w-full h-28 object-cover rounded-2xl mb-4 shadow-md" />
        )}

        {/* ============= FORM STAGE ============= */}
        {stage === "form" && (
        <Card className="rounded-3xl border-white/60 bg-white/85 backdrop-blur-xl shadow-xl">
          <CardContent className="p-5 sm:p-6">
            <form onSubmit={handleFormNext} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-xs font-semibold text-slate-700">Full Name <span style={{ color: brand }}>*</span></Label>
                <div className={fieldWrap}>
                  <User className={iconCls} />
                  <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required
                    maxLength={100} placeholder="e.g. Priya Sharma" autoComplete="name" enterKeyHint="next"
                    className={inputPad} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">
                  Mobile Number {otpVerified && <span className="text-emerald-600">✓ verified</span>}
                </Label>
                <div className={fieldWrap}>
                  <Phone className={iconCls} />
                  <Input id="phone" value={phone} onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setPhone(v);
                      setPhoneError(v && v.length !== 10 ? "Must be 10 digits" : "");
                      setOtpVerified(false); setOtpSent(false); setOtpCode("");
                    }} placeholder="9876543210" maxLength={10} inputMode="numeric"
                    autoComplete="tel" enterKeyHint="next"
                    aria-invalid={!!phoneError}
                    className={cn(inputPad, phoneError && "border-destructive focus-visible:ring-destructive/40")} />
                </div>
                {phoneError && <p role="alert" className="text-xs text-destructive">{phoneError}</p>}
                {phone.length === 10 && !otpVerified && (
                  <p className="text-[11px] text-muted-foreground">We'll send a 6-digit code via WhatsApp to prevent duplicate sign-ups.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Gender <span style={{ color: brand }}>*</span></Label>
                <div role="radiogroup" aria-label="Gender" aria-required="true"
                  className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100/80 p-1">
                  {GENDERS.map((g) => {
                    const active = gender === g.value;
                    return (
                      <button key={g.value} type="button" role="radio" aria-checked={active}
                        onClick={() => setGender(g.value)}
                        className={cn(
                          "h-10 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                          active ? "text-white shadow-md" : "text-slate-600 hover:bg-white/80"
                        )}
                        style={active ? { background: brand } : undefined}>
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dob" className="text-xs font-semibold text-slate-700">Date of Birth</Label>
                  <div className={fieldWrap}>
                    <Cake className={iconCls} />
                    <Input id="dob" type="date" max={today} min="1900-01-01" value={dob}
                      onChange={(e) => setDob(e.target.value)} className={inputPad} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Email</Label>
                  <div className={fieldWrap}>
                    <Mail className={iconCls} />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="optional" inputMode="email" autoComplete="email" className={inputPad} />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-semibold text-slate-700">Address</Label>
                <div className={fieldWrap}>
                  <MapPin className={iconCls} />
                  <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)}
                    placeholder="optional" className={inputPad} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-semibold text-slate-700">Notes</Label>
                <div className="relative">
                  <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                    rows={2} placeholder="Any concerns or notes for the clinic"
                    className="pl-10 rounded-xl bg-white/80 border-slate-200/80" />
                </div>
              </div>

              {/* Book a slot */}
              <div className="space-y-2 rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-200/60">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <CalendarClock className="h-3.5 w-3.5" /> Appointment Slot <span style={{ color: brand }}>*</span>
                </Label>

                <Popover open={slotPickerOpen} onOpenChange={setSlotPickerOpen}>
                  <PopoverTrigger asChild>
                    <button type="button"
                      className={cn(
                        "w-full rounded-xl border bg-white px-4 py-3 text-left flex items-center justify-between gap-3 transition-all",
                        selectedSlotObj ? "border-2 shadow-sm" : "border-slate-200 hover:border-slate-300"
                      )}
                      style={selectedSlotObj ? { borderColor: brand } : undefined}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `${brand}18`, color: brand }}>
                          <CalendarDays className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          {selectedSlotObj ? (
                            <>
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {selectedSlotObj.sublabel} · {selectedSlotObj.label}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {selectedSlotObj.duration} min slot · tap to change
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-sm font-semibold text-slate-900">Book Slot</div>
                              <div className="text-[11px] text-muted-foreground">Pick a date & time that works for you</div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] font-semibold" style={{ color: brand }}>
                        {selectedSlotObj ? "Change" : "Choose"}
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[320px] p-0 pointer-events-auto" sideOffset={6}>
                    <div className="border-b px-3 py-2 flex items-center justify-between bg-slate-50 rounded-t-md">
                      <div className="text-xs font-semibold text-slate-700">Pick date & time</div>
                      <button type="button" onClick={refetchAppointments}
                        className="text-[10px] font-medium text-slate-500 hover:underline">Refresh</button>
                    </div>
                    <Calendar
                      mode="single"
                      selected={pickerDate}
                      onSelect={(d) => d && setPickerDate(d)}
                      disabled={(d) => {
                        const t = new Date(); t.setHours(0,0,0,0);
                        if (d < t) return true;
                        const max = new Date(t.getTime() + 30 * 86_400_000);
                        if (d > max) return true;
                        const wh = hours.find((h) => h.day_of_week === d.getDay());
                        return !wh || wh.is_closed;
                      }}
                      className="p-2 pointer-events-auto"
                    />
                    <div className="border-t px-3 py-2 max-h-[180px] overflow-y-auto">
                      {pickerSlots.length === 0 ? (
                        <p className="text-center text-[11px] text-muted-foreground py-4">
                          No available times on this day. Try another date.
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5">
                          {pickerSlots.map((s) => {
                            const active = selectedSlot === s.value;
                            return (
                              <button key={s.value} type="button"
                                onClick={() => { setSelectedSlot(s.value); setSlotPickerOpen(false); }}
                                className={cn(
                                  "rounded-lg border px-1 py-1.5 text-[11px] font-semibold transition-all",
                                  active ? "text-white shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"
                                )}
                                style={active ? { background: brand, borderColor: brand } : undefined}>
                                {s.label}
                                {active && <Check className="inline h-3 w-3 ml-0.5 -mt-0.5" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {nextSlot && !selectedSlotObj && (
                  <p className="text-[11px] text-muted-foreground">
                    Next free: <strong style={{ color: brand }}>{nextSlot.sublabel} at {nextSlot.label}</strong>
                  </p>
                )}
              </div>


              <Button type="submit" className="w-full h-12 text-base font-semibold text-white border-0 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
                style={{ background: `linear-gradient(135deg, ${brand}, ${brand}d0)` }}
                disabled={loading || !!phoneError || !gender || !selectedSlotObj}>
                {phone && !otpVerified && settings.require_phone_verification ? "Verify Phone & Continue" : "Review & Confirm"}
              </Button>
              {!gender && (
                <p className="text-center text-[11px] text-muted-foreground">Please select gender to continue</p>
              )}
            </form>
          </CardContent>
        </Card>
        )}

        {/* ============= OTP STAGE ============= */}
        {stage === "otp" && (
        <Card className="rounded-3xl border-white/60 bg-white/85 backdrop-blur-xl shadow-xl">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setStage("form")}
                className="text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /></button>
              <h2 className="text-base font-bold text-slate-900">Verify your phone</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              We'll send a 6-digit code to <strong className="text-slate-800">+91 {phone}</strong> via WhatsApp.
              This prevents duplicate registrations.
            </p>

            {!otpSent ? (
              <Button type="button" onClick={sendOtp} disabled={otpSending}
                className="w-full h-12 text-white" style={{ background: brand }}>
                {otpSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send code via WhatsApp
              </Button>
            ) : (
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-slate-700">Enter the 6-digit code</Label>
                <Input value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric" maxLength={6} placeholder="••••••"
                  className="h-14 text-center text-2xl tracking-[0.6em] rounded-xl bg-white" autoFocus />
                <Button type="button" onClick={verifyOtp} disabled={otpCode.length !== 6 || otpVerifying}
                  className="w-full h-12 text-white" style={{ background: brand }}>
                  {otpVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Verify code
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" onClick={sendOtp} disabled={otpResendIn > 0 || otpSending}
                    className="text-slate-600 disabled:opacity-50 underline">
                    {otpResendIn > 0 ? `Resend in ${otpResendIn}s` : "Resend code"}
                  </button>
                  <span className="text-muted-foreground">Code valid 10 min</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* ============= CONFIRM STAGE ============= */}
        {stage === "confirm" && (
        <Card className="rounded-3xl border-white/60 bg-white/85 backdrop-blur-xl shadow-xl">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setStage("form")}
                className="text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /></button>
              <h2 className="text-base font-bold text-slate-900">Confirm your details</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Please review before submitting. You'll receive a token number after confirmation.
            </p>

            <div className="rounded-2xl bg-slate-50/70 ring-1 ring-slate-200/60 divide-y divide-slate-200/70">
              {[
                ["Name", fullName],
                ["Gender", gender ? gender[0].toUpperCase() + gender.slice(1) : "—"],
                ["Phone", phone ? `+91 ${phone}${otpVerified ? "  ✓" : ""}` : "Not provided"],
                ["Email", email || "—"],
                ["Date of Birth", dob || "—"],
                ["Address", address || "—"],
                ["Preferred Slot", slotLabel],
                ["Duration", `${slotDuration} min`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</span>
                  <span className="text-sm font-medium text-slate-800 text-right">{v}</span>
                </div>
              ))}
            </div>

            {notes && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                <strong>Notes for clinic:</strong> {notes}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground text-center">
              By confirming, you agree to share these details with {clinic?.name || "the clinic"}.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setStage("form")} className="h-12 rounded-xl">
                Edit
              </Button>
              <Button type="button" onClick={handleRegister} disabled={loading}
                className="h-12 text-white rounded-xl" style={{ background: brand }}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm & Get Token
              </Button>
            </div>
          </CardContent>
        </Card>
        )}

        <p className="mt-4 text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1">
          <ShieldCheck className="h-3 w-3" /> Your information is encrypted & shared only with the clinic
        </p>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full || "2563eb", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
