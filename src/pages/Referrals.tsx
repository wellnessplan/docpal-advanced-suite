import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Gift, Users, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/supabase-paged";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  contacted: "bg-blue-100 text-blue-700",
  converted: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

export default function Referrals() {
  const { clinicId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ referred_name: "", referred_phone: "", referring_patient_id: "", reward_type: "discount", reward_amount: "200" });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list", clinicId],
    queryFn: async () => {
      return await fetchAllPaged<{ id: string; full_name: string }>((from, to) =>
        supabase.from("patients").select("id, full_name").eq("clinic_id", clinicId!).order("full_name").range(from, to)
      );
    },
    enabled: !!clinicId,
  });

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["referrals", clinicId],
    queryFn: async () => {
      return await fetchAllPaged<any>((from, to) =>
        (supabase.from("referrals") as any)
          .select("*, patients:referring_patient_id(full_name)")
          .eq("clinic_id", clinicId!)
          .order("created_at", { ascending: false })
          .range(from, to)
      );
    },
    enabled: !!clinicId,
  });

  const addReferral = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      const { error } = await (supabase.from("referrals") as any).insert({
        clinic_id: clinicId,
        referred_name: form.referred_name,
        referred_phone: form.referred_phone || null,
        referring_patient_id: form.referring_patient_id || null,
        reward_type: form.reward_type,
        reward_amount: parseFloat(form.reward_amount) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referrals"] });
      setOpen(false);
      setForm({ referred_name: "", referred_phone: "", referring_patient_id: "", reward_type: "discount", reward_amount: "200" });
      toast.success("Referral added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from("referrals") as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referrals"] });
      toast.success("Status updated");
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Referral Program</h1>
            <p className="text-muted-foreground text-sm">{referrals.filter((r: any) => r.status === "converted").length} converted · {referrals.length} total referrals</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Referral</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Referral</DialogTitle>
                <DialogDescription>Record a patient referral to track rewards.</DialogDescription>
              </DialogHeader>
              <form onSubmit={e => { e.preventDefault(); addReferral.mutate(); }} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Referring Patient</Label>
                  <Select value={form.referring_patient_id} onValueChange={v => setForm(f => ({ ...f, referring_patient_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select patient..." /></SelectTrigger>
                    <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Referred Person Name *</Label>
                    <Input value={form.referred_name} onChange={e => setForm(f => ({ ...f, referred_name: e.target.value }))} required placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={form.referred_phone} onChange={e => setForm(f => ({ ...f, referred_phone: e.target.value }))} placeholder="+91 98765..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Reward Type</Label>
                    <Select value={form.reward_type} onValueChange={v => setForm(f => ({ ...f, reward_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="discount">Discount</SelectItem>
                        <SelectItem value="cashback">Cashback</SelectItem>
                        <SelectItem value="free_treatment">Free Treatment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reward Amount (Rs )</Label>
                    <Input type="number" value={form.reward_amount} onChange={e => setForm(f => ({ ...f, reward_amount: e.target.value }))} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={addReferral.isPending}>
                  {addReferral.isPending ? "Adding..." : "Add Referral"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {(["pending", "contacted", "converted", "lost"] as const).map(s => (
            <Card key={s}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground capitalize">{s}</p>
                <p className="text-xl font-bold">{referrals.filter((r: any) => r.status === s).length}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : referrals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Gift className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No referrals yet</h3>
              <p className="text-muted-foreground text-sm mt-1">Start your patient referral program to grow organically</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {referrals.map((ref: any) => (
              <Card key={ref.id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-purple-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{ref.patients?.full_name || "Unknown"} → {ref.referred_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{ref.reward_type?.replace("_", " ")}: Rs {ref.reward_amount}</p>
                  </div>
                  <Badge className={statusColors[ref.status] || ""} variant="secondary">{ref.status}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {["pending", "contacted", "converted", "lost"].filter(s => s !== ref.status).map(s => (
                        <DropdownMenuItem key={s} onClick={() => updateStatus.mutate({ id: ref.id, status: s })} className="capitalize">
                          Mark as {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
