import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, IndianRupee, Search } from "lucide-react";

interface Plan {
  id: string;
  code: string;
  name: string;
  price_inr: number;
  billing_cycle: string;
  features: string[];
  max_patients: number | null;
  max_doctors: number | null;
  max_branches: number | null;
  ai_monthly_cap_inr: number | null;
  is_active: boolean;
  sort_order: number;
}

export default function PlansTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);
  const [subSearch, setSubSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPlanId, setBulkPlanId] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; label: string } | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["admin-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("subscription_plans" as any) as any)
        .select("*").order("sort_order");
      if (error) throw error;
      return (data || []).map((p: any) => ({ ...p, features: p.features || [] })) as Plan[];
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["admin-active-subs"],
    queryFn: async () => {
      const [{ data: s }, { data: c }] = await Promise.all([
        (supabase.from("clinic_subscriptions" as any) as any).select("*"),
        supabase.from("clinics").select("id, name"),
      ]);
      const cMap = new Map((c || []).map((x: any) => [x.id, x.name]));
      return ((s as any[]) || []).map((row) => ({ ...row, clinic_name: cMap.get(row.clinic_id) || "Unknown" }));
    },
  });

  const savePlan = useMutation({
    mutationFn: async (p: Partial<Plan>) => {
      const payload: any = {
        code: p.code, name: p.name, price_inr: Number(p.price_inr || 0),
        billing_cycle: p.billing_cycle || "monthly",
        features: p.features || [],
        max_patients: p.max_patients || null,
        max_doctors: p.max_doctors || null,
        max_branches: p.max_branches || null,
        ai_monthly_cap_inr: p.ai_monthly_cap_inr ?? 500,
        is_active: p.is_active ?? true,
        sort_order: p.sort_order ?? 0,
      };
      if (p.id) {
        const { error } = await (supabase.from("subscription_plans" as any) as any).update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("subscription_plans" as any) as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
      setEditing(null);
      toast.success("Plan saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePlan = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from("subscription_plans" as any) as any)
        .update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-subscription-plans"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const changeClinicPlan = useMutation({
    mutationFn: async ({ clinic_id, plan_id }: { clinic_id: string; plan_id: string }) => {
      const plan = plans.find((p) => p.id === plan_id);
      if (!plan) throw new Error("Plan not found");
      const { error } = await (supabase.from("clinic_subscriptions" as any) as any)
        .update({
          plan_id, plan_name: plan.code, amount: plan.price_inr,
          billing_cycle: plan.billing_cycle, ai_monthly_cap_inr: plan.ai_monthly_cap_inr,
        }).eq("clinic_id", clinic_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-active-subs"] });
      toast.success("Plan updated for clinic");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Plan catalog */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Plan catalog ({plans.length})
          </CardTitle>
          <Button size="sm" onClick={() => setEditing({ billing_cycle: "monthly", is_active: true, features: [] })}>
            <Plus className="h-4 w-4 mr-1" /> New plan
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>AI cap</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.code}</div>
                  </TableCell>
                  <TableCell className="font-medium">
                    ₹{p.price_inr.toLocaleString()}<span className="text-xs text-muted-foreground">/{p.billing_cycle}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.max_patients ?? "∞"} patients · {p.max_doctors ?? "∞"} docs · {p.max_branches ?? "∞"} branches
                  </TableCell>
                  <TableCell className="text-sm">₹{(p.ai_monthly_cap_inr ?? 0).toLocaleString()}/mo</TableCell>
                  <TableCell>
                    <Switch checked={p.is_active}
                      onCheckedChange={(v) => togglePlan.mutate({ id: p.id, is_active: v })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Active subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <IndianRupee className="h-4 w-4" /> Clinic subscriptions ({subs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Change plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No subscriptions yet</TableCell></TableRow>
              ) : subs.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.clinic_name}</TableCell>
                  <TableCell><Badge variant="outline">{s.plan_name || "—"}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{s.status}</Badge></TableCell>
                  <TableCell>₹{Number(s.amount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Select value={s.plan_id || ""} onValueChange={(plan_id) => changeClinicPlan.mutate({ clinic_id: s.clinic_id, plan_id })}>
                      <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Select plan…" /></SelectTrigger>
                      <SelectContent>
                        {plans.filter((p) => p.is_active).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} · ₹{p.price_inr}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit plan" : "New plan"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Code</Label>
                  <Input value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="basic" />
                </div>
                <div>
                  <Label>Display name</Label>
                  <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Basic" />
                </div>
                <div>
                  <Label>Price (₹)</Label>
                  <Input type="number" value={editing.price_inr ?? 0} onChange={(e) => setEditing({ ...editing, price_inr: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Billing cycle</Label>
                  <Select value={editing.billing_cycle || "monthly"} onValueChange={(v) => setEditing({ ...editing, billing_cycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Max patients (blank = ∞)</Label>
                  <Input type="number" value={editing.max_patients ?? ""} onChange={(e) => setEditing({ ...editing, max_patients: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <Label>Max doctors</Label>
                  <Input type="number" value={editing.max_doctors ?? ""} onChange={(e) => setEditing({ ...editing, max_doctors: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <Label>Max branches</Label>
                  <Input type="number" value={editing.max_branches ?? ""} onChange={(e) => setEditing({ ...editing, max_branches: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <Label>AI cap ₹/mo</Label>
                  <Input type="number" value={editing.ai_monthly_cap_inr ?? 500} onChange={(e) => setEditing({ ...editing, ai_monthly_cap_inr: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Features (one per line)</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={(editing.features || []).join("\n")}
                  onChange={(e) => setEditing({ ...editing, features: e.target.value.split("\n").filter(Boolean) })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label>Active (visible to clinics)</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && savePlan.mutate(editing)} disabled={savePlan.isPending}>
              {savePlan.isPending ? "Saving…" : "Save plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
