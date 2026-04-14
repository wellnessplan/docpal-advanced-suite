import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pill, Plus, Trash2 } from "lucide-react";

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

interface MedicationPanelProps {
  medications: Medication[];
  treatmentPlan: string;
  onMedicationsChange: (meds: Medication[]) => void;
  onTreatmentPlanChange: (plan: string) => void;
}

const COMMON_MEDICINES = [
  "Amoxicillin 500mg", "Metronidazole 400mg", "Ibuprofen 400mg", "Paracetamol 500mg",
  "Diclofenac 50mg", "Clindamycin 300mg", "Azithromycin 500mg", "Aceclofenac 100mg",
  "Ornidazole 500mg", "Fluconazole 150mg", "Chlorhexidine Mouthwash", "Povidone Iodine Gargle",
];

const FREQUENCIES = ["Once daily", "Twice daily", "Thrice daily", "Four times daily", "As needed (SOS)", "Before meals", "After meals"];
const DURATIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "As directed"];

// Smart Rx defaults: pre-fill dosage/frequency/duration by medicine
const SMART_DEFAULTS: Record<string, Partial<Medication>> = {
  "Amoxicillin 500mg": { dosage: "1 cap", frequency: "Thrice daily", duration: "5 days" },
  "Metronidazole 400mg": { dosage: "1 tab", frequency: "Thrice daily", duration: "5 days" },
  "Ibuprofen 400mg": { dosage: "1 tab", frequency: "Thrice daily", duration: "3 days" },
  "Paracetamol 500mg": { dosage: "1 tab", frequency: "Thrice daily", duration: "3 days" },
  "Diclofenac 50mg": { dosage: "1 tab", frequency: "Twice daily", duration: "3 days" },
  "Clindamycin 300mg": { dosage: "1 cap", frequency: "Thrice daily", duration: "5 days" },
  "Azithromycin 500mg": { dosage: "1 tab", frequency: "Once daily", duration: "3 days" },
  "Aceclofenac 100mg": { dosage: "1 tab", frequency: "Twice daily", duration: "5 days" },
  "Ornidazole 500mg": { dosage: "1 tab", frequency: "Twice daily", duration: "5 days" },
  "Fluconazole 150mg": { dosage: "1 cap", frequency: "Once daily", duration: "As directed" },
  "Chlorhexidine Mouthwash": { dosage: "10ml rinse", frequency: "Twice daily", duration: "14 days" },
  "Povidone Iodine Gargle": { dosage: "15ml gargle", frequency: "Thrice daily", duration: "7 days" },
};

export default function MedicationPanel({ medications, treatmentPlan, onMedicationsChange, onTreatmentPlanChange }: MedicationPanelProps) {
  const [form, setForm] = useState<Medication>({ name: "", dosage: "1 tab", frequency: "Twice daily", duration: "5 days" });

  // Restore draft medications from localStorage
  useEffect(() => {
    try {
      const savedMeds = localStorage.getItem("draft:medications");
      const savedPlan = localStorage.getItem("draft:treatmentPlan");
      if (savedMeds && medications.length === 0) onMedicationsChange(JSON.parse(savedMeds));
      if (savedPlan && !treatmentPlan) onTreatmentPlanChange(savedPlan);
    } catch { /* ignore */ }
  }, []); // eslint-disable-line

  // Auto-save drafts
  useEffect(() => {
    if (medications.length > 0) localStorage.setItem("draft:medications", JSON.stringify(medications));
    if (treatmentPlan) localStorage.setItem("draft:treatmentPlan", treatmentPlan);
  }, [medications, treatmentPlan]);

  const addMed = () => {
    if (!form.name) return;
    onMedicationsChange([...medications, { ...form }]);
    setForm({ name: "", dosage: "1 tab", frequency: "Twice daily", duration: "5 days" });
  };

  const removeMed = (idx: number) => {
    onMedicationsChange(medications.filter((_, i) => i !== idx));
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base flex items-center gap-2">
          <Pill className="h-4 w-4 text-primary" />
          Treatment Plan & Medication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Treatment plan */}
        <div>
          <Label className="text-xs font-semibold">Treatment Plan</Label>
          <textarea
            className="w-full mt-1 p-2 text-sm border rounded-md bg-background resize-none"
            placeholder="Describe overall treatment plan..."
            rows={2}
            value={treatmentPlan}
            onChange={e => onTreatmentPlanChange(e.target.value)}
          />
        </div>

        {/* Add medication */}
        <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Add Medicine</Label>
          <Select value={form.name} onValueChange={v => {
            const defaults = SMART_DEFAULTS[v];
            setForm(f => ({ ...f, name: v, ...(defaults || {}) }));
          }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select medicine..." /></SelectTrigger>
            <SelectContent>
              {COMMON_MEDICINES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-3 gap-2">
            <Input className="h-8 text-xs" placeholder="Dosage" value={form.dosage} onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))} />
            <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.duration} onValueChange={v => setForm(f => ({ ...f, duration: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{DURATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={addMed} disabled={!form.name} className="w-full">
            <Plus className="h-3 w-3 mr-1" />Add Medicine
          </Button>
        </div>

        {/* Medication list */}
        {medications.length > 0 && (
          <div className="space-y-1.5">
            {medications.map((med, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded bg-muted text-xs">
                <div className="flex-1">
                  <p className="font-medium">{med.name}</p>
                  <p className="text-muted-foreground">{med.dosage} · {med.frequency} · {med.duration}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeMed(idx)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
