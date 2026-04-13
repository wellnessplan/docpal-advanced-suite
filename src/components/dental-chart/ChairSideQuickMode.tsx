import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, Check, RotateCcw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChairSideQuickModeProps {
  patientId: string;
  clinicId: string;
  prescriptionId: string | null;
  onUpdate: () => void;
}

type Step = "tooth" | "treatment" | "confirm";

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const QUICK_TREATMENTS = [
  { name: "Filling", icon: "🦷", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
  { name: "Scaling", icon: "✨", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  { name: "Root Canal (RCT)", icon: "🔧", color: "bg-orange-500/10 text-orange-700 border-orange-200" },
  { name: "Extraction", icon: "🔨", color: "bg-red-500/10 text-red-700 border-red-200" },
  { name: "Crown", icon: "👑", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  { name: "X-Ray", icon: "📷", color: "bg-purple-500/10 text-purple-700 border-purple-200" },
  { name: "Exam", icon: "🔍", color: "bg-teal-500/10 text-teal-700 border-teal-200" },
  { name: "Whitening", icon: "⚡", color: "bg-yellow-500/10 text-yellow-700 border-yellow-200" },
  { name: "Bridge", icon: "🌉", color: "bg-indigo-500/10 text-indigo-700 border-indigo-200" },
  { name: "Implant", icon: "🏗️", color: "bg-slate-500/10 text-slate-700 border-slate-200" },
  { name: "Veneer", icon: "💎", color: "bg-pink-500/10 text-pink-700 border-pink-200" },
  { name: "Denture", icon: "🦷", color: "bg-cyan-500/10 text-cyan-700 border-cyan-200" },
];

export default function ChairSideQuickMode({
  patientId, clinicId, prescriptionId, onUpdate,
}: ChairSideQuickModeProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("tooth");
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [selectedTreatment, setSelectedTreatment] = useState<string | null>(null);
  const [customCost, setCustomCost] = useState<string>("");

  const { data: pricingMap } = useQuery({
    queryKey: ["treatment-pricing-map", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("treatment_pricing").select("treatment_name, price").eq("clinic_id", clinicId);
      const map: Record<string, number> = {};
      data?.forEach((p: any) => { map[p.treatment_name] = Number(p.price); });
      return map;
    },
    enabled: !!clinicId,
  });

  const logTreatment = useMutation({
    mutationFn: async () => {
      if (!selectedTooth || !selectedTreatment) throw new Error("Incomplete");

      // Ensure tooth record exists
      const { data: existing } = await supabase
        .from("tooth_records")
        .select("id")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .eq("tooth_number", selectedTooth)
        .maybeSingle();

      let toothRecordId = existing?.id;
      if (!toothRecordId) {
        const { data: newRec, error: recErr } = await supabase
          .from("tooth_records")
          .insert({ patient_id: patientId, clinic_id: clinicId, tooth_number: selectedTooth, status: "treated" as any })
          .select("id")
          .single();
        if (recErr) throw recErr;
        toothRecordId = newRec.id;
      }

      // Add treatment
      const cost = customCost ? Number(customCost) : (pricingMap?.[selectedTreatment] || 0);
      const { error: txErr } = await supabase.from("tooth_treatments").insert({
        tooth_record_id: toothRecordId,
        treatment_name: selectedTreatment,
        status: "completed" as any,
        cost,
        performed_at: new Date().toISOString(),
      });
      if (txErr) throw txErr;

      // Also add to prescription items if we have a prescription
      if (prescriptionId) {
        await (supabase.from("prescription_items") as any).insert({
          prescription_id: prescriptionId,
          tooth_number: selectedTooth,
          treatment: selectedTreatment,
          condition: "Chair-side",
          cost,
          treatment_status: "completed",
        });
      }
    },
    onSuccess: () => {
      toast.success(`✅ ${selectedTreatment} on tooth #${selectedTooth} — logged!`);
      queryClient.invalidateQueries({ queryKey: ["tooth-records"] });
      queryClient.invalidateQueries({ queryKey: ["tooth-treatments"] });
      queryClient.invalidateQueries({ queryKey: ["prescription-items-all"] });
      onUpdate();
      resetFlow();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetFlow = () => {
    setStep("tooth");
    setSelectedTooth(null);
    setSelectedTreatment(null);
    setCustomCost("");
  };

  const stepIndex = step === "tooth" ? 1 : step === "treatment" ? 2 : 3;

  return (
    <Card className="shadow-card border-0 border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Chair-Side Quick Mode
          </CardTitle>
          {step !== "tooth" && (
            <Button variant="ghost" size="sm" onClick={resetFlow} className="h-7 text-xs gap-1">
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-2">
          {[
            { n: 1, label: "Tooth" },
            { n: 2, label: "Treatment" },
            { n: 3, label: "Confirm" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-1">
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                stepIndex >= s.n
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {stepIndex > s.n ? <Check className="h-3 w-3" /> : s.n}
              </div>
              <span className={cn("text-[10px] font-medium", stepIndex >= s.n ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
              {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* STEP 1: Select tooth */}
        {step === "tooth" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Tap a tooth number:</p>
            {/* Upper row */}
            <div className="flex flex-wrap gap-1 justify-center">
              {UPPER_TEETH.map(t => (
                <button
                  key={t}
                  onClick={() => { setSelectedTooth(t); setStep("treatment"); }}
                  className={cn(
                    "w-8 h-8 text-[11px] font-bold rounded-lg border transition-all",
                    "hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-110",
                    "bg-background border-border text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="border-t border-dashed border-border" />
            {/* Lower row */}
            <div className="flex flex-wrap gap-1 justify-center">
              {LOWER_TEETH.map(t => (
                <button
                  key={t}
                  onClick={() => { setSelectedTooth(t); setStep("treatment"); }}
                  className={cn(
                    "w-8 h-8 text-[11px] font-bold rounded-lg border transition-all",
                    "hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-110",
                    "bg-background border-border text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Select treatment */}
        {step === "treatment" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Tooth #{selectedTooth}</Badge>
              <p className="text-xs text-muted-foreground">Select treatment:</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_TREATMENTS.map(t => (
                <button
                  key={t.name}
                  onClick={() => { setSelectedTreatment(t.name); setStep("confirm"); }}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border text-left transition-all hover:scale-[1.02]",
                    t.color
                  )}
                >
                  <span className="text-base">{t.icon}</span>
                  <div>
                    <p className="text-xs font-semibold leading-tight">{t.name}</p>
                    {pricingMap?.[t.name] ? (
                      <p className="text-[10px] opacity-70">₹{pricingMap[t.name]}</p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Confirm */}
        {step === "confirm" && (
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-xl p-4 text-center space-y-2">
              <p className="text-lg font-bold text-foreground">
                {QUICK_TREATMENTS.find(t => t.name === selectedTreatment)?.icon}{" "}
                {selectedTreatment}
              </p>
              <p className="text-sm text-muted-foreground">
                on <span className="font-semibold text-foreground">Tooth #{selectedTooth}</span>
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Label className="text-xs text-muted-foreground">Cost ₹</Label>
                <Input
                  type="number"
                  placeholder={pricingMap?.[selectedTreatment!] ? String(pricingMap[selectedTreatment!]) : "0"}
                  value={customCost}
                  onChange={e => setCustomCost(e.target.value)}
                  className="h-8 w-28 text-center text-sm font-semibold"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {!customCost && pricingMap?.[selectedTreatment!] ? `Default: ₹${pricingMap[selectedTreatment!]}` : ""}
              </p>
            </div>
            <Button
              className="w-full h-12 text-base font-bold gap-2"
              onClick={() => logTreatment.mutate()}
              disabled={logTreatment.isPending}
            >
              {logTreatment.isPending ? (
                "Logging..."
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Confirm & Log Treatment
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
