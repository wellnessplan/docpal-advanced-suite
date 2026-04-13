import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileCheck, Plus, PenLine } from "lucide-react";

interface ConsentFormsProps {
  patientId: string;
  clinicId: string;
}

const PROCEDURES = [
  "Extraction", "Root Canal (RCT)", "Crown", "Implant", "Orthodontics",
  "Surgery", "Scaling", "Whitening", "Bridge", "Denture", "General Treatment",
];

export default function ConsentForms({ patientId, clinicId }: ConsentFormsProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [procedure, setProcedure] = useState("");
  const [consentType, setConsentType] = useState<"checkbox" | "signature">("checkbox");
  const [agreed, setAgreed] = useState(false);
  const [witnessedBy, setWitnessedBy] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState("");

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const { data: consents = [] } = useQuery({
    queryKey: ["consent-forms", patientId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("consent_forms")
        .select("*").eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (consentType === "signature" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
    }
  }, [consentType, showForm]);

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const rect = canvasRef.current.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  };

  const saveConsent = useMutation({
    mutationFn: async () => {
      if (!procedure) throw new Error("Select a procedure");
      if (consentType === "checkbox" && !agreed) throw new Error("Patient must agree");
      if (consentType === "signature" && !hasSignature) throw new Error("Signature required");

      let signatureData: string | null = null;
      if (consentType === "signature" && canvasRef.current) {
        signatureData = canvasRef.current.toDataURL("image/png");
      }

      const { error } = await (supabase as any).from("consent_forms").insert({
        clinic_id: clinicId,
        patient_id: patientId,
        procedure_name: procedure,
        consent_type: consentType,
        signature_data: signatureData,
        consented_at: new Date().toISOString(),
        witnessed_by: witnessedBy || null,
        is_minor: isMinor,
        guardian_name: isMinor ? guardianName : null,
        form_content: consentType === "checkbox"
          ? `Patient consented to ${procedure} via checkbox agreement.`
          : `Patient provided digital signature for ${procedure}.`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consent-forms"] });
      setShowForm(false);
      setProcedure("");
      setAgreed(false);
      setWitnessedBy("");
      setIsMinor(false);
      setGuardianName("");
      setHasSignature(false);
      toast.success("Consent recorded");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold">Consent Forms</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          <Plus className="h-3 w-3 mr-1" />{showForm ? "Cancel" : "New Consent"}
        </Button>
      </div>

      {showForm && (
        <Card className="shadow-card border-0">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Procedure</Label>
                <Select value={procedure} onValueChange={setProcedure}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {PROCEDURES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Consent Type</Label>
                <Select value={consentType} onValueChange={v => setConsentType(v as any)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checkbox">Checkbox Consent</SelectItem>
                    <SelectItem value="signature">Digital Signature</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox checked={isMinor} onCheckedChange={v => setIsMinor(!!v)} id="minor" />
                <Label htmlFor="minor" className="text-xs">Minor Patient</Label>
              </div>
              {isMinor && (
                <Input className="h-8 text-xs flex-1" placeholder="Guardian name" value={guardianName} onChange={e => setGuardianName(e.target.value)} />
              )}
            </div>

            <Input className="h-8 text-xs" placeholder="Witnessed by (optional)" value={witnessedBy} onChange={e => setWitnessedBy(e.target.value)} />

            {consentType === "checkbox" ? (
              <div className="p-3 bg-muted/50 rounded-lg border space-y-3">
                <p className="text-xs text-muted-foreground">
                  I, the patient (or guardian), understand the nature of the proposed {procedure || "procedure"}, including its risks, benefits, and alternatives.
                  I voluntarily consent to proceed with the treatment.
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox checked={agreed} onCheckedChange={v => setAgreed(!!v)} id="agree" />
                  <Label htmlFor="agree" className="text-xs font-medium">I agree to the above</Label>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1"><PenLine className="h-3 w-3" />Draw signature below</Label>
                  <Button size="sm" variant="ghost" onClick={clearSignature} className="text-xs h-6">Clear</Button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="border rounded-lg cursor-crosshair w-full bg-white"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={() => setIsDrawing(false)}
                  onMouseLeave={() => setIsDrawing(false)}
                />
              </div>
            )}

            <Button
              className="w-full"
              size="sm"
              onClick={() => saveConsent.mutate()}
              disabled={saveConsent.isPending || !procedure}
            >
              <FileCheck className="h-3 w-3 mr-1" />
              {saveConsent.isPending ? "Saving..." : "Record Consent"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {consents.map((c: any) => (
          <Card key={c.id} className="shadow-card border-0">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                  <FileCheck className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium">{c.procedure_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.consent_type === "signature" ? "Digital Signature" : "Checkbox"}
                    {c.witnessed_by ? ` · Witnessed by ${c.witnessed_by}` : ""}
                    {c.is_minor ? ` · Minor (Guardian: ${c.guardian_name})` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">
                  {c.consented_at ? "Signed" : "Pending"}
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
        {!consents.length && !showForm && (
          <p className="text-xs text-muted-foreground text-center py-4">No consent forms recorded yet.</p>
        )}
      </div>
    </div>
  );
}
