import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function TpaProvidersTab() {
  const { clinicId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    name: "", contact_person: "", email: "", phone: "", address: "",
    payment_terms_days: 30, claim_form_template: "", notes: "",
  });

  const { data: tpas = [] } = useQuery({
    queryKey: ["tpa-providers", clinicId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("tpa_providers").select("*").eq("clinic_id", clinicId).order("name");
      return data || [];
    },
    enabled: !!clinicId,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      const { error } = await (supabase as any).from("tpa_providers").insert({ ...form, clinic_id: clinicId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tpa-providers"] });
      setOpen(false);
      setForm({ name: "", contact_person: "", email: "", phone: "", address: "", payment_terms_days: 30, claim_form_template: "", notes: "" });
      toast.success("TPA added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("tpa_providers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tpa-providers"] }); toast.success("Removed"); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Insurance / TPA Providers</CardTitle>
          <CardDescription>Insurers and TPAs you submit claims to. The email is used for "Submit to TPA".</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add TPA</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add TPA / Insurer</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Star Health TPA" /></div>
              <div><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="col-span-2"><Label>Claim submission email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="claims@tpa.com" /></div>
              <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Payment terms (days)</Label><Input type="number" value={form.payment_terms_days} onChange={(e) => setForm({ ...form, payment_terms_days: parseInt(e.target.value) || 0 })} /></div>
              <div className="col-span-2"><Label>Claim form template / instructions</Label><Textarea rows={3} value={form.claim_form_template} onChange={(e) => setForm({ ...form, claim_form_template: e.target.value })} placeholder="Specific cover letter text or required fields..." /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name} className="w-full">
              {save.isPending ? "Saving..." : "Add TPA"}
            </Button>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tpas.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="min-w-0">
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground truncate">{t.email || "no email"} · {t.payment_terms_days}d terms</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(t.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {tpas.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No TPAs yet</p>}
        </div>
      </CardContent>
    </Card>
  );
}
