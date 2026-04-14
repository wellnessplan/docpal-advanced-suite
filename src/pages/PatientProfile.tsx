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
  Phone, Mail, User2, HeartPulse, FileText, Clock, IndianRupee
} from "lucide-react";
import MedicalHistoryTab from "@/components/patients/MedicalHistoryTab";
import DocumentsTab from "@/components/patients/DocumentsTab";
import TreatmentTimeline from "@/components/patients/TreatmentTimeline";
import ConsentForms from "@/components/patients/ConsentForms";
import LabWorkTracker from "@/components/patients/LabWorkTracker";
import RecallReminders from "@/components/patients/RecallReminders";

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-primary/10 text-primary border-primary/30",
  in_progress: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

const COMMON_TREATMENTS = [
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
  const [showAddTreatment, setShowAddTreatment] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceData, setInvoiceData] = useState<{ treatmentId: string; name: string; cost: number; discount: number } | null>(null);
  const [newTx, setNewTx] = useState({ tooth_number: "", treatment_name: "", cost: "", notes: "", shade: "", material: "", lab_name: "" });
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

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

  // Update treatment status + auto-invoice on completion
  const updateTreatmentStatus = useMutation({
    mutationFn: async ({ treatmentId, status, treatmentName, cost }: { treatmentId: string; status: string; treatmentName: string; cost: number }) => {
      const update: any = { status: status as any };
      if (status === "completed") update.performed_at = new Date().toISOString();
      const { error } = await supabase.from("tooth_treatments").update(update).eq("id", treatmentId);
      if (error) throw error;

      // Auto-create invoice on completion
      if (status === "completed" && cost > 0) {
        setInvoiceData({ treatmentId, name: treatmentName, cost, discount: 0 });
        setShowInvoiceDialog(true);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-treatments"] });
      toast.success("Status updated!");
    },
  });

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!invoiceData) return;
      const finalAmount = invoiceData.cost - invoiceData.discount;
      const { data: inv, error: invErr } = await supabase.from("invoices").insert({
        clinic_id: clinicId!,
        patient_id: id!,
        amount: finalAmount,
        total: finalAmount,
        subtotal: invoiceData.cost,
        discount: invoiceData.discount,
        status: "pending",
        invoice_date: new Date().toISOString().split("T")[0],
      }).select("id").single();
      if (invErr) throw invErr;

      await supabase.from("invoice_items").insert({
        invoice_id: inv!.id,
        description: invoiceData.name,
        unit_price: invoiceData.cost,
        quantity: 1,
        total: invoiceData.cost,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-invoices"] });
      setShowInvoiceDialog(false);
      setInvoiceData(null);
      toast.success("Invoice created!");
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

          <TabsContent value="history" className="mt-4">
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
                            {COMMON_TREATMENTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Cost (₹)</Label>
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
                        <TableCell>{t.cost ? `₹${Number(t.cost).toLocaleString()}` : "—"}</TableCell>
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
          <TabsContent value="billing" className="mt-4">
            <Card className="shadow-card border-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!invoices.length ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No invoices</TableCell></TableRow>
                    ) : invoices.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell>{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>₹{Number(inv.subtotal || inv.amount).toLocaleString()}</TableCell>
                        <TableCell>{inv.discount ? `₹${Number(inv.discount).toLocaleString()}` : "—"}</TableCell>
                        <TableCell className="font-medium">₹{Number(inv.total || inv.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${inv.status === "paid" ? "bg-success/10 text-success" : inv.status === "overdue" ? "bg-destructive/10 text-destructive" : ""}`}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            {clinicId && <DocumentsTab patientId={patient.id} clinicId={clinicId} />}
          </TabsContent>
        </Tabs>

        {/* Invoice creation dialog on treatment completion */}
        <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">Generate Invoice</DialogTitle>
            </DialogHeader>
            {invoiceData && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Treatment <strong>{invoiceData.name}</strong> marked as completed. Create invoice?
                </p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Amount (₹)</Label>
                    <Input type="number" className="h-9" value={invoiceData.cost}
                      onChange={e => setInvoiceData(d => d ? { ...d, cost: Number(e.target.value) } : null)} />
                  </div>
                  <div>
                    <Label className="text-xs">Discount (₹)</Label>
                    <Input type="number" className="h-9" value={invoiceData.discount}
                      onChange={e => setInvoiceData(d => d ? { ...d, discount: Number(e.target.value) } : null)} />
                  </div>
                  <div className="bg-muted/50 rounded-md p-3 text-sm">
                    <span className="text-muted-foreground">Final Amount:</span>
                    <span className="font-bold ml-2">₹{((invoiceData.cost || 0) - (invoiceData.discount || 0)).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowInvoiceDialog(false); setInvoiceData(null); }}>
                    Skip
                  </Button>
                  <Button className="flex-1" onClick={() => createInvoice.mutate()} disabled={createInvoice.isPending}>
                    Create Invoice
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
