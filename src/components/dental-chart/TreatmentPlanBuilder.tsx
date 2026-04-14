import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, ClipboardList, CalendarDays, IndianRupee, CheckCircle2, Send, Download, Share2, Clock, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";

interface ExamFinding {
  tooth: number | string;
  condition: string;
  treatment: string;
}

interface TreatmentPlanBuilderProps {
  patientId: string;
  clinicId: string;
  patient: any;
  clinic: any;
  examFindings?: ExamFinding[];
}

const TREATMENTS = [
  { name: "Filling", types: ["Composite", "GIC", "Amalgam", "Ceramic Inlay"] },
  { name: "Root Canal (RCT)", types: ["Single Canal", "Multi Canal", "Re-RCT"] },
  { name: "Crown", types: ["PFM Crown", "Zirconia Crown", "E-max Crown", "Metal Crown", "Ceramic Crown"] },
  { name: "Extraction", types: ["Simple", "Surgical", "Impacted Wisdom Tooth"] },
  { name: "Scaling", types: ["Full Mouth Scaling", "Deep Scaling + Root Planing"] },
  { name: "Bridge", types: ["PFM Bridge", "Zirconia Bridge", "Maryland Bridge"] },
  { name: "Implant", types: ["Single Implant", "Mini Implant", "All-on-4", "All-on-6"] },
  { name: "Veneer", types: ["Porcelain Veneer", "Composite Veneer", "Lumineers"] },
  { name: "Denture", types: ["Complete Denture", "Partial Denture", "Flexible Denture"] },
  { name: "Whitening", types: ["In-Office Bleaching", "Home Kit", "Laser Whitening"] },
  { name: "Orthodontics", types: ["Metal Braces", "Ceramic Braces", "Aligners", "Retainer"] },
  { name: "X-Ray", types: ["IOPA", "OPG", "CBCT"] },
];

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  presented: "bg-blue-100 text-blue-700",
  patient_accepted: "bg-green-100 text-green-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-emerald-100 text-emerald-700",
};

type ItemDecision = "accepted" | "rejected" | "later" | "pending";

interface PlanItem {
  id?: string;
  tooth_number: number | null;
  procedure_name: string;
  treatment_type: string;
  treatment_options: string[];
  selected_option: string;
  estimated_cost: number;
  scheduled_date: string;
  notes: string;
  status: string;
  decision?: ItemDecision;
}

export default function TreatmentPlanBuilder({ patientId, clinicId, patient, clinic, examFindings = [] }: TreatmentPlanBuilderProps) {
  const queryClient = useQueryClient();
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState("Treatment Plan");
  const [doctorNotes, setDoctorNotes] = useState("");
  const [items, setItems] = useState<PlanItem[]>([]);
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [showPatientView, setShowPatientView] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const { data: pricingMap } = useQuery({
    queryKey: ["treatment-pricing", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("treatment_pricing").select("treatment_name, price").eq("clinic_id", clinicId);
      const map: Record<string, number> = {};
      data?.forEach((p: any) => { map[p.treatment_name] = Number(p.price); });
      return map;
    },
    enabled: !!clinicId,
  });

  const { data: existingPlans = [], refetch: refetchPlans } = useQuery({
    queryKey: ["treatment-plans-patient", patientId, clinicId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("treatment_plans")
        .select("*").eq("patient_id", patientId).eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!patientId && !!clinicId,
  });

  const { data: planItems = [], refetch: refetchItems } = useQuery({
    queryKey: ["treatment-plan-items", activePlanId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("treatment_plan_items")
        .select("*").eq("treatment_plan_id", activePlanId!).order("sort_order");
      return data ?? [];
    },
    enabled: !!activePlanId,
  });

  useEffect(() => {
    if (planItems.length > 0 && activePlanId) {
      setItems(planItems.map((i: any) => ({
        id: i.id,
        tooth_number: i.tooth_number,
        procedure_name: i.procedure_name,
        treatment_type: i.treatment_type || "",
        treatment_options: Array.isArray(i.treatment_options) ? i.treatment_options : [],
        selected_option: i.selected_option || "",
        estimated_cost: Number(i.estimated_cost) || 0,
        scheduled_date: i.scheduled_date || "",
        notes: i.notes || "",
        status: i.status || "planned",
        decision: (i.status === "in_progress" ? "accepted" : i.status === "rejected" ? "rejected" : i.status === "deferred" ? "later" : "pending") as ItemDecision,
      })));
    }
  }, [planItems, activePlanId]);

  // Signature canvas handlers
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const yp = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x * (canvas.width / rect.width), yp * (canvas.height / rect.height));
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const yp = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(x * (canvas.width / rect.width), yp * (canvas.height / rect.height));
    ctx.stroke();
    setHasSignature(true);
  };
  const endDraw = () => setIsDrawing(false);
  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const loadPlan = (plan: any) => {
    setActivePlanId(plan.id);
    setPlanName(plan.plan_name);
    setDoctorNotes(plan.doctor_notes || "");
    setConsentChecked(false);
    setHasSignature(false);
  };

  const createNewPlan = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).from("treatment_plans").insert({
        clinic_id: clinicId, patient_id: patientId, plan_name: "Treatment Plan", status: "draft", total_estimated_cost: 0,
      }).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setActivePlanId(data.id);
      setPlanName("Treatment Plan");
      setDoctorNotes("");
      if (examFindings.length > 0) {
        const imported: PlanItem[] = examFindings.map(f => ({
          tooth_number: typeof f.tooth === "number" ? f.tooth : Number(f.tooth) || null,
          procedure_name: f.treatment || f.condition || "—",
          treatment_type: "", treatment_options: [], selected_option: "",
          estimated_cost: pricingMap?.[f.treatment] || 0,
          scheduled_date: "", notes: f.condition ? `Dx: ${f.condition}` : "", status: "planned", decision: "pending" as ItemDecision,
        }));
        setItems(imported);
      } else {
        setItems([]);
      }
      refetchPlans();
      toast.success("New plan created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleTooth = (num: number) => {
    setSelectedTeeth(prev => prev.includes(num) ? prev.filter(t => t !== num) : [...prev, num]);
  };

  const addItemForTeeth = (treatmentName: string, treatmentType: string) => {
    const treatment = TREATMENTS.find(t => t.name === treatmentName);
    const cost = pricingMap?.[treatmentName] || 0;
    const teeth = selectedTeeth.length > 0 ? selectedTeeth : [null];
    const newItems: PlanItem[] = teeth.map(tooth => ({
      tooth_number: tooth, procedure_name: treatmentName, treatment_type: treatmentType,
      treatment_options: treatment?.types || [], selected_option: treatmentType,
      estimated_cost: cost, scheduled_date: "", notes: "", status: "planned", decision: "pending" as ItemDecision,
    }));
    setItems(prev => [...prev, ...newItems]);
    setSelectedTeeth([]);
  };

  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  const updateItem = (index: number, field: keyof PlanItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const setItemDecision = (index: number, decision: ItemDecision) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, decision } : item));
  };

  const totalCost = items.reduce((sum, item) => sum + (item.estimated_cost || 0), 0);
  const acceptedCost = items.filter(i => i.decision === "accepted").reduce((sum, i) => sum + (i.estimated_cost || 0), 0);

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!activePlanId) throw new Error("No plan selected");
      await (supabase as any).from("treatment_plans").update({
        plan_name: planName, doctor_notes: doctorNotes, total_estimated_cost: totalCost,
      }).eq("id", activePlanId);
      await (supabase as any).from("treatment_plan_items").delete().eq("treatment_plan_id", activePlanId);
      if (items.length > 0) {
        const rows = items.map((item, idx) => ({
          treatment_plan_id: activePlanId, tooth_number: item.tooth_number,
          procedure_name: item.procedure_name, treatment_type: item.treatment_type,
          treatment_options: item.treatment_options, selected_option: item.selected_option,
          estimated_cost: item.estimated_cost, scheduled_date: item.scheduled_date || null,
          notes: item.notes, status: item.decision === "accepted" ? "in_progress" : item.decision === "rejected" ? "rejected" : item.decision === "later" ? "deferred" : item.status,
          sort_order: idx,
        }));
        const { error } = await (supabase as any).from("treatment_plan_items").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => { refetchPlans(); refetchItems(); toast.success("Plan saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const presentPlan = useMutation({
    mutationFn: async () => {
      await savePlan.mutateAsync();
      await (supabase as any).from("treatment_plans").update({
        status: "presented", presented_at: new Date().toISOString(),
      }).eq("id", activePlanId!);
    },
    onSuccess: () => { refetchPlans(); toast.success("Plan presented to patient"); setShowPatientView(true); },
    onError: (e: any) => toast.error(e.message),
  });

  const acceptPlan = useMutation({
    mutationFn: async () => {
      const acceptedItems = items.filter(i => i.decision === "accepted");
      if (acceptedItems.length === 0) throw new Error("Please accept at least one treatment");
      if (!consentChecked) throw new Error("Please check the consent checkbox");
      if (!hasSignature) throw new Error("Please provide your signature");

      await (supabase as any).from("treatment_plans").update({
        status: "patient_accepted", accepted_at: new Date().toISOString(),
      }).eq("id", activePlanId!);

      // Save per-item decisions
      for (const item of items) {
        if (item.id) {
          const newStatus = item.decision === "accepted" ? "in_progress" : item.decision === "rejected" ? "rejected" : item.decision === "later" ? "deferred" : "planned";
          await (supabase as any).from("treatment_plan_items").update({ status: newStatus }).eq("id", item.id);
        }
      }

      // Auto-create invoice for accepted items only
      if (acceptedCost > 0) {
        const { data: invoice } = await supabase.from("invoices").insert({
          patient_id: patientId, clinic_id: clinicId, amount: acceptedCost, total: acceptedCost, subtotal: acceptedCost,
          status: "draft", invoice_date: new Date().toISOString().split("T")[0], notes: `Treatment Plan: ${planName}`,
        }).select("id").single();
        if (invoice) {
          const lineItems = acceptedItems.filter(i => i.estimated_cost > 0).map(i => ({
            invoice_id: invoice.id,
            description: `${i.procedure_name}${i.selected_option ? ` (${i.selected_option})` : ""}${i.tooth_number ? ` - Tooth #${i.tooth_number}` : ""}`,
            unit_price: i.estimated_cost, quantity: 1, total: i.estimated_cost,
          }));
          if (lineItems.length > 0) await supabase.from("invoice_items").insert(lineItems);
        }
      }
    },
    onSuccess: () => { refetchPlans(); refetchItems(); toast.success("Plan accepted! Invoice created for accepted treatments."); },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    const lm = 15;
    const pw = 180;
    const rm = lm + pw;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(clinic?.name || "Dental Clinic", lm, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    if (clinic?.address) { doc.text(clinic.address, lm, y); y += 4; }
    if (clinic?.phone) { doc.text(clinic.phone, lm, y); y += 4; }
    y += 2;
    doc.setDrawColor(150);
    doc.line(lm, y, rm, y);
    y += 8;

    doc.setTextColor(30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Treatment Plan", lm, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Patient: ${patient?.full_name || ""}`, lm, y);
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, rm, y, { align: "right" });
    y += 8;

    const cols = [lm, lm + 12, lm + 55, lm + 95, lm + 125, lm + 155];
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(245, 245, 245);
    doc.rect(lm, y - 4, pw, 7, "F");
    ["#", "Treatment", "Type/Material", "Tooth", "Cost (₹)", "Decision"].forEach((h, i) => doc.text(h, cols[i], y));
    y += 6;
    doc.setFont("helvetica", "normal");

    items.forEach((item, idx) => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.text(String(idx + 1), cols[0], y);
      doc.text(doc.splitTextToSize(item.procedure_name, 40)[0], cols[1], y);
      doc.text(doc.splitTextToSize(item.selected_option || "—", 37)[0], cols[2], y);
      doc.text(item.tooth_number ? `#${item.tooth_number}` : "—", cols[3], y);
      doc.text(`₹${item.estimated_cost.toLocaleString()}`, cols[4], y);
      const dec = item.decision === "accepted" ? "✓ Accept" : item.decision === "rejected" ? "✗ Reject" : item.decision === "later" ? "⏳ Later" : "Pending";
      doc.text(dec, cols[5], y);
      if (item.notes) { y += 3.5; doc.setTextColor(120); doc.setFontSize(6.5); doc.text(`Note: ${item.notes}`, cols[1], y); doc.setTextColor(40); doc.setFontSize(7.5); }
      y += 5;
    });

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ₹${totalCost.toLocaleString()}`, rm, y, { align: "right" });
    y += 5;
    doc.text(`Accepted: ₹${acceptedCost.toLocaleString()}`, rm, y, { align: "right" });
    y += 15;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Patient Consent:", lm, y);
    y += 6;
    doc.text("☐ I agree to the accepted treatments and authorize the dental procedures.", lm, y);
    y += 15;
    doc.line(lm, y, lm + 60, y);
    doc.text("Patient Signature", lm, y + 5);
    doc.line(lm + 100, y, rm, y);
    doc.text("Date", lm + 100, y + 5);

    doc.save(`TreatmentPlan_${patient?.full_name}_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF downloaded");
  };

  // ─── No active plan: show list ───
  if (!activePlanId) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />Treatment Plans
          </h3>
          <div className="flex gap-1.5">
            {examFindings.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => createNewPlan.mutate()}>
                Import from Exam ({examFindings.length})
              </Button>
            )}
            <Button size="sm" className="gap-1" onClick={() => createNewPlan.mutate()} disabled={createNewPlan.isPending}>
              <Plus className="h-3 w-3" />{createNewPlan.isPending ? "Creating..." : "New Plan"}
            </Button>
          </div>
        </div>
        {existingPlans.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No treatment plans yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create a plan to outline treatments, costs & schedule</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {existingPlans.map((plan: any) => (
              <Card key={plan.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => loadPlan(plan)}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{plan.plan_name}</p>
                    <p className="text-xs text-muted-foreground">₹{(plan.total_estimated_cost || 0).toLocaleString()} · {new Date(plan.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                  <Badge className={STATUS_COLORS[plan.status] || ""}>{plan.status.replace("_", " ")}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Patient-facing view with per-item decisions + consent ───
  if (showPatientView) {
    const currentPlan = existingPlans.find((p: any) => p.id === activePlanId);
    const isPresentedOrDraft = currentPlan?.status === "presented" || currentPlan?.status === "draft";

    return (
      <div className="space-y-4">
        <Card className="shadow-card border-0 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3 flex items-center justify-between">
            <h3 className="font-heading text-base font-semibold">Treatment Plan — Patient View</h3>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={downloadPDF}><Download className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setShowPatientView(false)}>← Back</Button>
            </div>
          </div>
          <CardContent className="p-5 space-y-4">
            {/* Clinic + Patient header */}
            <div className="flex justify-between items-start">
              <div>
                <p className="text-lg font-bold">{clinic?.name}</p>
                <p className="text-xs text-muted-foreground">{clinic?.address}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{patient?.full_name}</p>
                <p className="text-xs text-muted-foreground">{patient?.phone}</p>
              </div>
            </div>

            <Separator />

            {/* Treatment items with decision checkboxes */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Treatments ({items.length})
              </h4>
              {items.map((item, idx) => (
                <div key={idx} className={cn(
                  "p-3 rounded-lg border transition-colors",
                  item.decision === "accepted" && "bg-green-50 border-green-200",
                  item.decision === "rejected" && "bg-red-50 border-red-200 opacity-70",
                  item.decision === "later" && "bg-amber-50 border-amber-200",
                  item.decision === "pending" && "bg-muted/50",
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{item.procedure_name}</p>
                        {item.tooth_number && <Badge variant="outline" className="text-[10px]">Tooth #{item.tooth_number}</Badge>}
                      </div>
                      {item.selected_option && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Material/Type: <span className="font-medium text-foreground">{item.selected_option}</span>
                        </p>
                      )}
                      {item.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">Note: {item.notes}</p>}
                      {item.scheduled_date && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <CalendarDays className="h-3 w-3" />{new Date(item.scheduled_date).toLocaleDateString("en-IN")}
                        </p>
                      )}
                    </div>
                    <p className="font-bold text-sm whitespace-nowrap">₹{item.estimated_cost.toLocaleString()}</p>
                  </div>

                  {/* Per-item decision buttons */}
                  {isPresentedOrDraft && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed">
                      <span className="text-[10px] text-muted-foreground mr-1">Decision:</span>
                      <Button
                        size="sm" variant={item.decision === "accepted" ? "default" : "outline"}
                        className={cn("h-6 text-[10px] gap-1 px-2", item.decision === "accepted" && "bg-green-600 hover:bg-green-700")}
                        onClick={() => setItemDecision(idx, item.decision === "accepted" ? "pending" : "accepted")}
                      >
                        <Check className="h-3 w-3" />Accept
                      </Button>
                      <Button
                        size="sm" variant={item.decision === "rejected" ? "default" : "outline"}
                        className={cn("h-6 text-[10px] gap-1 px-2", item.decision === "rejected" && "bg-red-600 hover:bg-red-700")}
                        onClick={() => setItemDecision(idx, item.decision === "rejected" ? "pending" : "rejected")}
                      >
                        <X className="h-3 w-3" />Reject
                      </Button>
                      <Button
                        size="sm" variant={item.decision === "later" ? "default" : "outline"}
                        className={cn("h-6 text-[10px] gap-1 px-2", item.decision === "later" && "bg-amber-600 hover:bg-amber-700")}
                        onClick={() => setItemDecision(idx, item.decision === "later" ? "pending" : "later")}
                      >
                        <Clock className="h-3 w-3" />Later
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Cost summary */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Total Estimated Cost</p>
                <p className="font-bold">₹{totalCost.toLocaleString()}</p>
              </div>
              {items.some(i => i.decision === "accepted") && (
                <div className="flex justify-between items-center p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm font-semibold text-green-800">Accepted Treatments Cost</p>
                  <p className="text-lg font-bold text-green-700">₹{acceptedCost.toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Consent + Signature */}
            {isPresentedOrDraft && (
              <div className="space-y-4 pt-2">
                <Separator />
                <h4 className="text-sm font-bold">Patient Consent & Acceptance</h4>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="consent-check"
                    checked={consentChecked}
                    onCheckedChange={(v) => setConsentChecked(!!v)}
                    className="mt-0.5"
                  />
                  <label htmlFor="consent-check" className="text-xs leading-relaxed">
                    I, <span className="font-semibold">{patient?.full_name}</span>, agree to the accepted treatment procedures listed above.
                    I understand the estimated costs, materials, and payment terms. I authorize the dental team to proceed with the accepted treatments.
                  </label>
                </div>

                {/* Signature canvas */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Patient Signature</Label>
                  <div className="border rounded-lg bg-white p-1 relative">
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={120}
                      className="w-full h-20 cursor-crosshair touch-none"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={endDraw}
                      onMouseLeave={endDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={endDraw}
                    />
                    {!hasSignature && (
                      <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none">
                        Draw your signature here
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={clearSignature}>Clear Signature</Button>
                </div>

                <Button
                  className="w-full gap-2" size="lg"
                  onClick={() => acceptPlan.mutate()}
                  disabled={acceptPlan.isPending || !consentChecked || !hasSignature || !items.some(i => i.decision === "accepted")}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {acceptPlan.isPending ? "Processing..." : "Accept Treatment Plan"}
                </Button>
                {(!consentChecked || !hasSignature || !items.some(i => i.decision === "accepted")) && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    {!items.some(i => i.decision === "accepted") ? "Accept at least one treatment" :
                     !consentChecked ? "Check the consent box" : "Please sign above"}
                  </p>
                )}
              </div>
            )}

            {currentPlan?.status === "patient_accepted" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <p className="font-semibold text-green-800">Plan Accepted</p>
                <p className="text-xs text-green-600">{currentPlan.accepted_at && new Date(currentPlan.accepted_at).toLocaleString("en-IN")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Plan Builder ───
  return (
    <div className="space-y-3">
      <Card className="shadow-card border-0">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <Input value={planName} onChange={e => setPlanName(e.target.value)}
                className="h-8 text-sm font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 w-48" />
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => { setActivePlanId(null); setItems([]); }}>← Plans</Button>
              <Button size="sm" variant="outline" onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>
                {savePlan.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          <Textarea placeholder="Doctor's notes for this plan..." value={doctorNotes} onChange={e => setDoctorNotes(e.target.value)} rows={2} className="text-xs" />
        </CardContent>
      </Card>

      {/* Tooth selector */}
      <Card className="shadow-card border-0">
        <CardContent className="p-3 space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Select teeth (optional)</Label>
          <div className="flex flex-wrap gap-0.5 justify-center">
            {UPPER_TEETH.map(t => (
              <button key={t} onClick={() => toggleTooth(t)}
                className={cn("w-7 h-7 text-[10px] font-bold rounded border transition-all",
                  selectedTeeth.includes(t) ? "bg-primary text-primary-foreground border-primary scale-110" : "bg-background border-border hover:bg-accent"
                )}>{t}</button>
            ))}
          </div>
          <div className="border-t border-dashed" />
          <div className="flex flex-wrap gap-0.5 justify-center">
            {LOWER_TEETH.map(t => (
              <button key={t} onClick={() => toggleTooth(t)}
                className={cn("w-7 h-7 text-[10px] font-bold rounded border transition-all",
                  selectedTeeth.includes(t) ? "bg-primary text-primary-foreground border-primary scale-110" : "bg-background border-border hover:bg-accent"
                )}>{t}</button>
            ))}
          </div>
          {selectedTeeth.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-[10px] text-muted-foreground">Selected:</span>
              {selectedTeeth.map(t => <Badge key={t} variant="secondary" className="text-[10px] h-5">{t}</Badge>)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add treatment */}
      <Card className="shadow-card border-0">
        <CardContent className="p-3 space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Add Treatment</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {TREATMENTS.map(tx => (
              <div key={tx.name} className="space-y-1">
                <p className="text-xs font-semibold px-1">{tx.name}</p>
                <div className="flex flex-wrap gap-1">
                  {tx.types.map(type => (
                    <button key={type} onClick={() => addItemForTeeth(tx.name, type)}
                      className="px-2 py-1 text-[10px] rounded-md border bg-background hover:bg-primary/10 hover:border-primary transition-colors">
                      {type}{pricingMap?.[tx.name] ? <span className="ml-1 opacity-50">₹{pricingMap[tx.name]}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plan items */}
      {items.length > 0 && (
        <Card className="shadow-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">Plan Items ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-muted/50 border space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{item.procedure_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{item.selected_option}</Badge>
                      {item.tooth_number && <Badge variant="secondary" className="text-[10px]">Tooth #{item.tooth_number}</Badge>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Cost (₹)</Label>
                    <Input type="number" value={item.estimated_cost} onChange={e => updateItem(idx, "estimated_cost", Number(e.target.value))} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Schedule Date</Label>
                    <Input type="date" value={item.scheduled_date} onChange={e => updateItem(idx, "scheduled_date", e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>
                <Input placeholder="Notes..." value={item.notes} onChange={e => updateItem(idx, "notes", e.target.value)} className="h-7 text-xs" />
              </div>
            ))}
            <Separator />
            <div className="flex justify-between items-center p-2 rounded-lg bg-primary/5">
              <span className="font-bold text-sm">Total</span>
              <span className="text-lg font-bold text-primary flex items-center">
                <IndianRupee className="h-4 w-4" />{totalCost.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {items.length > 0 && (
        <div className="flex gap-2">
          <Button className="flex-1 gap-1" onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>
            {savePlan.isPending ? "Saving..." : "Save Plan"}
          </Button>
          <Button className="flex-1 gap-1" variant="default" onClick={() => presentPlan.mutate()} disabled={presentPlan.isPending}>
            <Send className="h-3 w-3" />{presentPlan.isPending ? "Presenting..." : "Present to Patient"}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setShowPatientView(true)}>
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={downloadPDF}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
