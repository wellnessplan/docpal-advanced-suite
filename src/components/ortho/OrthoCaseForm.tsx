import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const CASE_TYPES = [
  { value: "fixed_metal", label: "Fixed Braces — Metal" },
  { value: "fixed_ceramic", label: "Fixed Braces — Ceramic" },
  { value: "fixed_self_ligating", label: "Fixed Braces — Self-Ligating" },
  { value: "clear_aligners", label: "Clear Aligners" },
  { value: "removable_appliance", label: "Removable Appliance" },
  { value: "functional_appliance", label: "Functional Appliance" },
  { value: "retainers", label: "Retainers" },
];

const MALOCCLUSION_CLASSES = ["Angle Class I", "Angle Class II Div 1", "Angle Class II Div 2", "Angle Class III"];
const SKELETAL_PATTERNS = ["Orthognathic", "Mild Skeletal II", "Severe Skeletal II", "Mild Skeletal III", "Severe Skeletal III"];

const PRE_TREATMENT_ITEMS = ["OPG", "Lateral Cephalogram", "Study Models", "IOPA", "Clinical Photos", "PA Cephalogram", "Hand-Wrist X-ray"];

interface Props {
  clinicId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OrthoCaseForm({ clinicId, onClose, onSuccess }: Props) {
  const [patientId, setPatientId] = useState("");
  const [caseType, setCaseType] = useState("fixed_metal");
  const [malocclusion, setMalocclusion] = useState("");
  const [skeletal, setSkeletal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [duration, setDuration] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("id, full_name, op_number" as any).order("full_name");
      return data ?? [];
    },
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["providers", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, role").in("role", ["owner", "dentist"]);
      return data ?? [];
    },
  });

  const [orthodontistId, setOrthodontistId] = useState("");

  const createCase = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("ortho_cases") as any).insert({
        clinic_id: clinicId,
        patient_id: patientId,
        doctor_id: orthodontistId || null,
        case_type: caseType,
        malocclusion_class: malocclusion || null,
        skeletal_pattern: skeletal || null,
        case_start_date: startDate || null,
        start_date: startDate || null,
        estimated_duration_months: duration ? parseInt(duration) : null,
        total_estimated_cost: cost ? parseFloat(cost) : 0,
        total_cost: cost ? parseFloat(cost) : 0,
        notes: notes || null,
        pre_treatment_checklist: checklist,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ortho case created!");
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">New Orthodontic Case</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Patient *</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name} {p.op_number ? `(${p.op_number})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Orthodontist</Label>
              <Select value={orthodontistId} onValueChange={setOrthodontistId}>
                <SelectTrigger><SelectValue placeholder="Assign orthodontist" /></SelectTrigger>
                <SelectContent>
                  {providers.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Case Type *</Label>
              <Select value={caseType} onValueChange={setCaseType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CASE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Malocclusion Classification</Label>
              <Select value={malocclusion} onValueChange={setMalocclusion}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {MALOCCLUSION_CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Skeletal Pattern</Label>
              <Select value={skeletal} onValueChange={setSkeletal}>
                <SelectTrigger><SelectValue placeholder="Select pattern" /></SelectTrigger>
                <SelectContent>
                  {SKELETAL_PATTERNS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Est. Duration (months)</Label>
              <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 18" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Total Estimated Cost (Rs )</Label>
            <Input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="e.g. 45000" />
          </div>

          <div className="space-y-2">
            <Label>Pre-Treatment Records Checklist</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PRE_TREATMENT_ITEMS.map(item => (
                <div key={item} className="flex items-center gap-2">
                  <Checkbox
                    checked={checklist[item] || false}
                    onCheckedChange={(v) => setChecklist(prev => ({ ...prev, [item]: !!v }))}
                  />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional case notes..." />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => createCase.mutate()} disabled={!patientId || createCase.isPending}>
              {createCase.isPending ? "Creating..." : "Create Case"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
