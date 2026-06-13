import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, CheckCircle2, ExternalLink, Receipt } from "lucide-react";
import { format } from "date-fns";

const STATUS_TONES: Record<string, string> = {
  paid: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  refunded: "bg-muted text-muted-foreground border-border",
};

export default function InvoicesTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["platform-invoices"],
    queryFn: async () => {
      const { data } = await (supabase.from("platform_invoices" as any) as any)
        .select("*, clinics(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.rpc as any)("mark_platform_invoice_paid", {
        p_invoice_id: id, p_provider: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-invoices"] });
      qc.invalidateQueries({ queryKey: ["platform-clinics"] });
      toast.success("Marked paid — subscription extended");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = rows.filter((r: any) => statusFilter === "all" || r.status === statusFilter);
  const totals = {
    paid: rows.filter((r: any) => r.status === "paid").reduce((a: number, r: any) => a + Number(r.amount_inr || 0), 0),
    pending: rows.filter((r: any) => r.status === "pending").reduce((a: number, r: any) => a + Number(r.amount_inr || 0), 0),
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Collected</p><p className="text-2xl font-bold mt-1">₹{totals.paid.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-bold mt-1">₹{totals.pending.toLocaleString()}</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto"><CreateInvoiceDialog onCreated={() => qc.invalidateQueries({ queryKey: ["platform-invoices"] })} /></div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" />Invoices ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No invoices yet</TableCell></TableRow>
              ) : filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.clinics?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{r.plan_code || "—"}</TableCell>
                  <TableCell>₹{Number(r.amount_inr).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_TONES[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.provider || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.receipt_url && (
                        <Button size="sm" variant="ghost" asChild className="h-8">
                          <a href={r.receipt_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                        </Button>
                      )}
                      {r.status !== "paid" && (
                        <Button size="sm" variant="outline" className="h-8 text-xs text-green-600"
                          onClick={() => markPaid.mutate(r.id)} disabled={markPaid.isPending}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Mark paid
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateInvoiceDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clinic_id: "", plan_code: "", amount_inr: "", billing_cycle: "monthly" });
  const [loading, setLoading] = useState(false);

  const { data: clinics = [] } = useQuery({
    queryKey: ["clinic-pick"],
    queryFn: async () => (await supabase.from("clinics").select("id, name").order("name")).data || [],
    enabled: open,
  });

  const submit = async () => {
    if (!form.clinic_id || !form.amount_inr) return toast.error("Clinic and amount required");
    setLoading(true);
    const { error } = await (supabase.from("platform_invoices" as any) as any).insert({
      clinic_id: form.clinic_id,
      plan_code: form.plan_code || null,
      amount_inr: Number(form.amount_inr),
      billing_cycle: form.billing_cycle,
      status: "pending",
      provider: "manual",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice created");
    setForm({ clinic_id: "", plan_code: "", amount_inr: "", billing_cycle: "monthly" });
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New invoice</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create invoice</DialogTitle><DialogDescription>Mark paid later (manually or via webhook).</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Clinic</Label>
            <Select value={form.clinic_id} onValueChange={(v) => setForm({ ...form, clinic_id: v })}>
              <SelectTrigger><SelectValue placeholder="Pick a clinic…" /></SelectTrigger>
              <SelectContent>{clinics.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Plan code</Label><Input value={form.plan_code} onChange={(e) => setForm({ ...form, plan_code: e.target.value })} placeholder="basic / pro / enterprise" /></div>
          <div><Label>Amount (INR)</Label><Input type="number" value={form.amount_inr} onChange={(e) => setForm({ ...form, amount_inr: e.target.value })} /></div>
          <div>
            <Label>Billing cycle</Label>
            <Select value={form.billing_cycle} onValueChange={(v) => setForm({ ...form, billing_cycle: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
