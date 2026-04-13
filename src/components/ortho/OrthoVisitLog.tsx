import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const WIRE_OPTIONS = ["012 NiTi", "014 NiTi", "016 NiTi", "016x022 NiTi", "017x025 NiTi", "019x025 NiTi", "019x025 SS", "021x025 SS", "016x022 SS"];
const AUXILIARIES = ["Elastic Chain", "Open Coil Spring", "Closed Coil Spring", "Bite Turbos", "TAD/Mini-screws", "Class II Elastics", "Class III Elastics", "Vertical Elastics", "Cross Elastics", "Power Chain", "Ligature Ties", "NiTi Coil"];
const PRESCRIPTIONS = ["MBT", "Roth", "Straight Wire"];

export default function OrthoVisitLog({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    wire_upper: "", wire_lower: "", bracket_arch: "", bracket_slot: "", bracket_prescription: "",
    auxiliaries_used: [] as string[], elastic_instructions_given: false,
    next_appointment_interval_weeks: "", clinical_photos_taken: false, progress_notes: "",
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["ortho-visits", caseId],
    queryFn: async () => {
      const { data } = await supabase.from("ortho_visits").select("*, profiles(full_name)")
        .eq("ortho_case_id", caseId).order("visit_number", { ascending: false });
      return data ?? [];
    },
  });

  const nextVisitNumber = visits.length > 0 ? Math.max(...visits.map((v: any) => v.visit_number)) + 1 : 1;

  const addVisit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ortho_visits").insert({
        ortho_case_id: caseId,
        visit_number: nextVisitNumber,
        wire_upper: form.wire_upper || null,
        wire_lower: form.wire_lower || null,
        bracket_arch: form.bracket_arch || null,
        bracket_slot: form.bracket_slot || null,
        bracket_prescription: form.bracket_prescription || null,
        auxiliaries_used: form.auxiliaries_used.length > 0 ? form.auxiliaries_used : null,
        elastic_instructions_given: form.elastic_instructions_given,
        next_appointment_interval_weeks: form.next_appointment_interval_weeks ? parseInt(form.next_appointment_interval_weeks) : null,
        clinical_photos_taken: form.clinical_photos_taken,
        progress_notes: form.progress_notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-visits", caseId] });
      setShowAdd(false);
      setForm({ wire_upper: "", wire_lower: "", bracket_arch: "", bracket_slot: "", bracket_prescription: "", auxiliaries_used: [], elastic_instructions_given: false, next_appointment_interval_weeks: "", clinical_photos_taken: false, progress_notes: "" });
      toast.success("Visit recorded");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-lg font-semibold">Visit Log</h3>
          <p className="text-sm text-muted-foreground">{visits.length} visits recorded</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1"><Plus className="h-4 w-4" /> Record Visit #{nextVisitNumber}</Button>
      </div>

      <div className="space-y-3">
        {visits.map((v: any) => (
          <Card key={v.id} className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/10 text-primary">Visit {v.visit_number}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(v.visit_date).toLocaleDateString()}</span>
                    {v.profiles?.full_name && <span className="text-xs text-muted-foreground">by {v.profiles.full_name}</span>}
                  </div>
                  <div className="flex gap-3 text-sm flex-wrap">
                    {v.wire_upper && <span>Upper: <strong>{v.wire_upper}</strong></span>}
                    {v.wire_lower && <span>Lower: <strong>{v.wire_lower}</strong></span>}
                  </div>
                  {v.auxiliaries_used?.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {v.auxiliaries_used.map((a: string) => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>)}
                    </div>
                  )}
                  {v.progress_notes && <p className="text-sm text-muted-foreground mt-1">{v.progress_notes}</p>}
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  {v.elastic_instructions_given && <Badge variant="secondary" className="text-xs">Elastics ✓</Badge>}
                  {v.clinical_photos_taken && <Badge variant="secondary" className="text-xs">Photos ✓</Badge>}
                  {v.next_appointment_interval_weeks && <Badge variant="outline" className="text-xs">Next: {v.next_appointment_interval_weeks}w</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {visits.length === 0 && <p className="text-center text-muted-foreground py-8">No visits recorded yet</p>}
      </div>

      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Record Visit #{nextVisitNumber}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1">
                  <Label>Upper Wire</Label>
                  <Select value={form.wire_upper} onValueChange={v => setForm(f => ({ ...f, wire_upper: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select wire" /></SelectTrigger>
                    <SelectContent>{WIRE_OPTIONS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Lower Wire</Label>
                  <Select value={form.wire_lower} onValueChange={v => setForm(f => ({ ...f, wire_lower: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select wire" /></SelectTrigger>
                    <SelectContent>{WIRE_OPTIONS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 grid-cols-3">
                <div className="space-y-1">
                  <Label>Bracket Arch</Label>
                  <Select value={form.bracket_arch} onValueChange={v => setForm(f => ({ ...f, bracket_arch: v }))}>
                    <SelectTrigger><SelectValue placeholder="Arch" /></SelectTrigger>
                    <SelectContent><SelectItem value="upper">Upper</SelectItem><SelectItem value="lower">Lower</SelectItem><SelectItem value="both">Both</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Bracket Slot</Label>
                  <Select value={form.bracket_slot} onValueChange={v => setForm(f => ({ ...f, bracket_slot: v }))}>
                    <SelectTrigger><SelectValue placeholder="Slot" /></SelectTrigger>
                    <SelectContent><SelectItem value="0.018">0.018"</SelectItem><SelectItem value="0.022">0.022"</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Prescription</Label>
                  <Select value={form.bracket_prescription} onValueChange={v => setForm(f => ({ ...f, bracket_prescription: v }))}>
                    <SelectTrigger><SelectValue placeholder="Rx" /></SelectTrigger>
                    <SelectContent>{PRESCRIPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Auxiliaries Used</Label>
                <div className="grid grid-cols-3 gap-2">
                  {AUXILIARIES.map(a => (
                    <div key={a} className="flex items-center gap-2">
                      <Checkbox checked={form.auxiliaries_used.includes(a)}
                        onCheckedChange={v => setForm(f => ({ ...f, auxiliaries_used: v ? [...f.auxiliaries_used, a] : f.auxiliaries_used.filter(x => x !== a) }))} />
                      <span className="text-sm">{a}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 grid-cols-3">
                <div className="flex items-center gap-2"><Checkbox checked={form.elastic_instructions_given} onCheckedChange={v => setForm(f => ({ ...f, elastic_instructions_given: !!v }))} /><Label>Elastic instructions given</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={form.clinical_photos_taken} onCheckedChange={v => setForm(f => ({ ...f, clinical_photos_taken: !!v }))} /><Label>Clinical photos taken</Label></div>
                <div className="space-y-1"><Label>Next appt (weeks)</Label><Input type="number" value={form.next_appointment_interval_weeks} onChange={e => setForm(f => ({ ...f, next_appointment_interval_weeks: e.target.value }))} placeholder="4" /></div>
              </div>
              <div className="space-y-1"><Label>Progress Notes</Label><Textarea value={form.progress_notes} onChange={e => setForm(f => ({ ...f, progress_notes: e.target.value }))} placeholder="Clinical observations..." /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => addVisit.mutate()}>Save Visit</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
