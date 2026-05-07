import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

export default function SuppliersTab() {
  const { clinicId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    name: "", contact_person: "", email: "", phone: "", whatsapp_number: "",
    address: "", payment_terms_days: 30, lead_time_days: 7,
    auto_send_enabled: false, preferred_channel: "whatsapp",
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", clinicId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("suppliers").select("*").eq("clinic_id", clinicId).order("name");
      return data || [];
    },
    enabled: !!clinicId,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      const { error } = await (supabase as any).from("suppliers").insert({ ...form, clinic_id: clinicId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setOpen(false);
      setForm({ name: "", contact_person: "", email: "", phone: "", whatsapp_number: "", address: "", payment_terms_days: 30, lead_time_days: 7, auto_send_enabled: false, preferred_channel: "whatsapp" });
      toast.success("Supplier added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await (supabase as any).from("suppliers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Removed"); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Suppliers</CardTitle>
          <CardDescription>Vendors used for purchase orders. Enable auto-send to skip the draft review step.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add Supplier</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add supplier</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>WhatsApp #</Label><Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="+91..." /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Payment terms (days)</Label><Input type="number" value={form.payment_terms_days} onChange={(e) => setForm({ ...form, payment_terms_days: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Lead time (days)</Label><Input type="number" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Preferred channel</Label>
                <Select value={form.preferred_channel} onValueChange={(v) => setForm({ ...form, preferred_channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded border p-2">
                <Label className="cursor-pointer">Auto-send POs</Label>
                <Switch checked={form.auto_send_enabled} onCheckedChange={(v) => setForm({ ...form, auto_send_enabled: v })} />
              </div>
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name} className="w-full">
              {save.isPending ? "Saving..." : "Add supplier"}
            </Button>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {suppliers.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.name} {s.auto_send_enabled && <span className="text-xs text-emerald-600 ml-1">· auto-send</span>}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {s.contact_person && `${s.contact_person} · `}{s.phone || s.email || "no contact"} · {s.lead_time_days}d lead
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.auto_send_enabled}
                  onCheckedChange={(v) => update.mutate({ id: s.id, patch: { auto_send_enabled: v } })}
                />
                <Button size="sm" variant="ghost" onClick={() => del.mutate(s.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {suppliers.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No suppliers yet</p>}
        </div>
      </CardContent>
    </Card>
  );
}
