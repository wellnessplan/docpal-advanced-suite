import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Crown, Trash2, Users, Pencil, RefreshCw, XCircle, MessageCircle, Search, AlertTriangle, TrendingUp, Award, Minus, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/supabase-paged";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, differenceInDays, addMonths } from "date-fns";

type PlanForm = { plan_name: string; duration_months: string; discount_percent: string; amount: string; benefits: string; visit_interval_months: string; allowed_services: string; maintenance_message: string };
const blankPlan: PlanForm = { plan_name: "", duration_months: "12", discount_percent: "0", amount: "", benefits: "", visit_interval_months: "6", allowed_services: "", maintenance_message: "" };

export default function Memberships() {
  const { clinicId } = useAuth();
  const qc = useQueryClient();

  // Plan dialog
  const [planOpen, setPlanOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(blankPlan);

  // Enroll dialog
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ patient_id: "", plan_id: "", create_invoice: true });

  // Edit enrollment
  const [editEnroll, setEditEnroll] = useState<any | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: plans = [] } = useQuery({
    queryKey: ["membership-plans", clinicId],
    queryFn: async () => fetchAllPaged<any>((from, to) =>
      (supabase.from("membership_plans") as any).select("*").eq("clinic_id", clinicId!).order("created_at", { ascending: false }).range(from, to)
    ),
    enabled: !!clinicId,
  });

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ["memberships", clinicId],
    queryFn: async () => fetchAllPaged<any>((from, to) =>
      supabase.from("memberships").select("*, patients(full_name, phone)").eq("clinic_id", clinicId!).order("created_at", { ascending: false }).range(from, to)
    ),
    enabled: !!clinicId,
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list", clinicId],
    queryFn: async () => fetchAllPaged<{ id: string; full_name: string; phone: string | null }>((from, to) =>
      supabase.from("patients").select("id, full_name, phone").eq("clinic_id", clinicId!).order("full_name").range(from, to)
    ),
    enabled: !!clinicId,
  });

  // Fetch payment status for membership-linked invoices
  const invoiceIds = useMemo(
    () => memberships.map((m: any) => m.invoice_id).filter(Boolean),
    [memberships]
  );
  const { data: invoiceMap = {} } = useQuery({
    queryKey: ["membership-invoices", clinicId, invoiceIds.length],
    enabled: !!clinicId && invoiceIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, status, paid_amount, total")
        .in("id", invoiceIds);
      const map: Record<string, any> = {};
      (data || []).forEach((i: any) => { map[i.id] = i; });
      return map;
    },
  });

  // Revenue metrics (MRR / Churn / LTV)
  const { data: metrics } = useQuery({
    queryKey: ["membership-revenue-metrics", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("membership_revenue_metrics", { p_clinic_id: clinicId });
      if (error) throw error;
      return data as any;
    },
  });

  // Derived status: expired / expiring-soon flags + payment
  const today = new Date();
  const enriched = useMemo(() => memberships.map((m: any) => {
    const end = m.end_date ? new Date(m.end_date) : null;
    const daysLeft = end ? differenceInDays(end, today) : null;
    const isExpired = m.status === "active" && daysLeft !== null && daysLeft < 0;
    const isExpiring = m.status === "active" && daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
    const inv = m.invoice_id ? (invoiceMap as any)[m.invoice_id] : null;
    let paymentStatus: "paid" | "partial" | "unpaid" | "failed" | null = null;
    if (inv) {
      if (inv.status === "failed") paymentStatus = "failed";
      else if (Number(inv.paid_amount) >= Number(inv.total) && Number(inv.total) > 0) paymentStatus = "paid";
      else if (Number(inv.paid_amount) > 0) paymentStatus = "partial";
      else paymentStatus = "unpaid";
    }
    return { ...m, daysLeft, isExpired, isExpiring, paymentStatus };
  }), [memberships, invoiceMap]);

  const upcomingMaintenance = useMemo(() => {
    const horizon = new Date(today.getTime() + 30 * 86_400_000);
    return enriched
      .filter((m: any) => m.status === "active" && m.next_maintenance_date && new Date(m.next_maintenance_date) <= horizon)
      .sort((a: any, b: any) => new Date(a.next_maintenance_date).getTime() - new Date(b.next_maintenance_date).getTime());
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((m: any) => {
      if (statusFilter === "active" && m.status !== "active") return false;
      if (statusFilter === "expired" && !(m.status === "expired" || m.isExpired)) return false;
      if (statusFilter === "expiring" && !m.isExpiring) return false;
      if (statusFilter === "cancelled" && m.status !== "cancelled") return false;
      if (!q) return true;
      return (m.patients?.full_name || "").toLowerCase().includes(q) || (m.plan_name || "").toLowerCase().includes(q);
    });
  }, [enriched, search, statusFilter]);

  const activeCount = enriched.filter((m: any) => m.status === "active" && !m.isExpired).length;
  const expiringCount = enriched.filter((m: any) => m.isExpiring).length;
  const expiredCount = enriched.filter((m: any) => m.status === "expired" || m.isExpired).length;
  const totalRevenue = memberships.reduce((sum: number, m: any) => sum + Number(m.amount || 0), 0);

  // Plan mutations
  const savePlan = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      const benefits = planForm.benefits.split(",").map(b => b.trim()).filter(Boolean);
      const allowed_services = planForm.allowed_services.split(",").map(b => b.trim()).filter(Boolean);
      const payload = {
        clinic_id: clinicId,
        plan_name: planForm.plan_name,
        duration_months: parseInt(planForm.duration_months) || 12,
        discount_percent: parseFloat(planForm.discount_percent) || 0,
        amount: parseFloat(planForm.amount) || 0,
        benefits,
        visit_interval_months: planForm.visit_interval_months ? parseInt(planForm.visit_interval_months) : null,
        allowed_services,
        maintenance_message: planForm.maintenance_message || null,
      };
      if (editingPlanId) {
        const { error } = await (supabase.from("membership_plans") as any).update(payload).eq("id", editingPlanId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("membership_plans") as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membership-plans"] });
      setPlanOpen(false); setEditingPlanId(null); setPlanForm(blankPlan);
      toast.success(editingPlanId ? "Plan updated" : "Plan created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("membership_plans") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["membership-plans"] }); toast.success("Plan deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEditPlan = (p: any) => {
    setEditingPlanId(p.id);
    setPlanForm({
      plan_name: p.plan_name || "",
      duration_months: String(p.duration_months ?? 12),
      discount_percent: String(p.discount_percent ?? 0),
      amount: String(p.amount ?? ""),
      benefits: Array.isArray(p.benefits) ? p.benefits.join(", ") : "",
      visit_interval_months: String(p.visit_interval_months ?? ""),
      allowed_services: Array.isArray(p.allowed_services) ? p.allowed_services.join(", ") : "",
      maintenance_message: p.maintenance_message || "",
    });
    setPlanOpen(true);
  };

  // Enroll
  const enrollPatient = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      const plan = plans.find((p: any) => p.id === enrollForm.plan_id);
      if (!plan) throw new Error("Select a plan");
      const startDate = new Date();
      const endDate = addMonths(startDate, plan.duration_months || 12);
      const nextMaint = plan.visit_interval_months
        ? addMonths(startDate, plan.visit_interval_months).toISOString().split("T")[0]
        : null;

      let invoiceId: string | null = null;
      if (enrollForm.create_invoice && plan.amount > 0) {
        const { data: inv, error: ie } = await supabase.from("invoices").insert({
          clinic_id: clinicId,
          patient_id: enrollForm.patient_id,
          subtotal: plan.amount,
          total: plan.amount,
          paid_amount: 0,
          status: "unpaid",
          invoice_date: startDate.toISOString().split("T")[0],
          notes: `Membership: ${plan.plan_name}`,
        } as any).select().single();
        if (!ie && inv) {
          invoiceId = (inv as any).id;
          await supabase.from("invoice_items").insert({
            invoice_id: invoiceId,
            description: `Membership – ${plan.plan_name} (${plan.duration_months} mo)`,
            quantity: 1, unit_price: plan.amount, total: plan.amount,
          } as any);
        }
      }

      const { data: m, error } = await supabase.from("memberships").insert({
        clinic_id: clinicId,
        patient_id: enrollForm.patient_id,
        plan_name: plan.plan_name,
        plan_type: plan.id,
        amount: plan.amount,
        benefits: plan.benefits || [],
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        status: "active",
        invoice_id: invoiceId,
        next_maintenance_date: nextMaint,
      } as any).select().single();
      if (error) throw error;
      return m;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memberships"] });
      qc.invalidateQueries({ queryKey: ["membership-invoices"] });
      setEnrollOpen(false);
      setEnrollForm({ patient_id: "", plan_id: "", create_invoice: true });
      toast.success("Patient enrolled");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Renew, cancel, update enrollment
  const renewMembership = useMutation({
    mutationFn: async (m: any) => {
      const plan = plans.find((p: any) => p.id === m.plan_type);
      const months = plan?.duration_months || 12;
      const base = m.end_date && new Date(m.end_date) > today ? new Date(m.end_date) : today;
      const newEnd = addMonths(base, months);
      const nextMaint = plan?.visit_interval_months
        ? addMonths(today, plan.visit_interval_months).toISOString().split("T")[0]
        : m.next_maintenance_date;
      const { error } = await supabase.from("memberships").update({
        status: "active",
        end_date: newEnd.toISOString().split("T")[0],
        next_maintenance_date: nextMaint,
      } as any).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memberships"] }); toast.success("Renewed"); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelMembership = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("memberships").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memberships"] }); toast.success("Cancelled"); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveEnroll = useMutation({
    mutationFn: async () => {
      if (!editEnroll) return;
      const { error } = await supabase.from("memberships").update({
        plan_name: editEnroll.plan_name,
        amount: Number(editEnroll.amount) || 0,
        start_date: editEnroll.start_date,
        end_date: editEnroll.end_date,
        status: editEnroll.status,
        next_maintenance_date: editEnroll.next_maintenance_date || null,
      } as any).eq("id", editEnroll.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memberships"] }); setEditEnroll(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const sendRenewalReminder = useMutation({
    mutationFn: async (m: any) => {
      if (!m.patients?.phone) throw new Error("No phone on file");
      const { error } = await supabase.functions.invoke("send-membership-reminders", {
        body: { membership_id: m.id },
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memberships"] }); toast.success("Renewal reminder sent"); },
    onError: (e: any) => toast.error(e.message),
  });

  const sendBenefitsCard = useMutation({
    mutationFn: async (m: any) => {
      if (!m.patients?.phone) throw new Error("No phone on file");
      const benefits: string[] = Array.isArray(m.benefits) ? m.benefits : [];
      const usage = (m.usage_counters || {}) as Record<string, number>;
      const since = m.start_date ? format(new Date(m.start_date), "MMM yyyy") : "—";
      const lines = benefits.length
        ? benefits.map(b => {
            const key = b.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
            const used = usage[key] || 0;
            return `• ${b}${used ? ` — ${used} used` : ""}`;
          }).join("\n")
        : "• Member benefits included";
      const body = `🏆 ${m.plan_name} Member\n${m.patients.full_name} — since ${since}\n\n${lines}\n\nValid till ${m.end_date ? format(new Date(m.end_date), "dd MMM yyyy") : "—"}.`;
      const { error } = await supabase.from("whatsapp_logs").insert({
        clinic_id: m.clinic_id,
        patient_id: m.patient_id,
        template_name: "membership_benefits_card",
        phone: m.patients.phone,
        message_body: body,
        status: "queued",
        delivery_status: "queued",
        sent_at: new Date().toISOString(),
      });
      if (error) throw error;
      await supabase.from("memberships").update({ last_benefits_card_at: new Date().toISOString() }).eq("id", m.id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memberships"] }); toast.success("Benefits card sent"); },
    onError: (e: any) => toast.error(e.message),
  });

  const adjustUsage = useMutation({
    mutationFn: async ({ m, key, delta }: { m: any; key: string; delta: number }) => {
      const current = { ...(m.usage_counters || {}) } as Record<string, number>;
      const next = Math.max(0, (current[key] || 0) + delta);
      current[key] = next;
      const { error } = await supabase.from("memberships").update({ usage_counters: current }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memberships"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const statusBadge = (m: any) => {
    if (m.status === "suspended") return <Badge variant="destructive">Suspended</Badge>;
    if (m.status === "cancelled") return <Badge variant="secondary">Cancelled</Badge>;
    if (m.status === "expired" || m.isExpired) return <Badge variant="destructive">Expired</Badge>;
    if (m.isExpiring) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Expiring in {m.daysLeft}d</Badge>;
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
  };

  const paymentBadge = (m: any) => {
    if (!m.paymentStatus) return <span className="text-xs text-muted-foreground">—</span>;
    if (m.paymentStatus === "paid") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">Paid</Badge>;
    if (m.paymentStatus === "failed") return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
    if (m.paymentStatus === "partial") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px]">Partial</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">Unpaid</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Memberships</h1>
            <p className="text-muted-foreground text-sm">Maintenance & care plans</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={planOpen} onOpenChange={(o) => { setPlanOpen(o); if (!o) { setEditingPlanId(null); setPlanForm(blankPlan); } }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Plan</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPlanId ? "Edit Plan" : "Create Membership Plan"}</DialogTitle>
                  <DialogDescription>Reusable plan template.</DialogDescription>
                </DialogHeader>
                <form onSubmit={e => { e.preventDefault(); savePlan.mutate(); }} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Plan Name *</Label>
                    <Input value={planForm.plan_name} onChange={e => setPlanForm(f => ({ ...f, plan_name: e.target.value }))} required placeholder="Healthy Family" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5"><Label>Duration (months)</Label>
                      <Input type="number" value={planForm.duration_months} onChange={e => setPlanForm(f => ({ ...f, duration_months: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5"><Label>Discount %</Label>
                      <Input type="number" value={planForm.discount_percent} onChange={e => setPlanForm(f => ({ ...f, discount_percent: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5"><Label>Amount (Rs) *</Label>
                      <Input type="number" value={planForm.amount} onChange={e => setPlanForm(f => ({ ...f, amount: e.target.value }))} required placeholder="500" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Benefits (comma-separated)</Label>
                    <Input value={planForm.benefits} onChange={e => setPlanForm(f => ({ ...f, benefits: e.target.value }))} placeholder="2 Cleaning, 1 Filling, 10% off treatments" />
                  </div>
                  <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground">Maintenance rules (optional)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label className="text-xs">Visit interval (months)</Label>
                        <Input type="number" min={1} value={planForm.visit_interval_months}
                          onChange={e => setPlanForm(f => ({ ...f, visit_interval_months: e.target.value }))} placeholder="6" />
                      </div>
                      <div className="space-y-1.5"><Label className="text-xs">Allowed services</Label>
                        <Input value={planForm.allowed_services}
                          onChange={e => setPlanForm(f => ({ ...f, allowed_services: e.target.value }))} placeholder="Cleaning, Polishing, X-Ray" />
                      </div>
                    </div>
                    <div className="space-y-1.5"><Label className="text-xs">WhatsApp maintenance message</Label>
                      <Input value={planForm.maintenance_message}
                        onChange={e => setPlanForm(f => ({ ...f, maintenance_message: e.target.value }))}
                        placeholder="Hi {{name}}, your {{plan}} maintenance visit is due on {{date}}." />
                      <p className="text-[10px] text-muted-foreground">Use {"{{name}}"}, {"{{plan}}"}, {"{{date}}"}.</p>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={savePlan.isPending}>
                    {savePlan.isPending ? "Saving…" : (editingPlanId ? "Save Plan" : "Create Plan")}
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
                  <DialogDescription>Assign a plan and optionally create an invoice.</DialogDescription>
                </DialogHeader>
                <form onSubmit={e => { e.preventDefault(); enrollPatient.mutate(); }} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Patient *</Label>
                    <Select value={enrollForm.patient_id} onValueChange={v => setEnrollForm(f => ({ ...f, patient_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select patient…" /></SelectTrigger>
                      <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Plan *</Label>
                    <Select value={enrollForm.plan_id} onValueChange={v => setEnrollForm(f => ({ ...f, plan_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select plan…" /></SelectTrigger>
                      <SelectContent>{plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.plan_name} — Rs {p.amount}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <Label>Create invoice</Label>
                      <p className="text-xs text-muted-foreground">Auto-generate an unpaid invoice for the plan amount.</p>
                    </div>
                    <Switch checked={enrollForm.create_invoice} onCheckedChange={v => setEnrollForm(f => ({ ...f, create_invoice: v }))} />
                  </div>
                  <Button type="submit" className="w-full" disabled={enrollPatient.isPending || !enrollForm.patient_id || !enrollForm.plan_id}>
                    {enrollPatient.isPending ? "Enrolling…" : "Enroll Patient"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active</p><p className="text-2xl font-bold mt-1">{activeCount}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Expiring ≤30d</p><p className="text-2xl font-bold mt-1 text-amber-600">{expiringCount}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Expired</p><p className="text-2xl font-bold mt-1 text-destructive">{expiredCount}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-2xl font-bold mt-1 text-green-600">Rs {totalRevenue.toLocaleString()}</p></CardContent></Card>
        </div>

        {/* Revenue intelligence: MRR / Churn / LTV */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Membership revenue intelligence</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">MRR</p>
                <p className="text-xl font-bold font-mono">Rs {(metrics?.mrr ?? 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">ARR ≈ Rs {(metrics?.arr ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Churn (30d)</p>
                <p className={`text-xl font-bold font-mono ${(metrics?.churn_pct ?? 0) > 10 ? "text-destructive" : "text-foreground"}`}>{(metrics?.churn_pct ?? 0).toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground">{metrics?.churned_30d ?? 0} lost / 30d</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">LTV</p>
                <p className="text-xl font-bold font-mono">Rs {(metrics?.ltv ?? 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">avg lifespan {(metrics?.avg_lifetime_months ?? 0).toFixed(1)}mo</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">All-time</p>
                <p className="text-xl font-bold font-mono">Rs {(metrics?.lifetime_revenue ?? 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{metrics?.total_members_ever ?? 0} members ever</p>
              </div>
            </div>
          </CardContent>
        </Card>


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Plans */}
          <Card className="lg:col-span-1">
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
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm">{p.plan_name}</p>
                            <p className="text-xs text-muted-foreground">{p.duration_months} mo · {p.discount_percent}% off</p>
                            {p.benefits?.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5">{p.benefits.join(" · ")}</p>
                            )}
                          </div>
                          <p className="text-lg font-bold whitespace-nowrap">Rs {p.amount}</p>
                        </div>
                        <div className="flex justify-end gap-1 mt-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPlan(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm(`Delete plan "${p.plan_name}"?`)) deletePlan.mutate(p.id); }}>
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
          <Card className="lg:col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-base">Enrollments</h2>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-7 h-8 text-sm" placeholder="Search patient or plan…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-[150px] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expiring">Expiring ≤30d</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}</div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No enrollments match.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-xs border-b">
                        <th className="text-left py-2 font-medium">Patient</th>
                        <th className="text-left py-2 font-medium">Plan</th>
                        <th className="text-left py-2 font-medium">End</th>
                        <th className="text-left py-2 font-medium">Status</th>
                        <th className="text-left py-2 font-medium">Payment</th>
                        <th className="text-left py-2 font-medium">Next visit</th>
                        <th className="text-right py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((m: any) => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-2.5">
                            <div className="font-medium">{m.patients?.full_name || "—"}</div>
                            {m.patients?.phone && <div className="text-xs text-muted-foreground">{m.patients.phone}</div>}
                          </td>
                          <td className="py-2.5">{m.plan_name}<div className="text-xs text-muted-foreground">Rs {Number(m.amount).toLocaleString()}</div></td>
                          <td className="py-2.5">{m.end_date ? format(new Date(m.end_date), "dd MMM yyyy") : "—"}</td>
                          <td className="py-2.5">{statusBadge(m)}</td>
                          <td className="py-2.5">{paymentBadge(m)}</td>
                          <td className="py-2.5 text-xs">{m.next_maintenance_date ? format(new Date(m.next_maintenance_date), "dd MMM yyyy") : <span className="text-muted-foreground">—</span>}</td>
                          <td className="py-2.5">
                            <div className="flex gap-1 justify-end">
                              {(m.isExpiring || m.isExpired) && m.patients?.phone && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Send renewal reminder"
                                  onClick={() => sendRenewalReminder.mutate(m)}>
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {m.status === "active" && m.patients?.phone && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Send benefits card on WhatsApp"
                                  onClick={() => sendBenefitsCard.mutate(m)}>
                                  <Award className="h-3.5 w-3.5 text-primary" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Renew" onClick={() => renewMembership.mutate(m)}>
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => setEditEnroll(m)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {m.status !== "cancelled" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Cancel"
                                  onClick={() => { if (confirm("Cancel this membership?")) cancelMembership.mutate(m.id); }}>
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
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

        {upcomingMaintenance.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-base">Upcoming maintenance (next 30 days)</h2>
                <Badge variant="secondary" className="ml-auto">{upcomingMaintenance.length}</Badge>
              </div>
              <div className="space-y-1.5">
                {upcomingMaintenance.slice(0, 8).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
                    <div>
                      <span className="font-medium">{m.patients?.full_name || "—"}</span>
                      <span className="text-xs text-muted-foreground ml-2">{m.plan_name}</span>
                    </div>
                    <span className="text-xs font-medium">{format(new Date(m.next_maintenance_date), "dd MMM yyyy")}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {expiringCount > 0 && (
          <Card className="border-amber-200 bg-amber-50/40">
            <CardContent className="p-3 flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span><strong>{expiringCount}</strong> membership{expiringCount > 1 ? "s" : ""} expiring within 30 days. Daily auto-reminders run at 9 AM IST; use the chat icon for an instant nudge.</span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit enrollment */}
      <Dialog open={!!editEnroll} onOpenChange={(o) => !o && setEditEnroll(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Membership</DialogTitle>
            <DialogDescription>{editEnroll?.patients?.full_name}</DialogDescription>
          </DialogHeader>
          {editEnroll && (
            <form onSubmit={e => { e.preventDefault(); saveEnroll.mutate(); }} className="space-y-3">
              <div className="space-y-1.5"><Label>Plan name</Label>
                <Input value={editEnroll.plan_name || ""} onChange={e => setEditEnroll((p: any) => ({ ...p, plan_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Start date</Label>
                  <Input type="date" value={editEnroll.start_date || ""} onChange={e => setEditEnroll((p: any) => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5"><Label>End date</Label>
                  <Input type="date" value={editEnroll.end_date || ""} onChange={e => setEditEnroll((p: any) => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Amount</Label>
                  <Input type="number" value={editEnroll.amount ?? 0} onChange={e => setEditEnroll((p: any) => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="space-y-1.5"><Label>Status</Label>
                  <Select value={editEnroll.status} onValueChange={v => setEditEnroll((p: any) => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Next maintenance date</Label>
                <Input type="date" value={editEnroll.next_maintenance_date || ""}
                  onChange={e => setEditEnroll((p: any) => ({ ...p, next_maintenance_date: e.target.value }))} />
                {editEnroll.paymentStatus && (
                  <p className="text-xs text-muted-foreground">Linked invoice status: <strong className="capitalize">{editEnroll.paymentStatus}</strong></p>
                )}
              </div>

              {Array.isArray(editEnroll.benefits) && editEnroll.benefits.length > 0 && (
                <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Benefit usage</p>
                    {editEnroll.patients?.phone && (
                      <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs"
                        onClick={() => sendBenefitsCard.mutate(editEnroll)}>
                        <Send className="h-3 w-3" /> Send card
                      </Button>
                    )}
                  </div>
                  {editEnroll.benefits.map((b: string) => {
                    const key = b.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
                    const used = (editEnroll.usage_counters || {})[key] || 0;
                    return (
                      <div key={key} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate flex-1">{b}</span>
                        <div className="flex items-center gap-1">
                          <Button type="button" size="icon" variant="outline" className="h-6 w-6"
                            onClick={async () => { await adjustUsage.mutateAsync({ m: editEnroll, key, delta: -1 }); setEditEnroll((p: any) => ({ ...p, usage_counters: { ...(p.usage_counters || {}), [key]: Math.max(0, used - 1) } })); }}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-mono text-sm w-6 text-center">{used}</span>
                          <Button type="button" size="icon" variant="outline" className="h-6 w-6"
                            onClick={async () => { await adjustUsage.mutateAsync({ m: editEnroll, key, delta: 1 }); setEditEnroll((p: any) => ({ ...p, usage_counters: { ...(p.usage_counters || {}), [key]: used + 1 } })); }}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {editEnroll.dunning_attempts > 0 && (
                    <p className="text-[11px] text-amber-700 pt-1 border-t">Dunning attempts: {editEnroll.dunning_attempts} / 3</p>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditEnroll(null)}>Cancel</Button>
                <Button type="submit" disabled={saveEnroll.isPending}>{saveEnroll.isPending ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
