import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

interface Program {
  id: string; code: string; name: string;
  description: string | null; emoji: string | null; interval_months: number;
}
interface Brand { name: string; logo_url: string | null; brand_color: string; }

export default function PublicPrograms() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ count: number } | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      const [{ data: b }, { data: progs }] = await Promise.all([
        (supabase.rpc as any)("get_public_clinic_brand", { p_clinic_id: clinicId }),
        (supabase.rpc as any)("get_public_programs", { p_clinic_id: clinicId }),
      ]);
      if (b) setBrand(b as Brand);
      setPrograms((progs ?? []) as Program[]);
      setLoading(false);
    })();
  }, [clinicId]);

  const accent = brand?.brand_color || "#0ea5e9";
  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Enter your name");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return toast.error("Enter a valid 10-digit phone");
    if (selectedIds.length === 0) return toast.error("Pick at least one program");
    setSubmitting(true);
    const { data, error } = await (supabase.rpc as any)("enroll_in_programs_public", {
      p_clinic_id: clinicId,
      p_program_ids: selectedIds,
      p_full_name: name.trim(),
      p_phone: digits,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setDone({ count: (data as any)?.enrolled ?? selectedIds.length });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center" style={{ background: `${accent}20`, color: accent }}>
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-semibold">You're subscribed!</h1>
            <p className="text-muted-foreground">
              {brand?.name} will send you {done.count} program{done.count > 1 ? "s" : ""} of friendly reminders on WhatsApp. Reply STOP anytime to opt out.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-4 sm:p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          {brand?.logo_url && <img src={brand.logo_url} alt={brand.name} className="h-14 mx-auto rounded-lg object-contain" />}
          <h1 className="text-2xl sm:text-3xl font-semibold" style={{ color: accent }}>{brand?.name ?? "Patient Programs"}</h1>
          <p className="text-muted-foreground">Pick the programs you'd like to receive on WhatsApp.</p>
        </div>

        <div className="space-y-3">
          {programs.length === 0 && (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No active programs right now.</CardContent></Card>
          )}
          {programs.map((p) => {
            const checked = !!selected[p.id];
            return (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all ${checked ? "ring-2" : ""}`}
                style={checked ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` } : {}}
                onClick={() => setSelected((s) => ({ ...s, [p.id]: !s[p.id] }))}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="text-3xl leading-none">{p.emoji ?? "🦷"}</div>
                  <div className="flex-1">
                    <div className="font-semibold">{p.name}</div>
                    {p.description && <div className="text-sm text-muted-foreground">{p.description}</div>}
                    <div className="text-xs mt-1" style={{ color: accent }}>
                      Reminder every {p.interval_months} month{p.interval_months > 1 ? "s" : ""}
                    </div>
                  </div>
                  <Checkbox checked={checked} onCheckedChange={() => setSelected((s) => ({ ...s, [p.id]: !s[p.id] }))} />
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label>Full Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <Label>WhatsApp Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile"
                inputMode="numeric"
              />
            </div>
            <Button
              className="w-full"
              style={{ background: accent, color: "white" }}
              disabled={submitting}
              onClick={submit}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Subscribe to {selectedIds.length || "selected"} program{selectedIds.length === 1 ? "" : "s"}
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              By subscribing you agree to receive WhatsApp reminders from {brand?.name ?? "the clinic"}. Reply STOP to opt out.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
