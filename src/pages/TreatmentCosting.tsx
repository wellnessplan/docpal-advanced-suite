import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, IndianRupee, TrendingUp, Upload } from "lucide-react";
import BulkImportDialog from "@/components/shared/BulkImportDialog";

const emptyForm = {
  treatment_name: "", base_price: "", material_cost: "", doctor_fee: "", lab_cost: "", other_cost: "", notes: "",
};

export default function TreatmentCosting() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: pricingsData, isLoading } = useQuery({
    queryKey: ["treatment-pricing", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase.from("treatment_pricing").select("*").eq("clinic_id", clinicId).order("treatment_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clinicId,
  });
  const pricings = Array.isArray(pricingsData) ? pricingsData : [];

  const num = (v: string) => Number(v) || 0;
  const totalCost = num(form.material_cost) + num(form.doctor_fee) + num(form.lab_cost) + num(form.other_cost);
  const profit = num(form.base_price) - totalCost;
  const margin = num(form.base_price) > 0 ? ((profit / num(form.base_price)) * 100).toFixed(1) : "0";

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        clinic_id: clinicId!,
        treatment_name: form.treatment_name,
        base_price: num(form.base_price),
        material_cost: num(form.material_cost),
        doctor_fee: num(form.doctor_fee),
        lab_cost: num(form.lab_cost),
        other_cost: num(form.other_cost),
        notes: form.notes || null,
      };
      if (editingId) {
        const { error } = await (supabase.from("treatment_pricing") as any).update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("treatment_pricing") as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treatment-pricing"] });
      closeDialog();
      toast.success(editingId ? "Pricing updated" : "Pricing added");
    },
    onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "Pricing for this treatment already exists" : e.message),
  });

  const deletePricing = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("treatment_pricing").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treatment-pricing"] });
      toast.success("Pricing removed");
    },
  });

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      treatment_name: p.treatment_name,
      base_price: String(p.base_price),
      material_cost: String(p.material_cost),
      doctor_fee: String(p.doctor_fee),
      lab_cost: String(p.lab_cost),
      other_cost: String(p.other_cost),
      notes: p.notes || "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  // Summary stats
  const avgPrice = pricings.length > 0 ? pricings.reduce((s: number, p: any) => s + Number(p.base_price), 0) / pricings.length : 0;
  const avgProfit = pricings.length > 0
    ? pricings.reduce((s: number, p: any) => s + (Number(p.base_price) - Number(p.material_cost) - Number(p.doctor_fee) - Number(p.lab_cost) - Number(p.other_cost)), 0) / pricings.length
    : 0;

  return (
    <DashboardLayout>
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Treatments Configured</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{pricings.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg. Price</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">Rs {Math.round(avgPrice).toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Avg. Profit</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">Rs {Math.round(avgProfit).toLocaleString()}</p></CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading text-2xl font-bold">Treatment Costing</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Bulk Import
          </Button>
          <Button onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Pricing
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Treatment</TableHead>
              <TableHead className="text-right">Patient Price</TableHead>
              <TableHead className="text-right">Material</TableHead>
              <TableHead className="text-right">Doctor Fee</TableHead>
              <TableHead className="text-right">Lab</TableHead>
              <TableHead className="text-right">Other</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : pricings.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No treatment pricing configured yet</TableCell></TableRow>
            ) : pricings.map((p: any) => {
              const cost = Number(p.material_cost) + Number(p.doctor_fee) + Number(p.lab_cost) + Number(p.other_cost);
              const prof = Number(p.base_price) - cost;
              const marg = Number(p.base_price) > 0 ? ((prof / Number(p.base_price)) * 100).toFixed(0) : "0";
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.treatment_name}</TableCell>
                  <TableCell className="text-right">Rs {Number(p.base_price).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">Rs {Number(p.material_cost).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">Rs {Number(p.doctor_fee).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">Rs {Number(p.lab_cost).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">Rs {Number(p.other_cost).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={prof >= 0 ? "text-primary" : "text-destructive"}>Rs {prof.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={Number(marg) >= 50 ? "default" : Number(marg) >= 20 ? "secondary" : "destructive"}>
                      {marg}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deletePricing.mutate(p.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} Treatment Pricing</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); upsert.mutate(); }} className="space-y-4">
            <div>
              <Label>Treatment Name</Label>
              <Input
                list="treatment-name-suggestions"
                value={form.treatment_name}
                onChange={e => setForm(f => ({ ...f, treatment_name: e.target.value }))}
                disabled={!!editingId}
                placeholder="Type any procedure name…"
                className="mt-1"
              />
              <datalist id="treatment-name-suggestions">
                {pricings.map((p: any) => <option key={p.id} value={p.treatment_name} />)}
              </datalist>
              <p className="text-xs text-muted-foreground mt-1">Add any custom procedure name — it appears across the app.</p>
            </div>

            <div>
              <Label>Patient Price (Rs )</Label>
              <Input type="number" min="0" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} className="mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Material Cost (Rs )</Label>
                <Input type="number" min="0" value={form.material_cost} onChange={e => setForm(f => ({ ...f, material_cost: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Doctor Fee (Rs )</Label>
                <Input type="number" min="0" value={form.doctor_fee} onChange={e => setForm(f => ({ ...f, doctor_fee: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Lab Cost (Rs )</Label>
                <Input type="number" min="0" value={form.lab_cost} onChange={e => setForm(f => ({ ...f, lab_cost: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Other Cost (Rs )</Label>
                <Input type="number" min="0" value={form.other_cost} onChange={e => setForm(f => ({ ...f, other_cost: e.target.value }))} />
              </div>
            </div>

            {/* Live profit preview */}
            <Card className="bg-muted border-0">
              <CardContent className="p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="font-medium">Rs {totalCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Profit</span>
                  <span className={`font-bold ${profit >= 0 ? "text-primary" : "text-destructive"}`}>Rs {profit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Margin</span>
                  <Badge variant={Number(margin) >= 50 ? "default" : Number(margin) >= 20 ? "secondary" : "destructive"} className="text-xs">{margin}%</Badge>
                </div>
              </CardContent>
            </Card>

            <Textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />

            <Button type="submit" className="w-full" disabled={!form.treatment_name || !form.base_price || upsert.isPending}>
              {upsert.isPending ? "Saving..." : editingId ? "Update Pricing" : "Add Pricing"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Bulk Import Treatment Pricing"
        description="Upload a CSV or paste rows from Excel. Existing treatments with the same name will be updated."
        templateFileName="treatment-pricing-template.csv"
        columns={[
          { key: "treatment_name", header: "treatment_name", required: true },
          { key: "base_price", header: "base_price", required: true, parse: (v) => Number(v) || 0 },
          { key: "material_cost", header: "material_cost", parse: (v) => Number(v) || 0 },
          { key: "doctor_fee", header: "doctor_fee", parse: (v) => Number(v) || 0 },
          { key: "lab_cost", header: "lab_cost", parse: (v) => Number(v) || 0 },
          { key: "other_cost", header: "other_cost", parse: (v) => Number(v) || 0 },
          { key: "notes", header: "notes" },
        ]}
        onImport={async (rows) => {
          if (!clinicId) throw new Error("No clinic");
          const payload = rows.map((r) => ({
            clinic_id: clinicId,
            treatment_name: String(r.treatment_name).trim(),
            base_price: r.base_price ?? 0,
            material_cost: r.material_cost ?? 0,
            doctor_fee: r.doctor_fee ?? 0,
            lab_cost: r.lab_cost ?? 0,
            other_cost: r.other_cost ?? 0,
            notes: r.notes ?? null,
          }));
          const { error } = await (supabase.from("treatment_pricing") as any).upsert(payload, {
            onConflict: "clinic_id,treatment_name",
          });
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ["treatment-pricing"] });
          queryClient.invalidateQueries({ queryKey: ["treatment-catalog"] });
          return { inserted: payload.length };
        }}
      />
    </DashboardLayout>
  );
}
