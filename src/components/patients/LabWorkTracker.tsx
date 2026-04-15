import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Package, ArrowRight, CheckCircle2 } from "lucide-react";

interface LabWorkTrackerProps {
  patientId: string;
  clinicId: string;
}

const STATUS_FLOW = ["sent", "in_progress", "received", "fitted"] as const;
const STATUS_LABELS: Record<string, string> = {
  sent: "Sent to Lab",
  in_progress: "In Progress",
  received: "Received",
  fitted: "Fitted",
};
const STATUS_COLORS: Record<string, string> = {
  sent: "bg-primary/10 text-primary",
  in_progress: "bg-warning/10 text-warning",
  received: "bg-accent text-accent-foreground",
  fitted: "bg-success/10 text-success",
};

export default function LabWorkTracker({ patientId, clinicId }: LabWorkTrackerProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ lab_name: "", item_description: "", cost: "", expected_date: "" });

  const { data: orders = [] } = useQuery({
    queryKey: ["lab-orders", patientId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lab_orders")
        .select("*").eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!form.item_description) throw new Error("Describe the item");
      const { error } = await (supabase as any).from("lab_orders").insert({
        clinic_id: clinicId, patient_id: patientId,
        lab_name: form.lab_name || null,
        item_description: form.item_description,
        cost: form.cost ? Number(form.cost) : 0,
        expected_date: form.expected_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      setShowForm(false);
      setForm({ lab_name: "", item_description: "", cost: "", expected_date: "" });
      toast.success("Lab order created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const advanceStatus = useMutation({
    mutationFn: async (order: any) => {
      const currentIdx = STATUS_FLOW.indexOf(order.status);
      if (currentIdx >= STATUS_FLOW.length - 1) return;
      const nextStatus = STATUS_FLOW[currentIdx + 1];
      const updates: any = { status: nextStatus };
      if (nextStatus === "received") updates.received_date = new Date().toISOString().split("T")[0];
      if (nextStatus === "fitted") updates.fitted_date = new Date().toISOString().split("T")[0];
      const { error } = await (supabase as any).from("lab_orders").update(updates).eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      toast.success("Status updated");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold">Lab Work</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          <Plus className="h-3 w-3 mr-1" />{showForm ? "Cancel" : "New Order"}
        </Button>
      </div>

      {showForm && (
        <Card className="shadow-card border-0">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Item (Crown, Bridge, etc.)</Label>
                <Input className="h-8 text-xs" value={form.item_description} onChange={e => setForm(f => ({ ...f, item_description: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Lab Name</Label>
                <Input className="h-8 text-xs" value={form.lab_name} onChange={e => setForm(f => ({ ...f, lab_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cost (Rs )</Label>
                <Input className="h-8 text-xs" type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Expected Date</Label>
                <Input className="h-8 text-xs" type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />
              </div>
            </div>
            <Button size="sm" className="w-full" onClick={() => createOrder.mutate()} disabled={!form.item_description || createOrder.isPending}>
              <Package className="h-3 w-3 mr-1" />Create Order
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {orders.map((order: any) => {
          const currentIdx = STATUS_FLOW.indexOf(order.status);
          const canAdvance = currentIdx < STATUS_FLOW.length - 1;
          return (
            <Card key={order.id} className="shadow-card border-0">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{order.item_description}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {order.lab_name || "No lab specified"}
                      {order.cost > 0 ? ` · Rs ${Number(order.cost).toLocaleString()}` : ""}
                    </p>
                  </div>
                  {canAdvance && (
                    <Button size="sm" variant="outline" onClick={() => advanceStatus.mutate(order)} className="text-xs h-7">
                      <ArrowRight className="h-3 w-3 mr-1" />
                      {STATUS_LABELS[STATUS_FLOW[currentIdx + 1]]}
                    </Button>
                  )}
                </div>
                {/* Status pipeline */}
                <div className="flex items-center gap-1">
                  {STATUS_FLOW.map((s, i) => (
                    <div key={s} className="flex items-center gap-1">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1.5 py-0 ${i <= currentIdx ? STATUS_COLORS[s] : "bg-muted text-muted-foreground/40"}`}
                      >
                        {i <= currentIdx && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                        {STATUS_LABELS[s]}
                      </Badge>
                      {i < STATUS_FLOW.length - 1 && <span className="text-muted-foreground/30 text-[10px]">→</span>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  <span>Sent: {order.sent_date || "—"}</span>
                  {order.expected_date && <span>Expected: {order.expected_date}</span>}
                  {order.received_date && <span>Received: {order.received_date}</span>}
                  {order.fitted_date && <span>Fitted: {order.fitted_date}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!orders.length && !showForm && (
          <p className="text-xs text-muted-foreground text-center py-4">No lab orders yet.</p>
        )}
      </div>
    </div>
  );
}
