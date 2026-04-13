import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Save, FlaskConical, Phone, MessageCircle, Loader2 } from "lucide-react";

export default function LabDirectoryTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    lab_name: "", contact_person: "", phone: "", whatsapp: "",
    speciality: "", default_tat_days: "7", default_cost: "", notes: "",
  });

  const { data: labs = [], isLoading } = useQuery({
    queryKey: ["lab-directory", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("lab_directory").select("*")
        .eq("clinic_id", clinicId).order("lab_name");
      return data ?? [];
    },
  });

  const addLab = useMutation({
    mutationFn: async () => {
      if (!form.lab_name.trim()) throw new Error("Lab name is required");
      const { error } = await supabase.from("lab_directory").insert({
        clinic_id: clinicId,
        lab_name: form.lab_name.trim(),
        contact_person: form.contact_person || null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        speciality: form.speciality || null,
        default_tat_days: form.default_tat_days ? Number(form.default_tat_days) : 7,
        default_cost: form.default_cost ? Number(form.default_cost) : 0,
        notes: form.notes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-directory"] });
      setShowAdd(false);
      setForm({ lab_name: "", contact_person: "", phone: "", whatsapp: "", speciality: "", default_tat_days: "7", default_cost: "", notes: "" });
      toast.success("Lab added to directory");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLab = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lab_directory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-directory"] });
      toast.success("Lab removed");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" /> Lab Directory
          </h3>
          <p className="text-xs text-muted-foreground">Manage your dental lab partners</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Lab</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Lab to Directory</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label>Lab Name *</Label>
                <Input value={form.lab_name} onChange={e => setForm(f => ({ ...f, lab_name: e.target.value }))} placeholder="e.g. Dental Craft Lab" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Contact Person</Label>
                  <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Speciality</Label>
                  <Input value={form.speciality} onChange={e => setForm(f => ({ ...f, speciality: e.target.value }))} placeholder="e.g. Zirconia, PFM" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Default TAT (days)</Label>
                  <Input type="number" value={form.default_tat_days} onChange={e => setForm(f => ({ ...f, default_tat_days: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Default Cost (₹)</Label>
                  <Input type="number" value={form.default_cost} onChange={e => setForm(f => ({ ...f, default_cost: e.target.value }))} />
                </div>
              </div>
              <Button className="w-full" onClick={() => addLab.mutate()} disabled={addLab.isPending || !form.lab_name.trim()}>
                <Save className="h-4 w-4 mr-2" />{addLab.isPending ? "Adding..." : "Add Lab"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card border-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lab Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Speciality</TableHead>
                <TableHead>TAT</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : !labs.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No labs in directory yet</TableCell></TableRow>
              ) : labs.map((lab: any) => (
                <TableRow key={lab.id}>
                  <TableCell className="font-medium">{lab.lab_name}</TableCell>
                  <TableCell>
                    <div className="text-xs">
                      {lab.contact_person && <p>{lab.contact_person}</p>}
                      {lab.phone && <p className="text-muted-foreground">{lab.phone}</p>}
                    </div>
                  </TableCell>
                  <TableCell>{lab.speciality ? <Badge variant="secondary" className="text-[10px]">{lab.speciality}</Badge> : "—"}</TableCell>
                  <TableCell>{lab.default_tat_days} days</TableCell>
                  <TableCell>₹{Number(lab.default_cost || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {lab.phone && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`tel:${lab.phone}`)}>
                          <Phone className="w-3 h-3" />
                        </Button>
                      )}
                      {lab.whatsapp && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`https://wa.me/${lab.whatsapp.replace(/[^0-9]/g, "")}`, "_blank")}>
                          <MessageCircle className="w-3 h-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteLab.mutate(lab.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
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
