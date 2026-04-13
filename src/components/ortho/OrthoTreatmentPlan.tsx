import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_PHASES = [
  { phase_number: 1, phase_name: "Pre-treatment", description: "Extractions, buildup, hygiene" },
  { phase_number: 2, phase_name: "Active Treatment", description: "Levelling, alignment, space closure, detailing" },
  { phase_number: 3, phase_name: "Finishing & Debond", description: "Final adjustments and debonding" },
  { phase_number: 4, phase_name: "Retention", description: "Fixed/removable retainer phase" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
};

export default function OrthoTreatmentPlan({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ phase_number: 1, phase_name: "", description: "", estimated_visits: "", visit_interval_weeks: "", estimated_cost: "", notes: "" });

  const { data: phases = [] } = useQuery({
    queryKey: ["ortho-phases", caseId],
    queryFn: async () => {
      const { data } = await supabase.from("ortho_treatment_phases").select("*").eq("ortho_case_id", caseId).order("phase_number");
      return data ?? [];
    },
  });

  const addPhase = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ortho_treatment_phases").insert({
        ortho_case_id: caseId,
        phase_number: form.phase_number,
        phase_name: form.phase_name,
        description: form.description || null,
        estimated_visits: form.estimated_visits ? parseInt(form.estimated_visits) : null,
        visit_interval_weeks: form.visit_interval_weeks ? parseInt(form.visit_interval_weeks) : null,
        estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : 0,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-phases", caseId] });
      setShowAdd(false);
      toast.success("Phase added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePhaseStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === "in_progress") update.started_at = new Date().toISOString();
      if (status === "completed") update.completed_at = new Date().toISOString();
      const { error } = await supabase.from("ortho_treatment_phases").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-phases", caseId] });
      toast.success("Phase updated");
    },
  });

  const addDefaultPhases = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ortho_treatment_phases").insert(
        DEFAULT_PHASES.map(p => ({ ortho_case_id: caseId, ...p }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-phases", caseId] });
      toast.success("Default phases added");
    },
  });

  const totalCost = phases.reduce((s: number, p: any) => s + Number(p.estimated_cost || 0), 0);
  const totalVisits = phases.reduce((s: number, p: any) => s + Number(p.estimated_visits || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-lg font-semibold">Treatment Plan</h3>
          <p className="text-sm text-muted-foreground">{phases.length} phases • {totalVisits} visits est. • ₹{totalCost.toLocaleString()} total</p>
        </div>
        <div className="flex gap-2">
          {phases.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => addDefaultPhases.mutate()}>Add Default Phases</Button>
          )}
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1"><Plus className="h-4 w-4" /> Add Phase</Button>
        </div>
      </div>

      <div className="space-y-3">
        {phases.map((phase: any) => (
          <Card key={phase.id} className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">Phase {phase.phase_number}</span>
                    <h4 className="font-medium">{phase.phase_name}</h4>
                    <Badge variant="secondary" className={STATUS_COLORS[phase.status] || ""}>{phase.status}</Badge>
                  </div>
                  {phase.description && <p className="text-sm text-muted-foreground mt-1">{phase.description}</p>}
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    {phase.estimated_visits && <span>{phase.estimated_visits} visits</span>}
                    {phase.visit_interval_weeks && <span>every {phase.visit_interval_weeks} weeks</span>}
                    {phase.estimated_cost > 0 && <span>₹{Number(phase.estimated_cost).toLocaleString()}</span>}
                  </div>
                </div>
                <Select value={phase.status} onValueChange={v => updatePhaseStatus.mutate({ id: phase.id, status: v })}>
                  <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Treatment Phase</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1"><Label>Phase #</Label><Input type="number" value={form.phase_number} onChange={e => setForm(f => ({ ...f, phase_number: parseInt(e.target.value) || 1 }))} /></div>
                <div className="space-y-1"><Label>Phase Name</Label><Input value={form.phase_name} onChange={e => setForm(f => ({ ...f, phase_name: e.target.value }))} placeholder="e.g. Active Treatment" /></div>
              </div>
              <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid gap-3 grid-cols-3">
                <div className="space-y-1"><Label>Est. Visits</Label><Input type="number" value={form.estimated_visits} onChange={e => setForm(f => ({ ...f, estimated_visits: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Interval (weeks)</Label><Input type="number" value={form.visit_interval_weeks} onChange={e => setForm(f => ({ ...f, visit_interval_weeks: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Cost (₹)</Label><Input type="number" value={form.estimated_cost} onChange={e => setForm(f => ({ ...f, estimated_cost: e.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => addPhase.mutate()} disabled={!form.phase_name}>Add Phase</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
