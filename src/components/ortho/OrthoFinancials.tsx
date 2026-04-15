import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, IndianRupee } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
};

export default function OrthoFinancials({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ milestone_name: "", amount: "", due_date: "" });

  const { data: milestones = [] } = useQuery({
    queryKey: ["ortho-milestones", caseId],
    queryFn: async () => {
      const { data } = await supabase.from("ortho_financial_milestones").select("*").eq("ortho_case_id", caseId).order("due_date");
      return data ?? [];
    },
  });

  const addMilestone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ortho_financial_milestones").insert({
        ortho_case_id: caseId,
        milestone_name: form.milestone_name,
        amount: parseFloat(form.amount) || 0,
        due_date: form.due_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-milestones", caseId] });
      setShowAdd(false);
      setForm({ milestone_name: "", amount: "", due_date: "" });
      toast.success("Milestone added");
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ortho_financial_milestones").update({ status: "paid", paid_date: new Date().toISOString().split("T")[0] }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-milestones", caseId] });
      toast.success("Marked as paid");
    },
  });

  const totalAmount = milestones.reduce((s: number, m: any) => s + Number(m.amount), 0);
  const paidAmount = milestones.filter((m: any) => m.status === "paid").reduce((s: number, m: any) => s + Number(m.amount), 0);
  const outstanding = totalAmount - paidAmount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-lg font-semibold">Financial Tracking</h3>
          <p className="text-sm text-muted-foreground">Total: Rs {totalAmount.toLocaleString()} • Paid: Rs {paidAmount.toLocaleString()} • Outstanding: <span className="text-destructive font-medium">Rs {outstanding.toLocaleString()}</span></p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1"><Plus className="h-4 w-4" /> Add Milestone</Button>
      </div>

      <Card className="shadow-card border-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Milestone</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.milestone_name}</TableCell>
                  <TableCell>Rs {Number(m.amount).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{m.due_date || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className={STATUS_COLORS[m.status] || ""}>{m.status}</Badge></TableCell>
                  <TableCell className="text-sm">{m.paid_date || "—"}</TableCell>
                  <TableCell>
                    {m.status !== "paid" && (
                      <Button size="sm" variant="outline" onClick={() => markPaid.mutate(m.id)}>Mark Paid</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {milestones.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No milestones set</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Payment Milestone</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Milestone Name</Label><Input value={form.milestone_name} onChange={e => setForm(f => ({ ...f, milestone_name: e.target.value }))} placeholder="e.g. Case Start Fee" /></div>
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1"><Label>Amount (Rs )</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => addMilestone.mutate()} disabled={!form.milestone_name || !form.amount}>Add</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
