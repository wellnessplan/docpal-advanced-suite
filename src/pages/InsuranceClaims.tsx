import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ShieldCheck, Search, FileDown, Send, Check, X, History as HistoryIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import jsPDF from "jspdf";

const STATUS_FLOW = [
  { key: "draft", label: "Draft", color: "bg-muted text-muted-foreground" },
  { key: "pre_auth_pending", label: "Pre-Auth Pending", color: "bg-yellow-100 text-yellow-700" },
  { key: "pre_auth_approved", label: "Pre-Auth Approved", color: "bg-amber-100 text-amber-700" },
  { key: "submitted", label: "Submitted", color: "bg-blue-100 text-blue-700" },
  { key: "under_review", label: "Under Review", color: "bg-indigo-100 text-indigo-700" },
  { key: "approved", label: "Approved", color: "bg-green-100 text-green-700" },
  { key: "partially_approved", label: "Partially Approved", color: "bg-lime-100 text-lime-700" },
  { key: "paid", label: "Paid", color: "bg-emerald-100 text-emerald-700" },
  { key: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
];

const statusBadge = (s: string) => STATUS_FLOW.find((x) => x.key === s) || { label: s, color: "bg-muted" };

export default function InsuranceClaims() {
  const { clinicId, user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [drawer, setDrawer] = useState<any>(null);

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["insurance-claims", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("insurance_claims")
        .select("*, patients(full_name, phone, age, gender)")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicId,
  });

  const { data: tpas = [] } = useQuery({
    queryKey: ["tpa-providers", clinicId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("tpa_providers").select("*").eq("clinic_id", clinicId).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!clinicId,
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-min", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("id, full_name, phone").eq("clinic_id", clinicId!).order("full_name").limit(1000);
      return data || [];
    },
    enabled: !!clinicId,
  });

  const filtered = claims.filter((c: any) => {
    const matchSearch = !search || c.patients?.full_name?.toLowerCase().includes(search.toLowerCase()) || c.claim_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = STATUS_FLOW.reduce((acc, s) => { acc[s.key] = claims.filter((c: any) => c.status === s.key).length; return acc; }, {} as any);
  const totalApproved = claims.reduce((s: number, c: any) => s + (Number(c.approved_amount) || 0), 0);
  const totalPaid = claims.reduce((s: number, c: any) => s + (Number(c.paid_amount) || 0), 0);
  const outstanding = totalApproved - totalPaid;

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Insurance & Claims</h1>
            <p className="text-muted-foreground text-sm">{claims.length} claims tracked</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New Claim
          </Button>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <KPI label="Pending Pre-Auth" value={counts["pre_auth_pending"] || 0} color="text-yellow-600" />
          <KPI label="Submitted" value={(counts["submitted"] || 0) + (counts["under_review"] || 0)} color="text-blue-600" />
          <KPI label="Approved (Rs)" value={`₹${(totalApproved / 1000).toFixed(1)}k`} color="text-green-600" />
          <KPI label="Outstanding (Rs)" value={`₹${(outstanding / 1000).toFixed(1)}k`} color="text-amber-600" />
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search claims..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_FLOW.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No claims yet</h3>
              <p className="text-muted-foreground text-sm mt-1">Click "New Claim" to start a TPA submission</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((c: any) => {
              const s = statusBadge(c.status);
              return (
                <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDrawer(c)}>
                  <CardContent className="flex items-center gap-4 py-3 px-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{c.patients?.full_name || "Unknown patient"}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.claim_number || "No #"} · {c.policy_number || "no policy"} · {format(new Date(c.created_at), "dd MMM")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">₹{(c.claim_amount || 0).toLocaleString()}</p>
                      <Badge className={s.color} variant="secondary">{s.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* New claim */}
      <NewClaimDialog open={newOpen} onClose={() => setNewOpen(false)} clinicId={clinicId} userId={user?.id} patients={patients} tpas={tpas} onCreated={() => qc.invalidateQueries({ queryKey: ["insurance-claims"] })} />

      {/* Claim detail drawer */}
      <ClaimDrawer claim={drawer} onClose={() => setDrawer(null)} clinicId={clinicId} userId={user?.id} tpas={tpas} onChange={() => qc.invalidateQueries({ queryKey: ["insurance-claims"] })} />
    </DashboardLayout>
  );
}

function KPI({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function NewClaimDialog({ open, onClose, clinicId, userId, patients, tpas, onCreated }: any) {
  const [form, setForm] = useState<any>({
    patient_id: "", tpa_id: "", policy_number: "", member_id: "",
    claim_amount: 0, pre_auth_required: false, treatment_summary: "", notes: "",
  });

  const create = async () => {
    if (!form.patient_id || !form.claim_amount) return toast.error("Patient and amount required");
    const status = form.pre_auth_required ? "pre_auth_pending" : "draft";
    const { error } = await (supabase as any).from("insurance_claims").insert({
      ...form,
      clinic_id: clinicId,
      created_by: userId,
      status,
    });
    if (error) return toast.error(error.message);
    toast.success("Claim created");
    onCreated();
    onClose();
    setForm({ patient_id: "", tpa_id: "", policy_number: "", member_id: "", claim_amount: 0, pre_auth_required: false, treatment_summary: "", notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New insurance claim</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Patient *</Label>
            <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>TPA / Insurer</Label>
            <Select value={form.tpa_id} onValueChange={(v) => setForm({ ...form, tpa_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select TPA (configure in Settings)" /></SelectTrigger>
              <SelectContent>
                {tpas.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                {tpas.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No TPAs configured. Add in Settings → TPAs.</div>}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Policy number</Label><Input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} /></div>
          <div><Label>Member ID</Label><Input value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} /></div>
          <div><Label>Claim amount (₹) *</Label><Input type="number" value={form.claim_amount} onChange={(e) => setForm({ ...form, claim_amount: parseFloat(e.target.value) || 0 })} /></div>
          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" id="preauth" checked={form.pre_auth_required} onChange={(e) => setForm({ ...form, pre_auth_required: e.target.checked })} />
            <Label htmlFor="preauth" className="cursor-pointer">Pre-auth required</Label>
          </div>
          <div className="col-span-2"><Label>Treatment summary</Label><Textarea rows={3} value={form.treatment_summary} onChange={(e) => setForm({ ...form, treatment_summary: e.target.value })} /></div>
          <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <Button onClick={create} className="w-full">Create claim</Button>
      </DialogContent>
    </Dialog>
  );
}

function ClaimDrawer({ claim, onClose, clinicId, userId, tpas, onChange }: any) {
  const qc = useQueryClient();
  const { data: history = [] } = useQuery({
    queryKey: ["claim-history", claim?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("insurance_claim_history").select("*").eq("claim_id", claim.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!claim?.id,
  });

  if (!claim) return null;
  const tpa = tpas.find((t: any) => t.id === claim.tpa_id);

  const setStatus = async (newStatus: string, extra: any = {}) => {
    const updates: any = { status: newStatus, ...extra };
    if (newStatus === "submitted") updates.submitted_at = new Date().toISOString();
    if (newStatus === "approved" || newStatus === "partially_approved") updates.approved_at = new Date().toISOString();
    if (newStatus === "paid") updates.paid_at = new Date().toISOString();

    const { error } = await (supabase as any).from("insurance_claims").update(updates).eq("id", claim.id);
    if (error) return toast.error(error.message);

    await (supabase as any).from("insurance_claim_history").insert({
      claim_id: claim.id, clinic_id: clinicId, action: "status_change",
      from_status: claim.status, to_status: newStatus, actor_user_id: userId,
    });
    toast.success(`Marked ${newStatus.replace(/_/g, " ")}`);
    onChange();
    qc.invalidateQueries({ queryKey: ["claim-history"] });
    onClose();
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("INSURANCE CLAIM FORM", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Claim #: ${claim.claim_number || "—"}`, 14, 35);
    doc.text(`Date: ${format(new Date(), "dd MMM yyyy")}`, 14, 42);
    doc.text(`TPA: ${tpa?.name || "—"}`, 14, 49);
    doc.line(14, 54, 196, 54);
    doc.setFontSize(12); doc.text("Patient", 14, 62);
    doc.setFontSize(10);
    doc.text(`Name: ${claim.patients?.full_name || ""}`, 14, 70);
    doc.text(`Age/Sex: ${claim.patients?.age || ""}/${claim.patients?.gender || ""}`, 14, 77);
    doc.text(`Phone: ${claim.patients?.phone || ""}`, 14, 84);
    doc.text(`Policy #: ${claim.policy_number || ""}`, 110, 70);
    doc.text(`Member ID: ${claim.member_id || ""}`, 110, 77);
    doc.line(14, 92, 196, 92);
    doc.setFontSize(12); doc.text("Treatment Details", 14, 100);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(claim.treatment_summary || "—", 180);
    doc.text(lines, 14, 108);
    doc.setFontSize(12); doc.text("Amount Claimed", 14, 150);
    doc.setFontSize(11); doc.text(`₹ ${(claim.claim_amount || 0).toLocaleString()}`, 14, 158);
    doc.setFontSize(8); doc.text("I hereby declare that the information provided is true to the best of my knowledge.", 14, 240);
    doc.text("__________________________", 130, 260); doc.text("Doctor's Signature", 140, 266);
    if (tpa?.claim_form_template) {
      doc.setFontSize(7);
      doc.text(doc.splitTextToSize(tpa.claim_form_template, 180), 14, 200);
    }
    doc.save(`claim-${claim.claim_number || claim.id.slice(0, 8)}.pdf`);
    toast.success("Claim PDF downloaded");
  };

  const submitToTpa = async () => {
    if (!tpa?.email) return toast.error("TPA email not configured. Add it in Settings → TPAs.");
    // Mark as submitted; in production this would call an edge function with email attachment
    await setStatus("submitted");
    toast.info(`Claim PDF generated. Email manually to ${tpa.email} or set up email infrastructure for auto-send.`);
    generatePDF();
  };

  const s = statusBadge(claim.status);

  return (
    <Sheet open={!!claim} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {claim.claim_number || "Claim"}
            <Badge className={s.color} variant="secondary">{s.label}</Badge>
          </SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            <TabsTrigger value="actions" className="flex-1">Actions</TabsTrigger>
            <TabsTrigger value="history" className="flex-1"><HistoryIcon className="h-3 w-3 mr-1" />History</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-3 mt-3">
            <Field label="Patient" value={claim.patients?.full_name} />
            <Field label="TPA" value={tpa?.name || "—"} />
            <Field label="Policy #" value={claim.policy_number} />
            <Field label="Member ID" value={claim.member_id} />
            <Field label="Claim Amount" value={`₹${(claim.claim_amount || 0).toLocaleString()}`} />
            <Field label="Approved" value={claim.approved_amount ? `₹${claim.approved_amount.toLocaleString()}` : "—"} />
            <Field label="Paid" value={claim.paid_amount ? `₹${claim.paid_amount.toLocaleString()}` : "—"} />
            <Field label="Treatment" value={claim.treatment_summary} multiline />
            {claim.rejection_reason && <Field label="Rejection reason" value={claim.rejection_reason} multiline />}
          </TabsContent>

          <TabsContent value="actions" className="space-y-2 mt-3">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={generatePDF}>
              <FileDown className="h-4 w-4" /> Generate Claim PDF
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={submitToTpa} disabled={!tpa}>
              <Send className="h-4 w-4" /> Submit to TPA {tpa?.email ? `(${tpa.email})` : ""}
            </Button>
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Update status</p>
              {claim.status === "draft" && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => setStatus("submitted")}>Mark submitted</Button>
              )}
              {(claim.status === "submitted" || claim.status === "under_review") && (
                <>
                  <ApprovalActions claim={claim} onSubmit={setStatus} />
                  <Button size="sm" variant="outline" className="w-full text-red-600" onClick={async () => {
                    const reason = prompt("Rejection reason?"); if (!reason) return;
                    await setStatus("rejected", { rejection_reason: reason });
                  }}>
                    <X className="h-3 w-3 mr-1" /> Mark rejected
                  </Button>
                </>
              )}
              {(claim.status === "approved" || claim.status === "partially_approved") && (
                <PaymentRecord claim={claim} onSubmit={setStatus} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-3 space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No history yet</p>
            ) : history.map((h: any) => (
              <div key={h.id} className="text-xs border-l-2 border-primary pl-3 py-1">
                <p className="font-medium">{h.from_status || "—"} → {h.to_status}</p>
                <p className="text-muted-foreground">{format(new Date(h.created_at), "dd MMM yyyy HH:mm")}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, multiline }: any) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm ${multiline ? "whitespace-pre-wrap" : ""}`}>{value || "—"}</p>
    </div>
  );
}

function ApprovalActions({ claim, onSubmit }: any) {
  const [amt, setAmt] = useState(claim.claim_amount || 0);
  return (
    <div className="space-y-2">
      <Label className="text-xs">Approved amount (₹)</Label>
      <Input type="number" value={amt} onChange={(e) => setAmt(parseFloat(e.target.value) || 0)} />
      <Button size="sm" className="w-full" onClick={() => {
        const status = amt < (claim.claim_amount || 0) ? "partially_approved" : "approved";
        onSubmit(status, { approved_amount: amt });
      }}>
        <Check className="h-3 w-3 mr-1" /> Approve
      </Button>
    </div>
  );
}

function PaymentRecord({ claim, onSubmit }: any) {
  const [amt, setAmt] = useState(claim.approved_amount || claim.claim_amount || 0);
  return (
    <div className="space-y-2">
      <Label className="text-xs">Paid amount (₹)</Label>
      <Input type="number" value={amt} onChange={(e) => setAmt(parseFloat(e.target.value) || 0)} />
      <Button size="sm" className="w-full" onClick={() => onSubmit("paid", { paid_amount: amt })}>
        <Check className="h-3 w-3 mr-1" /> Mark paid
      </Button>
    </div>
  );
}
