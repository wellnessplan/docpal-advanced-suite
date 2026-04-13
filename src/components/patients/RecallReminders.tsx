import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, Plus, Clock, CheckCircle2 } from "lucide-react";

interface RecallRemindersProps {
  patientId: string;
  clinicId: string;
}

const REMINDER_TYPES = ["Checkup", "Scaling", "Follow-up", "X-Ray Review", "Crown Delivery", "Orthodontic Adjustment", "Custom"];

export default function RecallReminders({ patientId, clinicId }: RecallRemindersProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "", due_date: "", notes: "" });

  const { data: reminders = [] } = useQuery({
    queryKey: ["recall-reminders", patientId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("recall_reminders")
        .select("*").eq("patient_id", patientId)
        .order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const createReminder = useMutation({
    mutationFn: async () => {
      if (!form.type || !form.due_date) throw new Error("Fill type and date");
      const { error } = await (supabase as any).from("recall_reminders").insert({
        clinic_id: clinicId, patient_id: patientId,
        reminder_type: form.type, due_date: form.due_date,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recall-reminders"] });
      setShowForm(false);
      setForm({ type: "", due_date: "", notes: "" });
      toast.success("Reminder set");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("recall_reminders")
        .update({ status: "completed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recall-reminders"] });
      toast.success("Marked complete");
    },
  });

  const isPastDue = (date: string) => new Date(date) < new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold">Recall & Follow-ups</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          <Plus className="h-3 w-3 mr-1" />{showForm ? "Cancel" : "Add Reminder"}
        </Button>
      </div>

      {showForm && (
        <Card className="shadow-card border-0">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Reminder Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {REMINDER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Due Date</Label>
                <Input className="h-8 text-xs" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
            <Input className="h-8 text-xs" placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <Button size="sm" className="w-full" onClick={() => createReminder.mutate()} disabled={!form.type || !form.due_date || createReminder.isPending}>
              <Bell className="h-3 w-3 mr-1" />Set Reminder
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {reminders.map((r: any) => (
          <Card key={r.id} className="shadow-card border-0">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  r.status === "completed" ? "bg-success/10" : isPastDue(r.due_date) ? "bg-destructive/10" : "bg-primary/10"
                }`}>
                  {r.status === "completed"
                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                    : <Clock className="h-4 w-4 text-primary" />
                  }
                </div>
                <div>
                  <p className="text-sm font-medium">{r.reminder_type}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Due: {new Date(r.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.status === "completed" ? (
                  <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">Done</Badge>
                ) : (
                  <>
                    {isPastDue(r.due_date) && <Badge variant="secondary" className="bg-destructive/10 text-destructive text-[10px]">Overdue</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => markDone.mutate(r.id)} className="text-xs h-7">
                      <CheckCircle2 className="h-3 w-3 mr-1" />Done
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!reminders.length && !showForm && (
          <p className="text-xs text-muted-foreground text-center py-4">No reminders set.</p>
        )}
      </div>
    </div>
  );
}
