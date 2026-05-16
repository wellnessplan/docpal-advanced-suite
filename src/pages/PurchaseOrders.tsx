import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ShoppingCart, Send, PackageCheck, Sparkles, X, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { loadJsPdf } from "@/lib/pdf-loader";

const STATUS = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700" },
  partially_received: { label: "Partial", color: "bg-yellow-100 text-yellow-700" },
  received: { label: "Received", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700" },
};

export default function PurchaseOrders() {
  const { clinicId, user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [drawer, setDrawer] = useState<any>(null);

  const { data: pos = [] } = useQuery({
    queryKey: ["purchase-orders", clinicId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("purchase_orders")
        .select("*, suppliers(name, email, whatsapp_number, preferred_channel)")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicId,
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("generate_draft_pos_from_low_stock");
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      const n = d?.pos_created || 0;
      toast.success(n === 0 ? "All stocked items have suppliers covered" : `${n} draft PO${n > 1 ? "s" : ""} created`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = statusFilter === "all" ? pos : pos.filter((p: any) => p.status === statusFilter);
  const counts = Object.keys(STATUS).reduce((acc: any, k) => { acc[k] = pos.filter((p: any) => p.status === k).length; return acc; }, {});

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Purchase Orders</h1>
            <p className="text-muted-foreground text-sm">{pos.length} POs · {counts.draft || 0} drafts awaiting send</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => generate.mutate()} disabled={generate.isPending}>
              <Sparkles className="h-3.5 w-3.5" /> {generate.isPending ? "Generating..." : "Generate from low stock"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {(["draft", "sent", "partially_received", "received", "cancelled"] as const).map((k) => (
            <Card key={k} className="cursor-pointer" onClick={() => setStatusFilter(k)}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{STATUS[k].label}</p>
                <p className="text-2xl font-bold">{counts[k] || 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No purchase orders</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-md">
                Set <strong>preferred supplier</strong> on inventory items, then click "Generate from low stock" to auto-create draft POs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setDrawer(p)}>
                    <TableCell className="font-mono">{p.po_number}</TableCell>
                    <TableCell>{p.suppliers?.name || "—"}</TableCell>
                    <TableCell><Badge className={STATUS[p.status as keyof typeof STATUS]?.color} variant="secondary">{STATUS[p.status as keyof typeof STATUS]?.label || p.status}</Badge></TableCell>
                    <TableCell className="text-right font-medium">₹{(p.total_amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(p.created_at), "dd MMM HH:mm")}</TableCell>
                    <TableCell>{p.auto_generated && <Badge variant="outline" className="text-xs">Auto</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <PoDrawer po={drawer} onClose={() => setDrawer(null)} clinicId={clinicId} userId={user?.id} onChange={() => qc.invalidateQueries({ queryKey: ["purchase-orders"] })} />
    </DashboardLayout>
  );
}

function PoDrawer({ po, onClose, clinicId, userId, onChange }: any) {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["po-items", po?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("purchase_order_items").select("*").eq("po_id", po.id);
      return data || [];
    },
    enabled: !!po?.id,
  });

  if (!po) return null;
  const s = STATUS[po.status as keyof typeof STATUS] || { label: po.status, color: "" };

  const generatePdf = async () => {
    const JsPDF = await loadJsPdf();
    const doc = new JsPDF();
    doc.setFontSize(16); doc.text("PURCHASE ORDER", 105, 18, { align: "center" });
    doc.setFontSize(11); doc.text(po.po_number, 105, 26, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Supplier: ${po.suppliers?.name || ""}`, 14, 40);
    doc.text(`Date: ${format(new Date(po.created_at), "dd MMM yyyy")}`, 140, 40);
    doc.line(14, 46, 196, 46);
    doc.text("Item", 14, 54); doc.text("Qty", 110, 54); doc.text("Rate", 140, 54); doc.text("Total", 175, 54);
    doc.line(14, 56, 196, 56);
    let y = 64;
    items.forEach((it: any) => {
      doc.text(String(it.item_name).slice(0, 50), 14, y);
      doc.text(String(it.quantity), 110, y);
      doc.text(`₹${it.unit_cost}`, 140, y);
      doc.text(`₹${it.line_total}`, 175, y);
      y += 7;
    });
    doc.line(14, y, 196, y); y += 8;
    doc.setFontSize(11); doc.text(`Total: ₹${(po.total_amount || 0).toLocaleString()}`, 175, y, { align: "right" });
    doc.save(`${po.po_number}.pdf`);
  };

  const sendPo = async (channel: "whatsapp" | "email") => {
    if (channel === "whatsapp") {
      const num = po.suppliers?.whatsapp_number;
      if (!num) return toast.error("No WhatsApp number for this supplier");
      const msg = `*PO ${po.po_number}*\n\n${items.map((i: any) => `• ${i.item_name} — ${i.quantity} × ₹${i.unit_cost}`).join("\n")}\n\n*Total: ₹${(po.total_amount || 0).toLocaleString()}*`;
      window.open(`https://wa.me/${num.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
    } else {
      const email = po.suppliers?.email;
      if (!email) return toast.error("No email for this supplier");
      generatePdf();
      window.location.href = `mailto:${email}?subject=Purchase Order ${po.po_number}&body=Please find attached PO ${po.po_number}. Total: Rs ${(po.total_amount || 0).toLocaleString()}.`;
    }
    await (supabase as any).from("purchase_orders").update({ status: "sent", sent_at: new Date().toISOString(), sent_via: channel }).eq("id", po.id);
    toast.success(`PO sent via ${channel}`);
    onChange();
    onClose();
  };

  const receive = async () => {
    if (!confirm("Mark received? This will restock all items.")) return;
    const { error } = await (supabase as any).rpc("receive_purchase_order", { p_po_id: po.id });
    if (error) return toast.error(error.message);
    toast.success("Received & restocked");
    onChange();
    onClose();
  };

  const cancel = async () => {
    if (!confirm("Cancel this PO?")) return;
    await (supabase as any).from("purchase_orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", po.id);
    toast.success("Cancelled"); onChange(); onClose();
  };

  return (
    <Sheet open={!!po} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-mono">
            {po.po_number} <Badge className={s.color} variant="secondary">{s.label}</Badge>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Supplier</span><span className="font-medium">{po.suppliers?.name || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span><span className="font-bold">₹{(po.total_amount || 0).toLocaleString()}</span>
          </div>
          {po.notes && <p className="text-xs text-muted-foreground italic">{po.notes}</p>}

          <div className="border rounded-md">
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map((it: any) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.item_name}</TableCell>
                    <TableCell className="text-right">{it.quantity}</TableCell>
                    <TableCell className="text-right">₹{it.unit_cost}</TableCell>
                    <TableCell className="text-right">₹{it.line_total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="border-t pt-3 space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={generatePdf}>
              <ShoppingCart className="h-4 w-4" /> Download PO PDF
            </Button>
            {po.status === "draft" && (
              <>
                <Button className="w-full justify-start gap-2" onClick={() => sendPo("whatsapp")}>
                  <Send className="h-4 w-4" /> Send via WhatsApp
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => sendPo("email")}>
                  <Send className="h-4 w-4" /> Send via Email
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2 text-destructive" onClick={cancel}>
                  <X className="h-4 w-4" /> Cancel PO
                </Button>
              </>
            )}
            {(po.status === "sent" || po.status === "partially_received") && (
              <Button className="w-full justify-start gap-2" onClick={receive}>
                <PackageCheck className="h-4 w-4" /> Mark received & restock
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
