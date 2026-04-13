import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const RECORD_TYPES = [
  { value: "pre_treatment", label: "Pre-Treatment" },
  { value: "mid_treatment", label: "Mid-Treatment" },
  { value: "post_treatment", label: "Post-Treatment" },
];

const CEPH_FIELDS = [
  { key: "sna", label: "SNA (°)", normal: "82±2" },
  { key: "snb", label: "SNB (°)", normal: "80±2" },
  { key: "anb", label: "ANB (°)", normal: "2±2" },
  { key: "wits_appraisal", label: "Wits (mm)", normal: "0±2" },
  { key: "u1_to_na_angle", label: "U1 to NA (°)", normal: "22" },
  { key: "u1_to_na_mm", label: "U1 to NA (mm)", normal: "4" },
  { key: "l1_to_nb_angle", label: "L1 to NB (°)", normal: "25" },
  { key: "l1_to_nb_mm", label: "L1 to NB (mm)", normal: "4" },
  { key: "fma", label: "FMA (°)", normal: "25" },
  { key: "impa", label: "IMPA (°)", normal: "90" },
  { key: "overjet", label: "Overjet (mm)", normal: "2-4" },
  { key: "overbite", label: "Overbite (mm)", normal: "2-4" },
];

export default function OrthoCephalometrics({ caseId, clinicId }: { caseId: string; clinicId: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [recordType, setRecordType] = useState("pre_treatment");
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split("T")[0]);
  const [values, setValues] = useState<Record<string, string>>({});

  const { data: records = [] } = useQuery({
    queryKey: ["ortho-ceph", caseId],
    queryFn: async () => {
      const { data } = await supabase.from("ortho_cephalometrics").select("*").eq("ortho_case_id", caseId).order("record_date");
      return data ?? [];
    },
  });

  const addRecord = useMutation({
    mutationFn: async () => {
      const insert: any = {
        ortho_case_id: caseId,
        record_date: recordDate,
        record_type: recordType,
      };
      CEPH_FIELDS.forEach(f => {
        if (values[f.key]) insert[f.key] = parseFloat(values[f.key]);
      });
      const { error } = await supabase.from("ortho_cephalometrics").insert(insert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-ceph", caseId] });
      setShowAdd(false);
      setValues({});
      toast.success("Cephalometric record added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold">Cephalometric Records</h3>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1"><Plus className="h-4 w-4" /> Add Record</Button>
      </div>

      {records.length > 0 ? (
        <Card className="shadow-card border-0">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Measurement</TableHead>
                  <TableHead className="text-xs">Normal</TableHead>
                  {records.map((r: any) => (
                    <TableHead key={r.id}>
                      <div className="text-xs">
                        <Badge variant="secondary" className="text-xs mb-1">{r.record_type.replace("_", "-")}</Badge>
                        <br />{r.record_date}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {CEPH_FIELDS.map(f => (
                  <TableRow key={f.key}>
                    <TableCell className="font-medium text-sm">{f.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.normal}</TableCell>
                    {records.map((r: any) => (
                      <TableCell key={r.id} className="text-sm font-medium">
                        {r[f.key] != null ? r[f.key] : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : <p className="text-center text-muted-foreground py-8">No cephalometric records yet</p>}

      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Cephalometric Analysis</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1">
                  <Label>Record Type</Label>
                  <Select value={recordType} onValueChange={setRecordType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RECORD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Date</Label><Input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} /></div>
              </div>
              <div className="grid gap-2 grid-cols-2">
                {CEPH_FIELDS.map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label} <span className="text-muted-foreground">({f.normal})</span></Label>
                    <Input type="number" step="0.1" value={values[f.key] || ""} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} placeholder={f.normal} />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => addRecord.mutate()}>Save</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
