import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, FileText, IndianRupee } from "lucide-react";
import InvoiceReceipt from "@/components/billing/InvoiceReceipt";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  paid: "bg-success/10 text-success",
  partial: "bg-warning/10 text-warning",
  overdue: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
  pending: "bg-warning/10 text-warning",
};

export default function BillingPage() {
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [receiptInvoice, setReceiptInvoice] = useState<any>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [form, setForm] = useState({
    patient_id: "", due_date: "", notes: "",
    discount_amount: "0", discount_percent: "0", coupon_code: "", tax_rate: "0",
  });
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);

  const { data: patients } = useQuery({
    queryKey: ["patients-list", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await supabase.from("patients").select("id, full_name, phone, date_of_birth").eq("clinic_id", clinicId).order("full_name");
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: completedTreatments = [] } = useQuery({
    queryKey: ["completed-treatments", form.patient_id],
    queryFn: async () => {
      if (!form.patient_id) return [];
      const { data: records } = await supabase.from("tooth_records")
        .select("id, tooth_number").eq("patient_id", form.patient_id);
      if (!records?.length) return [];
      const { data: treatments } = await supabase.from("tooth_treatments")
        .select("*")
        .in("tooth_record_id", records.map(r => r.id))
        .eq("status", "completed" as any)
        .order("performed_at", { ascending: false });
      const toothMap = Object.fromEntries(records.map(r => [r.id, r.tooth_number]));
      return (treatments ?? []).map(t => ({
        ...t,
        tooth_number: toothMap[t.tooth_record_id],
      }));
    },
    enabled: !!form.patient_id,
  });

  useEffect(() => { setSelectedTreatments([]); }, [form.patient_id]);

  // Look up coupon by code (live as user types)
  const { data: coupon } = useQuery({
    queryKey: ["coupon-lookup", clinicId, form.coupon_code.trim().toUpperCase()],
    queryFn: async () => {
      const code = form.coupon_code.trim().toUpperCase();
      if (!clinicId || !code) return null;
      const { data } = await supabase
        .from("discount_coupons")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (!data) return null;
      const today = new Date().toISOString().slice(0, 10);
      if (data.valid_from && data.valid_from > today) return { ...data, _invalid: "Not yet valid" };
      if (data.valid_until && data.valid_until < today) return { ...data, _invalid: "Expired" };
      if (data.max_uses && data.used_count >= data.max_uses) return { ...data, _invalid: "Usage limit reached" };
      return data;
    },
    enabled: !!clinicId && !!form.coupon_code.trim(),
  });

  const subtotal = selectedTreatments.reduce((sum, id) => {
    const t = completedTreatments.find((ct: any) => ct.id === id);
    return sum + (t ? Number(t.cost || 0) : 0);
  }, 0);
  const discountAmt = Number(form.discount_amount) || 0;
  const discountPct = Number(form.discount_percent) || 0;
  const couponDiscount = coupon && !(coupon as any)._invalid
    ? (coupon.discount_type === "percent"
        ? (subtotal * Number(coupon.discount_value) / 100)
        : Number(coupon.discount_value))
    : 0;
  const discountTotal = discountAmt + (subtotal * discountPct / 100) + couponDiscount;
  const afterDiscount = Math.max(0, subtotal - discountTotal);
  const taxRate = Number(form.tax_rate) || 0;
  const taxAmount = afterDiscount * taxRate / 100;
  const finalAmount = afterDiscount + taxAmount;

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await supabase.from("invoices")
        .select("*, patients(full_name, phone, date_of_birth)")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: clinic } = useQuery({
    queryKey: ["clinic", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("*").eq("id", clinicId!).single();
      return data;
    },
    enabled: !!clinicId,
  });

  const { data: invoiceItems = [] } = useQuery({
    queryKey: ["invoice-items", receiptInvoice?.id],
    queryFn: async () => {
      if (!receiptInvoice?.id) return [];
      const { data } = await supabase.from("invoice_items").select("*").eq("invoice_id", receiptInvoice.id);
      return data ?? [];
    },
    enabled: !!receiptInvoice?.id,
  });

  const { data: invoicePayments = [] } = useQuery({
    queryKey: ["invoice-payments", receiptInvoice?.id],
    queryFn: async () => {
      if (!receiptInvoice?.id) return [];
      const { data } = await supabase.from("payments").select("*").eq("invoice_id", receiptInvoice.id).order("payment_date");
      return data ?? [];
    },
    enabled: !!receiptInvoice?.id,
  });

  const addInvoice = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      if (!selectedTreatments.length && !subtotal) throw new Error("Select at least one treatment");

      const { data: inv, error } = await supabase.from("invoices").insert({
        clinic_id: clinicId,
        patient_id: form.patient_id,
        amount: finalAmount,
        total: finalAmount,
        subtotal: subtotal,
        discount: discountAmt,
        discount_percent: discountPct,
        coupon_code: form.coupon_code || null,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        due_date: form.due_date || null,
        notes: form.notes || null,
        status: "draft",
      }).select("id").single();
      if (error) throw error;

      if (selectedTreatments.length && inv) {
        const items = selectedTreatments.map(tId => {
          const t = completedTreatments.find((ct: any) => ct.id === tId);
          return {
            invoice_id: inv.id,
            description: `${t?.treatment_name} (Tooth #${t?.tooth_number})`,
            quantity: 1,
            unit_price: Number(t?.cost || 0),
          };
        });
        await supabase.from("invoice_items").insert(items);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      setForm({ patient_id: "", due_date: "", notes: "", discount_amount: "0", discount_percent: "0", coupon_code: "", tax_rate: "0" });
      setSelectedTreatments([]);
      toast.success("Invoice created!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!paymentInvoice || !paymentAmount) throw new Error("Missing payment data");
      const amt = Number(paymentAmount);
      if (amt <= 0) throw new Error("Amount must be positive");
      const currentPaid = Number(paymentInvoice.paid_amount || 0);
      const total = Number(paymentInvoice.amount);
      const currentBalance = total - currentPaid;
      if (amt > currentBalance) throw new Error("Amount exceeds balance");

      const { error: payErr } = await supabase.from("payments").insert({
        clinic_id: clinicId!,
        patient_id: paymentInvoice.patient_id,
        invoice_id: paymentInvoice.id,
        amount: amt,
        payment_method: paymentMethod,
        payment_date: new Date().toISOString().split("T")[0],
      });
      if (payErr) throw payErr;

      const newPaid = currentPaid + amt;
      const newStatus = newPaid >= total ? "paid" : "partial";
      const { error: invErr } = await supabase.from("invoices").update({
        paid_amount: newPaid,
        status: newStatus,
        ...(newPaid >= total ? { paid_at: new Date().toISOString() } : {}),
      }).eq("id", paymentInvoice.id);
      if (invErr) throw invErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setShowPaymentDialog(false);
      setPaymentInvoice(null);
      setPaymentAmount("");
      toast.success("Payment recorded!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totalPending = invoices?.filter(i => !["paid", "cancelled"].includes(i.status || "")).reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount || 0)), 0) ?? 0;
  const totalPaid = invoices?.reduce((s, i) => s + Number(i.paid_amount || 0), 0) ?? 0;

  const selectedPatient = patients?.find(p => p.id === form.patient_id);
  const patientAge = selectedPatient?.date_of_birth
    ? Math.floor((Date.now() - new Date(selectedPatient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Billing</h1>
            <p className="text-muted-foreground">Track invoices and payments</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Invoice</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); addInvoice.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Patient *</Label>
                  <Select value={form.patient_id} onValueChange={v => setForm(f => ({ ...f, patient_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent>
                      {patients?.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPatient && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                    <p><strong>Patient:</strong> {selectedPatient.full_name}</p>
                    {patientAge && <p><strong>Age:</strong> {patientAge} years</p>}
                    {selectedPatient.phone && <p><strong>Mobile:</strong> {selectedPatient.phone}</p>}
                  </div>
                )}

                {form.patient_id && completedTreatments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Completed Treatments</Label>
                    <div className="border rounded-md max-h-[200px] overflow-y-auto">
                      {completedTreatments.map((t: any) => (
                        <label key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0">
                          <Checkbox
                            checked={selectedTreatments.includes(t.id)}
                            onCheckedChange={(checked) => {
                              setSelectedTreatments(prev =>
                                checked ? [...prev, t.id] : prev.filter(id => id !== t.id)
                              );
                            }}
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium">{t.treatment_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">Tooth #{t.tooth_number}</span>
                          </div>
                          <span className="text-sm font-medium">Rs {Number(t.cost || 0).toLocaleString()}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {form.patient_id && !completedTreatments.length && (
                  <p className="text-xs text-muted-foreground">No completed treatments to invoice.</p>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Discount (Rs )</Label>
                    <Input type="number" step="0.01" value={form.discount_amount} onChange={e => setForm(f => ({ ...f, discount_amount: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Discount (%)</Label>
                    <Input type="number" step="0.01" max="100" value={form.discount_percent} onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tax (%)</Label>
                    <Input type="number" step="0.01" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Coupon Code</Label>
                    <Input placeholder="e.g. SMILE10" value={form.coupon_code} onChange={e => setForm(f => ({ ...f, coupon_code: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Due Date</Label>
                    <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                  </div>
                </div>

                {selectedTreatments.length > 0 && (
                  <div className="rounded-md border p-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><span>Rs {subtotal.toLocaleString()}</span></div>
                    {discountTotal > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>-Rs {discountTotal.toLocaleString()}</span></div>}
                    {taxAmount > 0 && <div className="flex justify-between"><span>Tax ({taxRate}%)</span><span>Rs {taxAmount.toLocaleString()}</span></div>}
                    <div className="flex justify-between font-bold border-t pt-1"><span>Total Payable</span><span>Rs {finalAmount.toLocaleString()}</span></div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                <Button type="submit" className="w-full" disabled={addInvoice.isPending || !form.patient_id || !selectedTreatments.length}>
                  {addInvoice.isPending ? "Creating..." : `Create Invoice · Rs ${finalAmount.toLocaleString()}`}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="shadow-card border-0">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Balance Due</p>
              <p className="mt-1 text-2xl font-bold font-heading text-warning">Rs {totalPending.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Collected</p>
              <p className="mt-1 text-2xl font-bold font-heading text-success">Rs {totalPaid.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card border-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !invoices?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No invoices yet</TableCell></TableRow>
                ) : invoices.map((inv: any) => {
                  const total = Number(inv.amount || 0);
                  const paid = Number(inv.paid_amount || 0);
                  const balance = total - paid;
                  const isPaid = balance <= 0;
                  const discount = Number(inv.discount || 0) + (Number(inv.subtotal || 0) * Number(inv.discount_percent || 0) / 100);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{inv.patients?.full_name}</span>
                          {inv.patients?.phone && <p className="text-xs text-muted-foreground">{inv.patients.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">Rs {total.toLocaleString()}</TableCell>
                      <TableCell className="text-success font-medium">Rs {paid.toLocaleString()}</TableCell>
                      <TableCell className={`font-medium ${balance > 0 ? "text-destructive" : "text-success"}`}>
                        {isPaid ? "Cleared" : `Rs ${balance.toLocaleString()}`}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {discount > 0 ? `Rs ${discount.toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[inv.status] || ""} variant="secondary">
                          {isPaid ? "paid" : inv.status}
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
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                            onClick={() => setReceiptInvoice(inv)}
                            disabled={paid <= 0}>
                            <FileText className="h-3 w-3" /> Receipt
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

        {/* Receipt Dialog */}
        <Dialog open={!!receiptInvoice} onOpenChange={open => { if (!open) setReceiptInvoice(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Payment Receipt</DialogTitle></DialogHeader>
            {receiptInvoice && (
              <InvoiceReceipt
                invoice={receiptInvoice}
                clinic={clinic}
                patient={receiptInvoice.patients}
                items={invoiceItems}
                payments={invoicePayments}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
            {paymentInvoice && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Invoice Total</span><span className="font-medium">Rs {Number(paymentInvoice.amount).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Already Paid</span><span className="text-success">Rs {Number(paymentInvoice.paid_amount || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between border-t pt-1"><span className="font-medium">Balance Due</span><span className="font-bold text-destructive">Rs {(Number(paymentInvoice.amount) - Number(paymentInvoice.paid_amount || 0)).toLocaleString()}</span></div>
                </div>
                <div>
                  <Label className="text-xs">Payment Amount (Rs )</Label>
                  <Input type="number" className="h-9" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
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
      </div>
    </DashboardLayout>
  );
}
