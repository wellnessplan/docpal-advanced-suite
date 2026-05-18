import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Crown, Trash2, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/supabase-paged";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Memberships() {
  const { clinicId } = useAuth();
  const qc = useQueryClient();
  const [planOpen, setPlanOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ plan_name: "", duration_months: "12", discount_percent: "0", amount: "", benefits: "" });
  const [enrollForm, setEnrollForm] = useState({ patient_id: "", plan_id: "" });

  const { data: plans = [] } = useQuery({
    queryKey: ["membership-plans", clinicId],
    queryFn: async () => {
      return await fetchAllPaged<any>((from, to) =>
        (supabase.from("membership_plans") as any)
          .select("*")
          .eq("clinic_id", clinicId!)
          .order("created_at", { ascending: false })
          .range(from, to)
      );
    },
    enabled: !!clinicId,
  });

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ["memberships", clinicId],
    queryFn: async () => {
      return await fetchAllPaged<any>((from, to) =>
        supabase
          .from("memberships")
          .select("*, patients(full_name, phone)")
          .eq("clinic_id", clinicId!)
          .order("created_at", { ascending: false })
          .range(from, to)
      );
    },
    enabled: !!clinicId,
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list", clinicId],
    queryFn: async () => {
      return await fetchAllPaged<{ id: string; full_name: string }>((from, to) =>
        supabase.from("patients").select("id, full_name").eq("clinic_id", clinicId!).order("full_name").range(from, to)
      );
    },
    enabled: !!clinicId,
  });

  const activeCount = memberships.filter((m: any) => m.status === "active").length;
  const totalRevenue = memberships.reduce((sum: number, m: any) => sum + (m.amount || 0), 0);

  const addPlan = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      const benefits = planForm.benefits.split(",").map(b => b.trim()).filter(Boolean);
      const { error } = await (supabase.from("membership_plans") as any).insert({
        clinic_id: clinicId,
        plan_name: planForm.plan_name,
        duration_months: parseInt(planForm.duration_months) || 12,
        discount_percent: parseFloat(planForm.discount_percent) || 0,
        amount: parseFloat(planForm.amount) || 0,
        benefits,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membership-plans"] });
      setPlanOpen(false);
      setPlanForm({ plan_name: "", duration_months: "12", discount_percent: "0", amount: "", benefits: "" });
      toast.success("Plan created!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("membership_plans") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membership-plans"] });
      toast.success("Plan deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const enrollPatient = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      const plan = plans.find((p: any) => p.id === enrollForm.plan_id);
      if (!plan) throw new Error("Select a plan");
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (plan.duration_months || 12));
      const { error } = await supabase.from("memberships").insert({
        clinic_id: clinicId,
        patient_id: enrollForm.patient_id,
        plan_name: plan.plan_name,
        plan_type: plan.id,
        amount: plan.amount,
        benefits: plan.benefits || [],
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memberships"] });
      setEnrollOpen(false);
      setEnrollForm({ patient_id: "", plan_id: "" });
      toast.success("Patient enrolled!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Memberships</h1>
            <p className="text-muted-foreground text-sm">Dental care membership plans</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={planOpen} onOpenChange={setPlanOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Plan</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Membership Plan</DialogTitle>
                  <DialogDescription>Define a reusable plan template for patients.</DialogDescription>
                </DialogHeader>
                <form onSubmit={e => { e.preventDefault(); addPlan.mutate(); }} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Plan Name *</Label>
                    <Input value={planForm.plan_name} onChange={e => setPlanForm(f => ({ ...f, plan_name: e.target.value }))} required placeholder="Healthy Family" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Duration (months)</Label>
                      <Input type="number" value={planForm.duration_months} onChange={e => setPlanForm(f => ({ ...f, duration_months: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Discount %</Label>
                      <Input type="number" value={planForm.discount_percent} onChange={e => setPlanForm(f => ({ ...f, discount_percent: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Amount (Rs ) *</Label>
                      <Input type="number" value={planForm.amount} onChange={e => setPlanForm(f => ({ ...f, amount: e.target.value }))} required placeholder="500" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Benefits (comma-separated)</Label>
                    <Input value={planForm.benefits} onChange={e => setPlanForm(f => ({ ...f, benefits: e.target.value }))} placeholder="2 Cleaning, 1 Filling" />
                  </div>
                  <Button type="submit" className="w-full" disabled={addPlan.isPending}>
                    {addPlan.isPending ? "Creating..." : "Create Plan"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Enroll</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enroll Patient</DialogTitle>
                  <DialogDescription>Assign a membership plan to a patient.</DialogDescription>
                </DialogHeader>
                <form onSubmit={e => { e.preventDefault(); enrollPatient.mutate(); }} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Patient *</Label>
                    <Select value={enrollForm.patient_id} onValueChange={v => setEnrollForm(f => ({ ...f, patient_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select patient..." /></SelectTrigger>
                      <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Plan *</Label>
                    <Select value={enrollForm.plan_id} onValueChange={v => setEnrollForm(f => ({ ...f, plan_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select plan..." /></SelectTrigger>
                      <SelectContent>{plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.plan_name} — Rs {p.amount}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={enrollPatient.isPending || !enrollForm.patient_id || !enrollForm.plan_id}>
                    {enrollPatient.isPending ? "Enrolling..." : "Enroll Patient"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Active Members</p>
              <p className="text-2xl font-bold mt-1">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-2xl font-bold mt-1 text-green-600">Rs {totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Plans + Enrollments side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Plans */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-base">Plans</h2>
              </div>
              {plans.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No plans created yet</p>
              ) : (
                <div className="space-y-3">
                  {plans.map((p: any) => (
                    <Card key={p.id} className="border">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">{p.plan_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.duration_months} months · {p.discount_percent}% off
                            </p>
                            {p.benefits && p.benefits.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5 uppercase">
                                {p.benefits.join(", ")}
                              </p>
                            )}
                          </div>
                          <p className="text-lg font-bold whitespace-nowrap ml-3">Rs {p.amount}</p>
                        </div>
                        <div className="flex justify-end mt-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deletePlan.mutate(p.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enrollments */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-base">Enrollments</h2>
              </div>
              {isLoading ? (
                <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}</div>
              ) : memberships.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No enrollments yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-xs border-b">
                        <th className="text-left py-2 font-medium">Patient</th>
                        <th className="text-left py-2 font-medium">Plan</th>
                        <th className="text-left py-2 font-medium">End Date</th>
                        <th className="text-left py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberships.map((m: any) => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-2.5">{m.patients?.full_name || "—"}</td>
                          <td className="py-2.5">{m.plan_name}</td>
                          <td className="py-2.5">{m.end_date || "—"}</td>
                          <td className="py-2.5">
                            <Badge
                              variant="secondary"
                              className={m.status === "active" ? "bg-green-50 text-green-700" : ""}
                            >
                              {m.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
