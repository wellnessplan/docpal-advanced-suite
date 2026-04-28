import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Zap, Edit } from "lucide-react";
import { format } from "date-fns";

interface Props { patientId: string; clinicId: string; }

interface Canal {
  name: string;
  working_length: string;
  apical_file: string;
  taper: string;
  obturation: string;
  notes?: string;
}

const DEFAULT_CANALS_BY_TYPE: Record<string, string[]> = {
  anterior: ["Single"],
  premolar: ["Buccal", "Lingual"],
  upper_molar: ["MB", "MB2", "DB", "P"],
  lower_molar: ["MB", "ML", "D"],
};

export default function EndoChart({ patientId, clinicId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    tooth_number: "",
    access_date: format(new Date(), "yyyy-MM-dd"),
    pulp_diagnosis: "",
    periapical_diagnosis: "",
    irrigants: "NaOCl 5.25%, EDTA 17%",
    sealer: "AH Plus",
    obturation_technique: "Single cone",
    status: "in_progress",
    notes: "",
    canals: [] as Canal[],
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["endo", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("endo_charts" as any)
        .select("*")
        .eq("patient_id", patientId)
        .order("access_date", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const reset = () => {
    setEditId(null);
    setForm({
      tooth_number: "", access_date: format(new Date(), "yyyy-MM-dd"),
      pulp_diagnosis: "", periapical_diagnosis: "",
      irrigants: "NaOCl 5.25%, EDTA 17%", sealer: "AH Plus",
      obturation_technique: "Single cone", status: "in_progress", notes: "",
      canals: [],
    });
  };

  const addCanalsForTooth = (toothStr: string) => {
    const t = parseInt(toothStr);
    let key = "anterior";
    const last = t % 10;
    if (last >= 4 && last <= 5) key = "premolar";
    else if (last >= 6) key = (Math.floor(t / 10) <= 2 ? "upper_molar" : "lower_molar");
    const presets = DEFAULT_CANALS_BY_TYPE[key].map(name => ({
      name, working_length: "", apical_file: "", taper: ".04", obturation: "Gutta-percha",
    }));
    setForm((f: any) => ({ ...f, tooth_number: toothStr, canals: presets }));
  };

  const updateCanal = (i: number, field: keyof Canal, value: string) => {
    setForm((f: any) => ({
      ...f,
      canals: f.canals.map((c: Canal, idx: number) => idx === i ? { ...c, [field]: value } : c),
    }));
  };

  const removeCanal = (i: number) =>
    setForm((f: any) => ({ ...f, canals: f.canals.filter((_: any, idx: number) => idx !== i) }));

  const addCanal = () =>
    setForm((f: any) => ({ ...f, canals: [...f.canals, { name: "", working_length: "", apical_file: "", taper: ".04", obturation: "Gutta-percha" }] }));

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.tooth_number) throw new Error("Tooth required");
      const payload = {
        clinic_id: clinicId, patient_id: patientId,
        tooth_number: parseInt(form.tooth_number),
        access_date: form.access_date,
        pulp_diagnosis: form.pulp_diagnosis || null,
        periapical_diagnosis: form.periapical_diagnosis || null,
        canals: form.canals,
        irrigants: form.irrigants || null,
        sealer: form.sealer || null,
        obturation_technique: form.obturation_technique || null,
        status: form.status,
        notes: form.notes || null,
      };
      if (editId) {
        const { error } = await (supabase as any).from("endo_charts").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("endo_charts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["endo"] });
      toast.success(editId ? "Endo case updated" : "Endo case saved");
      setOpen(false); reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("endo_charts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["endo"] }); toast.success("Deleted"); },
  });

  const editCase = (c: any) => {
    setEditId(c.id);
    setForm({
      tooth_number: String(c.tooth_number),
      access_date: c.access_date,
      pulp_diagnosis: c.pulp_diagnosis || "",
      periapical_diagnosis: c.periapical_diagnosis || "",
      irrigants: c.irrigants || "",
      sealer: c.sealer || "",
      obturation_technique: c.obturation_technique || "",
      status: c.status || "in_progress",
      notes: c.notes || "",
      canals: c.canals || [],
    });
    setOpen(true);
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Endodontic Charting
          </CardTitle>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> New RCT Case</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Endodontic Case</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Tooth #</Label>
                    <Input type="number" value={form.tooth_number} onChange={e => addCanalsForTooth(e.target.value)} placeholder="36" />
                  </div>
                  <div>
                    <Label className="text-xs">Access Date</Label>
                    <Input type="date" value={form.access_date} onChange={e => setForm((f: any) => ({ ...f, access_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={form.status} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="retreatment">Retreatment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Pulp Diagnosis</Label>
                    <Select value={form.pulp_diagnosis} onValueChange={v => setForm((f: any) => ({ ...f, pulp_diagnosis: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {["Normal","Reversible pulpitis","Irreversible pulpitis","Necrotic","Previously treated","Previously initiated"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Periapical Diagnosis</Label>
                    <Select value={form.periapical_diagnosis} onValueChange={v => setForm((f: any) => ({ ...f, periapical_diagnosis: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {["Normal","Symptomatic apical periodontitis","Asymptomatic apical periodontitis","Acute apical abscess","Chronic apical abscess","Condensing osteitis"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Canals table */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">Canals ({form.canals.length})</Label>
                    <Button size="sm" variant="outline" onClick={addCanal}>
                      <Plus className="h-3 w-3 mr-1" /> Add Canal
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-2 py-1">Canal</th>
                          <th className="text-left px-2 py-1">WL (mm)</th>
                          <th className="text-left px-2 py-1">Apical File</th>
                          <th className="text-left px-2 py-1">Taper</th>
                          <th className="text-left px-2 py-1">Obturation</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.canals.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-2 text-muted-foreground">Enter tooth # to auto-fill canals</td></tr>
                        ) : form.canals.map((c: Canal, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-1"><Input value={c.name} onChange={e => updateCanal(i, "name", e.target.value)} className="h-7 text-xs w-16" /></td>
                            <td className="p-1"><Input value={c.working_length} onChange={e => updateCanal(i, "working_length", e.target.value)} className="h-7 text-xs w-16" placeholder="21.0" /></td>
                            <td className="p-1"><Input value={c.apical_file} onChange={e => updateCanal(i, "apical_file", e.target.value)} className="h-7 text-xs w-16" placeholder="F2 / #30" /></td>
                            <td className="p-1"><Input value={c.taper} onChange={e => updateCanal(i, "taper", e.target.value)} className="h-7 text-xs w-14" /></td>
                            <td className="p-1"><Input value={c.obturation} onChange={e => updateCanal(i, "obturation", e.target.value)} className="h-7 text-xs" /></td>
                            <td className="p-1">
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeCanal(i)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Irrigants</Label>
                    <Input value={form.irrigants} onChange={e => setForm((f: any) => ({ ...f, irrigants: e.target.value }))} className="text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Sealer</Label>
                    <Input value={form.sealer} onChange={e => setForm((f: any) => ({ ...f, sealer: e.target.value }))} className="text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Obturation Technique</Label>
                    <Input value={form.obturation_technique} onChange={e => setForm((f: any) => ({ ...f, obturation_technique: e.target.value }))} className="text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} className="text-xs" />
                </div>
                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="w-full">
                  {saveMut.isPending ? "Saving..." : (editId ? "Update Case" : "Save Case")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {cases.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No endodontic cases yet</p>
        ) : cases.map((c: any) => (
          <div key={c.id} className="border rounded-lg p-3 space-y-2 hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/30">Tooth #{c.tooth_number}</Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(c.access_date + "T00:00:00"), "dd MMM yyyy")}</span>
                <Badge variant="outline" className="text-[10px] capitalize">{c.status?.replace(/_/g, " ")}</Badge>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editCase(c)}><Edit className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => delMut.mutate(c.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            {c.canals?.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[10px]">
                {c.canals.map((canal: Canal, i: number) => (
                  <div key={i} className="bg-muted/40 rounded p-1.5">
                    <div className="font-bold">{canal.name}</div>
                    <div className="text-muted-foreground">WL: {canal.working_length || "-"}mm · {canal.apical_file || "-"}/{canal.taper || "-"}</div>
                    <div className="text-muted-foreground">{canal.obturation}</div>
                  </div>
                ))}
              </div>
            )}
            {(c.pulp_diagnosis || c.periapical_diagnosis) && (
              <p className="text-[10px] text-muted-foreground">
                {c.pulp_diagnosis && <>Dx: {c.pulp_diagnosis}</>}
                {c.periapical_diagnosis && <> · {c.periapical_diagnosis}</>}
              </p>
            )}
            {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
