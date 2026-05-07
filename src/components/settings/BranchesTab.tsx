import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

export default function BranchesTab() {
  const { profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", email: "" });

  const groupId = profile?.group_id;

  const { data: group } = useQuery({
    queryKey: ["clinic-group", groupId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("clinic_groups").select("*").eq("id", groupId).maybeSingle();
      return data;
    },
    enabled: !!groupId,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinics")
        .select("id, name, phone, address, email, created_at")
        .eq("group_id", groupId!)
        .order("created_at");
      return data || [];
    },
    enabled: !!groupId,
  });

  const isOwner = profile?.user_id === group?.owner_user_id;

  const addBranch = useMutation({
    mutationFn: async () => {
      if (!groupId) throw new Error("No group");
      if (!form.name.trim()) throw new Error("Branch name required");
      const { error } = await (supabase as any).rpc("create_branch_in_group", {
        p_group_id: groupId,
        p_name: form.name,
        p_phone: form.phone || null,
        p_address: form.address || null,
        p_email: form.email || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      setOpen(false);
      setForm({ name: "", phone: "", address: "", email: "" });
      toast.success("Branch added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const switchTo = async (clinicId: string) => {
    const { error } = await (supabase as any).rpc("switch_active_branch", { p_clinic_id: clinicId });
    if (error) return toast.error(error.message);
    await refreshProfile();
    qc.invalidateQueries();
    toast.success("Active branch switched");
    setTimeout(() => window.location.reload(), 200);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Branches</CardTitle>
            <CardDescription>
              All branches share patients, staff, inventory, and treatment catalog. Appointments, invoices, and clinical records stay per-branch.
            </CardDescription>
          </div>
          {isOwner && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add Branch</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add new branch</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Branch name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bandra Branch" /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <Button onClick={() => addBranch.mutate()} disabled={addBranch.isPending} className="w-full">
                  {addBranch.isPending ? "Creating..." : "Create branch"}
                </Button>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {!isOwner && (
            <p className="text-sm text-muted-foreground mb-3">
              Only the group owner can add or remove branches. Contact your owner to manage this list.
            </p>
          )}
          <div className="space-y-2">
            {branches.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    {b.name}
                    {b.id === profile?.clinic_id && <Badge variant="default" className="h-5"><Check className="h-3 w-3 mr-1" />Active</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{b.address || "No address"} · {b.phone || "no phone"}</p>
                </div>
                {b.id !== profile?.clinic_id && (
                  <Button size="sm" variant="outline" onClick={() => switchTo(b.id)}>Switch to</Button>
                )}
              </div>
            ))}
            {branches.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No branches yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
