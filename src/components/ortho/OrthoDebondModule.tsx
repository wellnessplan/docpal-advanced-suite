import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const RETAINER_TYPES = [
  "Upper Fixed (Bonded 3-3)", "Lower Fixed (Bonded 3-3)",
  "Upper Hawley", "Lower Hawley",
  "Upper Clear Essix", "Lower Clear Essix",
  "Both Fixed + Removable",
];

const RETENTION_SCHEDULE = [
  { interval: "3 months", label: "3 Month Check" },
  { interval: "6 months", label: "6 Month Check" },
  { interval: "1 year", label: "1 Year Check" },
  { interval: "annual", label: "Annual Check" },
];

export default function OrthoDebondModule({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();

  const { data: debond } = useQuery({
    queryKey: ["ortho-debond", caseId],
    queryFn: async () => {
      const { data } = await supabase.from("ortho_debond_records").select("*").eq("ortho_case_id", caseId).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    debond_date: new Date().toISOString().split("T")[0],
    bracket_removal: false, band_removal: false,
    bonded_retainer_placed: false, impressions_taken: false,
    retainer_type: "", retainer_delivery_date: "",
    retainer_instructions_given: false,
    notes: "",
  });

  const createDebond = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ortho_debond_records").insert({
        ortho_case_id: caseId,
        debond_date: form.debond_date,
        bracket_removal: form.bracket_removal,
        band_removal: form.band_removal,
        bonded_retainer_placed: form.bonded_retainer_placed,
        impressions_taken: form.impressions_taken,
        retainer_type: form.retainer_type || null,
        retainer_delivery_date: form.retainer_delivery_date || null,
        retainer_instructions_given: form.retainer_instructions_given,
        retention_schedule: RETENTION_SCHEDULE,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-debond", caseId] });
      toast.success("Debond record created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (debond) {
    const schedule = (debond.retention_schedule || []) as any[];
    return (
      <div className="space-y-4">
        <h3 className="font-heading text-lg font-semibold">Debond & Retention</h3>
        <Card className="shadow-card border-0">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-success/10 text-success">Debonded</Badge>
              <span className="text-sm">{debond.debond_date}</span>
            </div>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 text-sm">
              <div className="flex items-center gap-2"><Checkbox checked={debond.bracket_removal || false} disabled /><span>Bracket Removal</span></div>
              <div className="flex items-center gap-2"><Checkbox checked={debond.band_removal || false} disabled /><span>Band Removal</span></div>
              <div className="flex items-center gap-2"><Checkbox checked={debond.bonded_retainer_placed || false} disabled /><span>Bonded Retainer</span></div>
              <div className="flex items-center gap-2"><Checkbox checked={debond.impressions_taken || false} disabled /><span>Impressions</span></div>
            </div>
            {debond.retainer_type && <p className="text-sm"><strong>Retainer:</strong> {debond.retainer_type}</p>}
            {debond.retainer_delivery_date && <p className="text-sm"><strong>Delivery:</strong> {debond.retainer_delivery_date}</p>}
            <div className="flex items-center gap-2 text-sm"><Checkbox checked={debond.retainer_instructions_given || false} disabled /><span>Retainer instructions given</span></div>

            {schedule.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Retention Schedule</p>
                <div className="flex gap-2 flex-wrap">
                  {schedule.map((s: any, i: number) => (
                    <Badge key={i} variant="outline">{s.label || s.interval}</Badge>
                  ))}
                </div>
              </div>
            )}
            {debond.notes && <p className="text-sm text-muted-foreground">{debond.notes}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-heading text-lg font-semibold">Debond & Retention</h3>
      <Card className="shadow-card border-0">
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">Record the debond procedure and set up retention tracking.</p>
          <div className="space-y-1"><Label>Debond Date</Label><Input type="date" value={form.debond_date} onChange={e => setForm(f => ({ ...f, debond_date: e.target.value }))} /></div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <div className="flex items-center gap-2"><Checkbox checked={form.bracket_removal} onCheckedChange={v => setForm(f => ({ ...f, bracket_removal: !!v }))} /><Label>Bracket Removal</Label></div>
            <div className="flex items-center gap-2"><Checkbox checked={form.band_removal} onCheckedChange={v => setForm(f => ({ ...f, band_removal: !!v }))} /><Label>Band Removal</Label></div>
            <div className="flex items-center gap-2"><Checkbox checked={form.bonded_retainer_placed} onCheckedChange={v => setForm(f => ({ ...f, bonded_retainer_placed: !!v }))} /><Label>Bonded Retainer</Label></div>
            <div className="flex items-center gap-2"><Checkbox checked={form.impressions_taken} onCheckedChange={v => setForm(f => ({ ...f, impressions_taken: !!v }))} /><Label>Impressions Taken</Label></div>
          </div>
          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1">
              <Label>Retainer Type</Label>
              <Select value={form.retainer_type} onValueChange={v => setForm(f => ({ ...f, retainer_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{RETAINER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Retainer Delivery Date</Label><Input type="date" value={form.retainer_delivery_date} onChange={e => setForm(f => ({ ...f, retainer_delivery_date: e.target.value }))} /></div>
          </div>
          <div className="flex items-center gap-2"><Checkbox checked={form.retainer_instructions_given} onCheckedChange={v => setForm(f => ({ ...f, retainer_instructions_given: !!v }))} /><Label>Retainer instructions given to patient</Label></div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <Button onClick={() => createDebond.mutate()}>Record Debond</Button>
        </CardContent>
      </Card>
    </div>
  );
}
