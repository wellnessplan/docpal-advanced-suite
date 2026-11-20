import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ClipboardList, FilePlus2 } from "lucide-react";
import VoiceDictation, { type SoapResult } from "./VoiceDictation";

interface ClinicalExamPanelProps {
  chiefComplaint: string;
  gumCondition: string;
  alignmentCondition: string;
  diagnosisNotes: string;
  selectedTooth?: number | null;
  onChange: (field: string, value: string) => void;
}

const GUM_CONDITIONS = ["Normal", "Gingivitis", "Periodontitis", "Recession", "Swelling", "Bleeding", "Abscess"];
const ALIGNMENT_CONDITIONS = ["Normal", "Crowding", "Spacing", "Crossbite", "Overbite", "Underbite", "Open Bite", "Deep Bite"];

const PROCEDURE_MACROS = [
  {
    name: "RCT",
    note: "Root canal therapy\nTooth: {tooth}\nPulpal/periapical diagnosis: [edit]\nCanals and working lengths: [edit]\nIrrigation: [edit]\nObturation: [edit]\nCoronal restoration: [edit]\nPost-operative advice: [edit]",
  },
  {
    name: "Class II composite",
    note: "Class II composite restoration\nTooth: {tooth}\nSurface(s): [edit]\nAnaesthesia/isolation: [edit]\nCaries and pulp findings: [edit]\nLiner/base, if used: [edit]\nMaterial and shade: [edit]\nContact and occlusion checked: [edit]\nPost-operative advice: [edit]",
  },
  {
    name: "Simple extraction",
    note: "Simple extraction\nTooth: {tooth}\nIndication: [edit]\nAnaesthesia: [edit]\nProcedure and findings: [edit]\nHaemostasis: [edit]\nComplications, if any: [edit]\nPost-operative instructions: [edit]",
  },
  {
    name: "Scaling & polishing",
    note: "Scaling and polishing\nAreas treated: [edit]\nDeposits/gingival findings: [edit]\nPatient tolerance: [edit]\nOral hygiene advice: [edit]\nRecommended review/recall: [edit]",
  },
  {
    name: "Crown preparation",
    note: "Crown preparation\nTooth: {tooth}\nIndication: [edit]\nAnaesthesia: [edit]\nPreparation and margin: [edit]\nMaterial/shade: [edit]\nProvisional and occlusion: [edit]\nLab instructions: [edit]\nNext visit: [edit]",
  },
];

export default function ClinicalExamPanel({
  chiefComplaint, gumCondition, alignmentCondition, diagnosisNotes, selectedTooth, onChange,
}: ClinicalExamPanelProps) {
  const insertProcedureMacro = (note: string) => {
    const tooth = selectedTooth ? `#${selectedTooth}` : "[enter tooth/site]";
    const preparedNote = note.replace(/\{tooth\}/g, tooth);
    onChange("diagnosis_notes", diagnosisNotes.trim() ? `${diagnosisNotes.trim()}\n\n${preparedNote}` : preparedNote);
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Clinical Examination
          </span>
          <VoiceDictation
            onApply={(s: SoapResult) => {
              if (s.chief_complaint) onChange("chief_complaint", s.chief_complaint);
              const diag = (["subjective","objective","assessment","plan"] as const)
                .map(k => s[k] ? `${k[0].toUpperCase()}: ${s[k]}` : null)
                .filter(Boolean)
                .join("\n");
              if (diag) onChange("diagnosis_notes", diag);
              if (s.gum_condition) onChange("gum_condition", s.gum_condition);
              if (s.alignment_condition) onChange("alignment_condition", s.alignment_condition);
            }}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs font-semibold">Chief Complaint</Label>
          <Textarea
            placeholder="Patient's main concern..."
            value={chiefComplaint}
            onChange={e => onChange("chief_complaint", e.target.value)}
            rows={2}
            className="mt-1 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold">Gum Condition</Label>
            <Select value={gumCondition} onValueChange={v => onChange("gum_condition", v)}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GUM_CONDITIONS.map(g => <SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold">Alignment</Label>
            <Select value={alignmentCondition} onValueChange={v => onChange("alignment_condition", v)}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALIGNMENT_CONDITIONS.map(a => <SelectItem key={a} value={a.toLowerCase()}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <Label className="text-xs font-semibold">Diagnosis Notes</Label>
            <span className="text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground">Procedure templates</span>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PROCEDURE_MACROS.map((macro) => (
              <Button
                key={macro.name}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => insertProcedureMacro(macro.note)}
                aria-label={`Insert ${macro.name} note template`}
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                {macro.name}
              </Button>
            ))}
          </div>
          <Textarea
            placeholder="Clinical findings..."
            value={diagnosisNotes}
            onChange={e => onChange("diagnosis_notes", e.target.value)}
            rows={2}
            className="mt-1 text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}
