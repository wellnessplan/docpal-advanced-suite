import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Smile, CalendarDays, ChevronLeft, Plus,
  Phone, Mail, User2, HeartPulse, FileText, Clock, IndianRupee, Printer
} from "lucide-react";
import InvoiceReceipt from "@/components/billing/InvoiceReceipt";
import VisitSummaryPDF from "@/components/dental-chart/VisitSummaryPDF";
import MedicalHistoryTab from "@/components/patients/MedicalHistoryTab";
import DocumentsTab from "@/components/patients/DocumentsTab";
import TreatmentTimeline from "@/components/patients/TreatmentTimeline";
import ConsentForms from "@/components/patients/ConsentForms";
import LabWorkTracker from "@/components/patients/LabWorkTracker";
import RecallReminders from "@/components/patients/RecallReminders";
import { useTreatmentCatalog } from "@/hooks/useTreatmentCatalog";

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-primary/10 text-primary border-primary/30",
  in_progress: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

const FALLBACK_TREATMENTS = [
  "Filling", "Root Canal (RCT)", "Crown", "Extraction", "Scaling",
  "Veneer", "Bridge", "Implant", "Whitening", "Denture", "RPD", "FPD",
  "Pulp Capping", "Post & Core", "Inlay", "Onlay", "Orthodontics",
];

// Treatments that require lab work
const LAB_TREATMENTS = ["Crown", "Bridge", "Denture", "RPD", "FPD", "Veneer", "Implant", "Inlay", "Onlay", "Post & Core"];

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();
  const { names: catalogNames } = useTreatmentCatalog();
  const treatmentOptions = catalogNames.length ? catalogNames : FALLBACK_TREATMENTS;
  const [showAddTreatment, setShowAddTreatment] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceData, setInvoiceData] = useState<{ treatmentId: string; name: string; cost: number; discount: number } | null>(null);
  const [newTx, setNewTx] = useState({ tooth_number: "", treatment_name: "", cost: "", notes: "", shade: "", material: "", lab_name: "" });
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [receiptInvoice, setReceiptInvoice] = useState<any>(null);

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["patient-appointments", id],
    queryFn: async () => {
      const { data } = await supabase.from("appointments").select("*")
        .eq("patient_id", id!).order("appointment_date", { ascending: false }).limit(10);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ["patient-treatments", id],
    queryFn: async () => {
      const { data } = await supabase.from("tooth_treatments")
        .select("*, tooth_records!inner(tooth_number)")
        .eq("tooth_records.patient_id", id!)
        .order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["patient-invoices", id],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("*")
        .eq("patient_id", id!).order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
    enabled: !!id,
  });

  // Completed treatments that have NOT yet been put on any invoice
  const { data: unbilledTreatments = [] } = useQuery({
    queryKey: ["patient-unbilled-treatments", id],
    queryFn: async () => {
      const { data: records } = await supabase.from("tooth_records")
        .select("id, tooth_number").eq("patient_id", id!);
      if (!records?.length) return [];
      const recIds = records.map(r => r.id);
      const { data: txs } = await supabase.from("tooth_treatments")
        .select("id, treatment_name, cost, tooth_record_id, performed_at")
        .in("tooth_record_id", recIds)
        .eq("status", "completed" as any);
      if (!txs?.length) return [];
      const { data: billed } = await supabase.from("invoice_items")
        .select("tooth_treatment_id")
        .in("tooth_treatment_id", txs.map(t => t.id));
      const billedSet = new Set((billed ?? []).map((b: any) => b.tooth_treatment_id).filter(Boolean));
      const toothMap = Object.fromEntries(records.map(r => [r.id, r.tooth_number]));
      return txs.filter(t => !billedSet.has(t.id))
        .map(t => ({ ...t, tooth_number: toothMap[t.tooth_record_id] }));
    },
    enabled: !!id,
  });

  const { data: clinic } = useQuery({
    queryKey: ["clinic", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("*").eq("id", clinicId!).single();
      return data;
    },
    enabled: !!clinicId,
  });

  const { data: receiptItems = [] } = useQuery({
    queryKey: ["receipt-items", receiptInvoice?.id],
    queryFn: async () => {
      if (!receiptInvoice?.id) return [];
      const { data } = await supabase.from("invoice_items").select("*").eq("invoice_id", receiptInvoice.id);
      return data ?? [];
    },
    enabled: !!receiptInvoice?.id,
  });

  const { data: receiptPayments = [] } = useQuery({
    queryKey: ["receipt-payments", receiptInvoice?.id],
    queryFn: async () => {
      if (!receiptInvoice?.id) return [];
      const { data } = await supabase.from("payments").select("*").eq("invoice_id", receiptInvoice.id).order("payment_date");
      return data ?? [];
    },
    enabled: !!receiptInvoice?.id,
  });

  // Add new treatment directly
  const addTreatment = useMutation({
    mutationFn: async () => {
      if (!newTx.tooth_number || !newTx.treatment_name) throw new Error("Tooth number and treatment are required");
      // Ensure tooth_record exists
      const toothNum = parseInt(newTx.tooth_number);
      let { data: existing } = await supabase.from("tooth_records")
        .select("id").eq("patient_id", id!).eq("tooth_number", toothNum).single();
      
      let toothRecordId = existing?.id;
      if (!toothRecordId) {
        const { data: newRec, error: recErr } = await supabase.from("tooth_records").insert({
          clinic_id: clinicId!, patient_id: id!, tooth_number: toothNum, status: "needs_treatment",
        }).select("id").single();
        if (recErr) throw recErr;
        toothRecordId = newRec!.id;
      }

      // Create treatment
      const cost = newTx.cost ? Number(newTx.cost) : 0;
      const { data: treatment, error } = await supabase.from("tooth_treatments").insert({
        tooth_record_id: toothRecordId,
        treatment_name: newTx.treatment_name,
        cost,
        notes: newTx.notes || null,
        status: "planned",
      }).select("id").single();
      if (error) throw error;

      // Auto-create lab order for lab treatments
      const isLabWork = LAB_TREATMENTS.some(lt => newTx.treatment_name.toLowerCase().includes(lt.toLowerCase()));
      if (isLabWork) {
        await (supabase as any).from("lab_orders").insert({
          clinic_id: clinicId!,
          patient_id: id!,
          tooth_treatment_id: treatment!.id,
          item_description: `${newTx.treatment_name} — Tooth #${toothNum}`,
          lab_name: newTx.lab_name || null,
          shade: newTx.shade || null,
          work_type: newTx.treatment_name,
          special_instructions: newTx.material ? `Material: ${newTx.material}` : null,
          cost: cost,
          status: "draft",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-treatments"] });
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      setShowAddTreatment(false);
      setNewTx({ tooth_number: "", treatment_name: "", cost: "", notes: "", shade: "", material: "", lab_name: "" });
      toast.success("Treatment added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Update treatment status — no auto-popup. Completed unbilled treatments
  // surface in the Billing tab and on the /billing Create Invoice screen.
  const updateTreatmentStatus = useMutation({
    mutationFn: async ({ treatmentId, status }: { treatmentId: string; status: string; treatmentName?: string; cost?: number }) => {
      const update: any = { status: status as any };
      if (status === "completed") update.performed_at = new Date().toISOString();
      const { error } = await supabase.from("tooth_treatments").update(update).eq("id", treatmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-treatments"] });
      queryClient.invalidateQueries({ queryKey: ["patient-unbilled-treatments"] });
      toast.success("Status updated");
    },
  });

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!invoiceData) return;
      const finalAmount = invoiceData.cost - invoiceData.discount;

      // Check for existing open invoice for this patient (any non-paid, non-cancelled)
      const { data: existingInvoice } = await supabase
        .from("invoices")
        .select("id, amount, total, subtotal, discount")
        .eq("clinic_id", clinicId!)
        .eq("patient_id", id!)
        .in("status", ["draft", "pending", "unpaid", "partial"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingInvoice) {
        // Add item to existing invoice and update totals
        await supabase.from("invoice_items").insert({
          invoice_id: existingInvoice.id,
          description: invoiceData.name,
          unit_price: invoiceData.cost,
          quantity: 1,
          total: invoiceData.cost,
        });

        const newSubtotal = Number(existingInvoice.subtotal || existingInvoice.amount) + invoiceData.cost;
        const newDiscount = Number(existingInvoice.discount || 0) + invoiceData.discount;
        const newTotal = newSubtotal - newDiscount;

        await supabase.from("invoices").update({
          subtotal: newSubtotal,
          amount: newTotal,
          total: newTotal,
          discount: newDiscount,
        }).eq("id", existingInvoice.id);
      } else {
        // Create new invoice
        const today = new Date().toISOString().split("T")[0];
        const { data: inv, error: invErr } = await supabase.from("invoices").insert({
          clinic_id: clinicId!,
          patient_id: id!,
          amount: finalAmount,
          total: finalAmount,
          subtotal: invoiceData.cost,
          discount: invoiceData.discount,
          status: "pending",
          invoice_date: today,
        }).select("id").single();
        if (invErr) throw invErr;

        await supabase.from("invoice_items").insert({
          invoice_id: inv!.id,
          description: invoiceData.name,
          unit_price: invoiceData.cost,
          quantity: 1,
          total: invoiceData.cost,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-invoices"] });
      setShowInvoiceDialog(false);
      setInvoiceData(null);
      toast.success("Invoice created!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Record partial/full payment
  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!paymentInvoice || !paymentAmount) throw new Error("Missing payment data");
      const amt = Number(paymentAmount);
      if (amt <= 0) throw new Error("Amount must be positive");
      const currentBalance = Number(paymentInvoice.balance ?? (paymentInvoice.amount - (paymentInvoice.paid_amount || 0)));
      if (amt > currentBalance) throw new Error("Amount exceeds balance");

      // Insert payment record
      const { error: payErr } = await supabase.from("payments").insert({
        clinic_id: clinicId!,
        patient_id: id!,
        invoice_id: paymentInvoice.id,
        amount: amt,
        payment_method: paymentMethod,
        payment_date: new Date().toISOString().split("T")[0],
      });
      if (payErr) throw payErr;

      // Update invoice paid_amount and status
      const newPaid = (Number(paymentInvoice.paid_amount) || 0) + amt;
      const invoiceTotal = Number(paymentInvoice.amount);
      const newStatus = newPaid >= invoiceTotal ? "paid" : "partial";

      const { error: invErr } = await supabase.from("invoices").update({
        paid_amount: newPaid,
        status: newStatus,
        ...(newPaid >= invoiceTotal ? { paid_at: new Date().toISOString() } : {}),
      }).eq("id", paymentInvoice.id);
      if (invErr) throw invErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-invoices"] });
      setShowPaymentDialog(false);
      setPaymentInvoice(null);
      setPaymentAmount("");
      toast.success("Payment recorded!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return <DashboardLayout><div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading...</div></DashboardLayout>;
  }

  if (!patient) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-muted-foreground">Patient not found</p>
          <Button variant="outline" onClick={() => navigate("/patients")}>Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const isLabTreatment = LAB_TREATMENTS.some(lt => newTx.treatment_name.toLowerCase().includes(lt.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate("/patients")} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {/* Profile Header */}
        <Card className="shadow-card border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full gradient-primary text-lg font-bold text-primary-foreground">
                  {patient.full_name[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-heading text-xl font-bold">{patient.full_name}</h2>
                    {(patient as any).op_number && <Badge variant="outline" className="font-mono text-xs">{(patient as any).op_number}</Badge>}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                    {age && <span className="flex items-center gap-1"><User2 className="h-3 w-3" /> {age}y</span>}
                    {patient.gender && <span className="capitalize">{patient.gender}</span>}
                    {patient.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {patient.phone}</span>}
                    {patient.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {patient.email}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => navigate(`/dental-chart/${patient.id}`)}>
                  <Smile className="h-4 w-4 mr-1" /> Dental Chart
                </Button>
                <Button size="sm" onClick={() => navigate(`/appointments`)}>
                  <CalendarDays className="h-4 w-4 mr-1" /> Book Visit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="history">
          <TabsList>
            <TabsTrigger value="history" className="gap-1"><Clock className="h-3 w-3" /> History</TabsTrigger>
            <TabsTrigger value="medical" className="gap-1"><HeartPulse className="h-3 w-3" /> Medical</TabsTrigger>
            <TabsTrigger value="clinical" className="gap-1"><Smile className="h-3 w-3" /> Clinical</TabsTrigger>
            <TabsTrigger value="billing" className="gap-1"><IndianRupee className="h-3 w-3" /> Billing</TabsTrigger>
            <TabsTrigger value="files" className="gap-1"><FileText className="h-3 w-3" /> Files</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">Treatment Timeline</h3>
              <VisitSummaryPDF
                patient={patient}
                patientId={patient.id}
                clinic={clinic}
                treatments={treatments.map((t: any) => ({
                  tooth_number: t.tooth_records?.tooth_number,
                  treatment_name: t.treatment_name,
                  status: t.status,
                  cost: t.cost,
                }))}
                appointments={appointments}
                invoices={invoices}
              />
            </div>
            <TreatmentTimeline patientId={patient.id} />
          </TabsContent>

          <TabsContent value="medical" className="mt-4 space-y-6">
            {clinicId && <MedicalHistoryTab patientId={patient.id} clinicId={clinicId} />}
            <div className="grid gap-6 lg:grid-cols-2">
              {clinicId && <ConsentForms patientId={patient.id} clinicId={clinicId} />}
              {clinicId && <RecallReminders patientId={patient.id} clinicId={clinicId} />}
            </div>
          </TabsContent>

          {/* Clinical */}
          <TabsContent value="clinical" className="mt-4 space-y-6">
            <Card className="shadow-card border-0">
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-base font-heading">Treatments</CardTitle>
                <Button size="sm" onClick={() => setShowAddTreatment(!showAddTreatment)} variant={showAddTreatment ? "outline" : "default"}>
                  <Plus className="h-3 w-3 mr-1" />{showAddTreatment ? "Cancel" : "Add Treatment"}
                </Button>
              </CardHeader>

              {/* Add Treatment Form */}
              {showAddTreatment && (
                <CardContent className="pt-0 pb-4">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3 border border-border">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs">Tooth #</Label>
                        <Input className="h-8 text-xs" type="number" placeholder="e.g. 47"
                          value={newTx.tooth_number} onChange={e => setNewTx(f => ({ ...f, tooth_number: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Treatment</Label>
                        <Select value={newTx.treatment_name} onValueChange={v => setNewTx(f => ({ ...f, treatment_name: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {treatmentOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Cost (Rs )</Label>
                        <Input className="h-8 text-xs" type="number" placeholder="0"
                          value={newTx.cost} onChange={e => setNewTx(f => ({ ...f, cost: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Notes</Label>
                        <Input className="h-8 text-xs" placeholder="Optional notes"
                          value={newTx.notes} onChange={e => setNewTx(f => ({ ...f, notes: e.target.value }))} />
                      </div>
                    </div>

                    {/* Lab work fields - shown for Crown, Bridge, etc. */}
                    {isLabTreatment && (
                      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                        <div>
                          <Label className="text-xs text-primary">Lab Name</Label>
                          <Input className="h-8 text-xs" placeholder="e.g. Dental Lab Co."
                            value={newTx.lab_name} onChange={e => setNewTx(f => ({ ...f, lab_name: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-primary">Shade</Label>
                          <Input className="h-8 text-xs" placeholder="e.g. A2, B1"
                            value={newTx.shade} onChange={e => setNewTx(f => ({ ...f, shade: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-primary">Material</Label>
                          <Input className="h-8 text-xs" placeholder="e.g. Zirconia, PFM"
                            value={newTx.material} onChange={e => setNewTx(f => ({ ...f, material: e.target.value }))} />
                        </div>
                      </div>
                    )}

                    <Button size="sm" className="w-full" onClick={() => addTreatment.mutate()} disabled={!newTx.tooth_number || !newTx.treatment_name || addTreatment.isPending}>
                      <Plus className="h-3 w-3 mr-1" />
                      {isLabTreatment ? "Add Treatment + Lab Order" : "Add Treatment"}
                    </Button>
                  </div>
                </CardContent>
              )}

              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Treatment</TableHead>
                      <TableHead>Tooth</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!treatments.length ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No treatments yet</TableCell></TableRow>
                    ) : treatments.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.treatment_name}</TableCell>
                        <TableCell>#{t.tooth_records?.tooth_number}</TableCell>
                        <TableCell>
                          <Select value={t.status} onValueChange={v => updateTreatmentStatus.mutate({
                            treatmentId: t.id, status: v,
                            treatmentName: t.treatment_name,
                            cost: t.cost ? Number(t.cost) : 0,
                          })}>
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <Badge className={`${STATUS_COLORS[t.status] || ""} text-xs`} variant="secondary">
                                {t.status?.replace("_", " ")}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {["planned", "in_progress", "completed", "cancelled"].map(s =>
                                <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{t.cost ? `Rs ${Number(t.cost).toLocaleString()}` : "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {clinicId && <LabWorkTracker patientId={patient.id} clinicId={clinicId} />}
          </TabsContent>

          {/* Billing */}
          <TabsContent value="billing" className="mt-4 space-y-4">
            {unbilledTreatments.length > 0 && (
              <Card className="border-warning/40 bg-warning/5">
                <CardContent className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[220px]">
                    <p className="text-sm font-semibold">
                      {unbilledTreatments.length} completed treatment{unbilledTreatments.length > 1 ? "s" : ""} not yet billed
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Total: Rs {unbilledTreatments.reduce((s: number, t: any) => s + Number(t.cost || 0), 0).toLocaleString()}
                      {" · "}{unbilledTreatments.slice(0, 3).map((t: any) => `${t.treatment_name} #${t.tooth_number}`).join(", ")}
                      {unbilledTreatments.length > 3 ? ` +${unbilledTreatments.length - 3} more` : ""}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => navigate(`/billing?patient=${id}`)}>
                    <IndianRupee className="h-3.5 w-3.5 mr-1" /> Create Invoice
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card className="shadow-card border-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!invoices.length ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No invoices</TableCell></TableRow>
                    ) : invoices.map((inv: any) => {
                      const total = Number(inv.amount || 0);
                      const paid = Number(inv.paid_amount || 0);
                      const balance = total - paid;
                      const isPaid = inv.status === "paid" || balance <= 0;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="text-sm">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">Rs {total.toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{inv.discount ? `Rs ${Number(inv.discount).toLocaleString()}` : "—"}</TableCell>
                          <TableCell className="text-sm text-success font-medium">Rs {paid.toLocaleString()}</TableCell>
                          <TableCell className={`font-medium ${balance > 0 ? "text-destructive" : "text-success"}`}>
                            {balance > 0 ? `Rs ${balance.toLocaleString()}` : "Cleared"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-xs ${
                              isPaid ? "bg-success/10 text-success" : 
                              inv.status === "partial" ? "bg-warning/10 text-warning" : 
                              inv.status === "overdue" ? "bg-destructive/10 text-destructive" : ""
                            }`}>
                              {isPaid ? "paid" : inv.status === "partial" ? "partial" : inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {!isPaid && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                  onClick={() => {
                                    setPaymentInvoice(inv);
                                    setPaymentAmount(String(balance));
                                    setShowPaymentDialog(true);
                                  }}>
                                  <IndianRupee className="h-3 w-3" /> Pay
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                                onClick={() => setReceiptInvoice(inv)}
                                disabled={paid <= 0}>
                                <Printer className="h-3 w-3" /> Receipt
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Summary cards */}
            {invoices.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Billed</p>
                  <p className="text-lg font-bold">Rs {invoices.reduce((s: number, i: any) => s + Number(i.amount || 0), 0).toLocaleString()}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="text-lg font-bold text-success">Rs {invoices.reduce((s: number, i: any) => s + Number(i.paid_amount || 0), 0).toLocaleString()}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="text-lg font-bold text-destructive">Rs {invoices.reduce((s: number, i: any) => s + (Number(i.amount || 0) - Number(i.paid_amount || 0)), 0).toLocaleString()}</p>
                </CardContent></Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            {clinicId && <DocumentsTab patientId={patient.id} clinicId={clinicId} />}
          </TabsContent>
        </Tabs>


        {/* Partial Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">Record Payment</DialogTitle>
            </DialogHeader>
            {paymentInvoice && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Invoice Total</span><span className="font-medium">Rs {Number(paymentInvoice.amount).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Already Paid</span><span className="text-success">Rs {Number(paymentInvoice.paid_amount || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between border-t pt-1"><span className="font-medium">Balance Due</span><span className="font-bold text-destructive">Rs {(Number(paymentInvoice.amount) - Number(paymentInvoice.paid_amount || 0)).toLocaleString()}</span></div>
                </div>
                <div>
                  <Label className="text-xs">Payment Amount (Rs )</Label>
                  <Input type="number" className="h-9" value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["cash", "upi", "card", "bank_transfer", "cheque"].map(m =>
                        <SelectItem key={m} value={m}>{m.replace("_", " ").toUpperCase()}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={() => recordPayment.mutate()} disabled={recordPayment.isPending}>
                    {recordPayment.isPending ? "Recording..." : "Record Payment"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Receipt Dialog */}
        <Dialog open={!!receiptInvoice} onOpenChange={open => { if (!open) setReceiptInvoice(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Payment Receipt</DialogTitle></DialogHeader>
            {receiptInvoice && (
              <InvoiceReceipt
                invoice={receiptInvoice}
                clinic={clinic}
                patient={patient}
                items={receiptItems}
                payments={receiptPayments}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
