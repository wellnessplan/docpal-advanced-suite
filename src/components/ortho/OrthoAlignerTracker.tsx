import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function OrthoAlignerTracker({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [showSetup, setShowSetup] = useState(false);
  const [showIPR, setShowIPR] = useState(false);
  const [form, setForm] = useState({ aligner_brand: "", total_upper: "", total_lower: "", change_interval: "14", compliance: "" });
  const [iprForm, setIprForm] = useState({ tooth_number: "", mm_removed: "", visit_date: "" });

  const { data: alignerCase } = useQuery({
    queryKey: ["ortho-aligner", caseId],
    queryFn: async () => {
      const { data } = await supabase.from("ortho_aligner_cases").select("*").eq("ortho_case_id", caseId).maybeSingle();
      return data;
    },
  });

  const { data: refinements = [] } = useQuery({
    queryKey: ["ortho-refinements", alignerCase?.id],
    queryFn: async () => {
      if (!alignerCase?.id) return [];
      const { data } = await supabase.from("ortho_aligner_refinements").select("*").eq("aligner_case_id", alignerCase.id).order("refinement_number");
      return data ?? [];
    },
    enabled: !!alignerCase?.id,
  });

  const { data: iprLog = [] } = useQuery({
    queryKey: ["ortho-ipr", caseId],
    queryFn: async () => {
      const { data } = await supabase.from("ortho_ipr_log").select("*").eq("ortho_case_id", caseId).order("visit_date");
      return data ?? [];
    },
  });

  const setupAligner = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ortho_aligner_cases").insert({
        ortho_case_id: caseId,
        aligner_brand: form.aligner_brand || null,
        total_upper_aligners: parseInt(form.total_upper) || 0,
        total_lower_aligners: parseInt(form.total_lower) || 0,
        change_interval_days: parseInt(form.change_interval) || 14,
        compliance_hours_per_day: form.compliance ? parseFloat(form.compliance) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-aligner", caseId] });
      setShowSetup(false);
      toast.success("Aligner case set up");
    },
  });

  const advanceAligner = useMutation({
    mutationFn: async (arch: "upper" | "lower") => {
      if (!alignerCase) return;
      const current = arch === "upper" ? alignerCase.current_upper_aligner : alignerCase.current_lower_aligner;
      const update = arch === "upper"
        ? { current_upper_aligner: (current || 1) + 1 }
        : { current_lower_aligner: (current || 1) + 1 };
      const { error } = await supabase.from("ortho_aligner_cases").update(update).eq("id", alignerCase.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-aligner", caseId] });
      toast.success("Aligner advanced");
    },
  });

  const addIPR = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ortho_ipr_log").insert({
        ortho_case_id: caseId,
        tooth_number: parseInt(iprForm.tooth_number),
        mm_removed: parseFloat(iprForm.mm_removed),
        visit_date: iprForm.visit_date || new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-ipr", caseId] });
      setShowIPR(false);
      setIprForm({ tooth_number: "", mm_removed: "", visit_date: "" });
      toast.success("IPR recorded");
    },
  });

  if (!alignerCase) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No aligner tracking set up for this case</p>
        <Button onClick={() => setShowSetup(true)}>Setup Aligner Tracking</Button>
        {showSetup && (
          <Dialog open onOpenChange={() => setShowSetup(false)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Setup Aligner Case</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Brand</Label><Input value={form.aligner_brand} onChange={e => setForm(f => ({ ...f, aligner_brand: e.target.value }))} placeholder="e.g. Invisalign" /></div>
                <div className="grid gap-3 grid-cols-2">
                  <div className="space-y-1"><Label>Total Upper Aligners</Label><Input type="number" value={form.total_upper} onChange={e => setForm(f => ({ ...f, total_upper: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Total Lower Aligners</Label><Input type="number" value={form.total_lower} onChange={e => setForm(f => ({ ...f, total_lower: e.target.value }))} /></div>
                </div>
                <div className="grid gap-3 grid-cols-2">
                  <div className="space-y-1"><Label>Change Interval (days)</Label><Input type="number" value={form.change_interval} onChange={e => setForm(f => ({ ...f, change_interval: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Compliance (hrs/day)</Label><Input type="number" value={form.compliance} onChange={e => setForm(f => ({ ...f, compliance: e.target.value }))} placeholder="22" /></div>
                </div>
                <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowSetup(false)}>Cancel</Button><Button onClick={() => setupAligner.mutate()}>Setup</Button></div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  const upperProgress = alignerCase.total_upper_aligners ? ((alignerCase.current_upper_aligner || 1) / alignerCase.total_upper_aligners) * 100 : 0;
  const lowerProgress = alignerCase.total_lower_aligners ? ((alignerCase.current_lower_aligner || 1) / alignerCase.total_lower_aligners) * 100 : 0;

  return (
    <div className="space-y-4">
      <h3 className="font-heading text-lg font-semibold">Aligner Tracker {alignerCase.aligner_brand && `— ${alignerCase.aligner_brand}`}</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-card border-0">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Upper Arch</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Aligner {alignerCase.current_upper_aligner} of {alignerCase.total_upper_aligners}</span>
              <span className="font-medium">{Math.round(upperProgress)}%</span>
            </div>
            <Progress value={upperProgress} />
            <Button size="sm" variant="outline" className="w-full" onClick={() => advanceAligner.mutate("upper")}
              disabled={(alignerCase.current_upper_aligner || 1) >= (alignerCase.total_upper_aligners || 0)}>
              Advance to #{(alignerCase.current_upper_aligner || 1) + 1}
            </Button>
          </CardContent>
        </Card>
        <Card className="shadow-card border-0">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Lower Arch</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Aligner {alignerCase.current_lower_aligner} of {alignerCase.total_lower_aligners}</span>
              <span className="font-medium">{Math.round(lowerProgress)}%</span>
            </div>
            <Progress value={lowerProgress} />
            <Button size="sm" variant="outline" className="w-full" onClick={() => advanceAligner.mutate("lower")}
              disabled={(alignerCase.current_lower_aligner || 1) >= (alignerCase.total_lower_aligners || 0)}>
              Advance to #{(alignerCase.current_lower_aligner || 1) + 1}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Change interval: {alignerCase.change_interval_days} days</span>
        {alignerCase.compliance_hours_per_day && <span>• Compliance: {alignerCase.compliance_hours_per_day}h/day</span>}
      </div>

      {/* IPR Log */}
      <div className="flex items-center justify-between mt-6">
        <h4 className="font-heading font-semibold">IPR Log</h4>
        <Button size="sm" variant="outline" onClick={() => setShowIPR(true)} className="gap-1"><Plus className="h-4 w-4" /> Add IPR</Button>
      </div>
      {iprLog.length > 0 ? (
        <Card className="shadow-card border-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Tooth</TableHead><TableHead>mm Removed</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
              <TableBody>
                {iprLog.map((r: any) => (
                  <TableRow key={r.id}><TableCell>#{r.tooth_number}</TableCell><TableCell>{r.mm_removed} mm</TableCell><TableCell>{r.visit_date}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : <p className="text-sm text-muted-foreground">No IPR recorded</p>}

      {showIPR && (
        <Dialog open onOpenChange={() => setShowIPR(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record IPR</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-3 grid-cols-3">
                <div className="space-y-1"><Label>Tooth #</Label><Input type="number" value={iprForm.tooth_number} onChange={e => setIprForm(f => ({ ...f, tooth_number: e.target.value }))} /></div>
                <div className="space-y-1"><Label>mm Removed</Label><Input type="number" step="0.1" value={iprForm.mm_removed} onChange={e => setIprForm(f => ({ ...f, mm_removed: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Date</Label><Input type="date" value={iprForm.visit_date} onChange={e => setIprForm(f => ({ ...f, visit_date: e.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowIPR(false)}>Cancel</Button><Button onClick={() => addIPR.mutate()} disabled={!iprForm.tooth_number || !iprForm.mm_removed}>Save</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
