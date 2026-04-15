import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Package, ArrowRight, CheckCircle2, Phone, MessageCircle,
  Search, Filter, Loader2, Calendar, Palette
} from "lucide-react";

const STATUS_FLOW = ["draft", "dispatched", "in_progress", "ready", "delivered", "cemented"] as const;
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", dispatched: "Dispatched", in_progress: "In Progress",
  ready: "Ready", delivered: "Delivered", cemented: "Cemented",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  dispatched: "bg-primary/10 text-primary",
  in_progress: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  ready: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  cemented: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
};

const WORK_TYPES = ["Crown", "Bridge", "RPD", "Denture", "Aligner", "Veneer", "Inlay/Onlay", "Night Guard", "Other"];
const SHADE_OPTIONS = ["A1", "A2", "A3", "A3.5", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D2", "D3", "D4", "BL1", "BL2", "BL3", "BL4", "Custom"];

export default function LabOrdersPage() {
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    patient_id: "", lab_directory_id: "", work_type: "Crown", shade: "",
    item_description: "", lab_name: "", cost: "", sent_date: new Date().toISOString().split("T")[0],
    expected_date: "", special_instructions: "", notes: "",
  });

  // Fetch lab orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["lab-orders-all", clinicId, statusFilter],
    queryFn: async () => {
      let q = supabase.from("lab_orders")
        .select("*, patients(full_name, phone)")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Fetch patients for dropdown
  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("id, full_name, phone")
        .eq("clinic_id", clinicId!).order("full_name");
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Fetch lab directory
  const { data: labs = [] } = useQuery({
    queryKey: ["lab-directory", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("lab_directory").select("*")
        .eq("clinic_id", clinicId!).order("lab_name");
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Create order
  const createOrder = useMutation({
    mutationFn: async () => {
      if (!form.patient_id) throw new Error("Select a patient");
      if (!form.item_description && !form.work_type) throw new Error("Describe the work");
      
      const selectedLab = labs.find((l: any) => l.id === form.lab_directory_id);
      const { error } = await supabase.from("lab_orders").insert({
        clinic_id: clinicId,
        patient_id: form.patient_id,
        lab_directory_id: form.lab_directory_id || null,
        lab_name: selectedLab?.lab_name || form.lab_name || null,
        item_description: form.item_description || form.work_type,
        work_type: form.work_type,
        shade: form.shade || null,
        cost: form.cost ? Number(form.cost) : selectedLab?.default_cost || 0,
        sent_date: form.sent_date || null,
        expected_date: form.expected_date || null,
        special_instructions: form.special_instructions || null,
        notes: form.notes || null,
        status: "draft",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders-all"] });
      setShowCreate(false);
      setForm({
        patient_id: "", lab_directory_id: "", work_type: "Crown", shade: "",
        item_description: "", lab_name: "", cost: "", sent_date: new Date().toISOString().split("T")[0],
        expected_date: "", special_instructions: "", notes: "",
      });
      toast.success("Lab order created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Advance status
  const advanceStatus = useMutation({
    mutationFn: async (order: any) => {
      const currentIdx = STATUS_FLOW.indexOf(order.status);
      if (currentIdx >= STATUS_FLOW.length - 1) return;
      const nextStatus = STATUS_FLOW[currentIdx + 1];
      const updates: any = { status: nextStatus };
      
      if (nextStatus === "dispatched") updates.sent_date = new Date().toISOString().split("T")[0];
      if (nextStatus === "delivered") {
        updates.actual_delivery_date = new Date().toISOString().split("T")[0];
        updates.received_date = new Date().toISOString().split("T")[0];
        // Auto-create daily todo
        const patient = (order as any).patients;
        await supabase.from("daily_todos").insert({
          clinic_id: clinicId,
          patient_id: order.patient_id,
          task_type: "LAB_READY",
          message: `${order.work_type || order.item_description} for ${patient?.full_name || "Patient"} — Call to book cementation`,
          priority: "high",
          patient_name: patient?.full_name,
          patient_phone: patient?.phone,
        } as any);
      }
      if (nextStatus === "cemented") updates.fitted_date = new Date().toISOString().split("T")[0];
      
      const { error } = await supabase.from("lab_orders").update(updates).eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders-all"] });
      queryClient.invalidateQueries({ queryKey: ["daily-todos"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Select lab → auto-fill
  const handleLabSelect = (labId: string) => {
    const lab = labs.find((l: any) => l.id === labId) as any;
    if (lab) {
      const expectedDate = lab.default_tat_days
        ? new Date(Date.now() + lab.default_tat_days * 86400000).toISOString().split("T")[0]
        : "";
      setForm(f => ({
        ...f,
        lab_directory_id: labId,
        lab_name: lab.lab_name,
        cost: lab.default_cost?.toString() || f.cost,
        expected_date: expectedDate || f.expected_date,
      }));
    }
  };

  // Filter by search
  const filteredOrders = orders.filter((o: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.patients?.full_name?.toLowerCase().includes(s) ||
      o.item_description?.toLowerCase().includes(s) ||
      o.lab_name?.toLowerCase().includes(s) ||
      o.work_type?.toLowerCase().includes(s)
    );
  });

  // Stats
  const stats = {
    total: orders.length,
    pending: orders.filter((o: any) => ["draft", "dispatched", "in_progress"].includes(o.status)).length,
    ready: orders.filter((o: any) => o.status === "ready" || o.status === "delivered").length,
    cemented: orders.filter((o: any) => o.status === "cemented").length,
  };

  if (!clinicId) return <DashboardLayout><p className="text-muted-foreground">No clinic found.</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Lab Orders</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Manage lab work orders and track status</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Order</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Lab Order</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Patient */}
                <div className="space-y-2">
                  <Label>Patient *</Label>
                  <Select value={form.patient_id} onValueChange={v => setForm(f => ({ ...f, patient_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent>
                      {patients.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name} {p.phone ? `(${p.phone})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Lab + Work Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Lab</Label>
                    <Select value={form.lab_directory_id} onValueChange={handleLabSelect}>
                      <SelectTrigger><SelectValue placeholder="Select lab" /></SelectTrigger>
                      <SelectContent>
                        {labs.map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>{l.lab_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Work Type</Label>
                    <Select value={form.work_type} onValueChange={v => setForm(f => ({ ...f, work_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WORK_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description + Shade */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={form.item_description} onChange={e => setForm(f => ({ ...f, item_description: e.target.value }))} placeholder="e.g. PFM Crown #16" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Palette className="w-3 h-3" /> Shade</Label>
                    <Select value={form.shade} onValueChange={v => setForm(f => ({ ...f, shade: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select shade" /></SelectTrigger>
                      <SelectContent>
                        {SHADE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dates + Cost */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Dispatch Date</Label>
                    <Input type="date" value={form.sent_date} onChange={e => setForm(f => ({ ...f, sent_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected Delivery</Label>
                    <Input type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cost (Rs )</Label>
                    <Input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
                  </div>
                </div>

                {/* Special Instructions */}
                <div className="space-y-2">
                  <Label>Special Instructions</Label>
                  <Textarea value={form.special_instructions} onChange={e => setForm(f => ({ ...f, special_instructions: e.target.value }))} rows={2} placeholder="e.g. Occlusal contacts to be verified" />
                </div>

                <Button className="w-full" onClick={() => createOrder.mutate()} disabled={createOrder.isPending || !form.patient_id}>
                  <Package className="h-4 w-4 mr-2" />{createOrder.isPending ? "Creating..." : "Create Lab Order"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Orders", value: stats.total, color: "text-foreground" },
            { label: "Pending", value: stats.pending, color: "text-yellow-600" },
            { label: "Ready/Delivered", value: stats.ready, color: "text-green-600" },
            { label: "Cemented", value: stats.cemented, color: "text-emerald-600" },
          ].map(s => (
            <Card key={s.label} className="shadow-card border-0">
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold font-heading ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, lab, work type..." className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="w-4 h-4 mr-2" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_FLOW.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Orders list */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filteredOrders.length === 0 ? (
          <Card className="shadow-card border-0">
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No lab orders found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order: any) => {
              const currentIdx = STATUS_FLOW.indexOf(order.status);
              const canAdvance = currentIdx < STATUS_FLOW.length - 1;
              const patient = order.patients;
              const isOverdue = order.expected_date && order.expected_date < new Date().toISOString().split("T")[0] && !["delivered", "cemented"].includes(order.status);

              return (
                <Card key={order.id} className={`shadow-card border-0 ${isOverdue ? "border-l-4 border-l-destructive" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{patient?.full_name || "Unknown"}</span>
                          <Badge variant="outline" className="text-[10px]">{order.work_type || "Lab Work"}</Badge>
                          {order.shade && <Badge variant="secondary" className="text-[10px] gap-1"><Palette className="w-2.5 h-2.5" />{order.shade}</Badge>}
                          {isOverdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {order.item_description} · {order.lab_name || "No lab"}
                          {order.cost > 0 ? ` · Rs ${Number(order.cost).toLocaleString()}` : ""}
                        </p>

                        {/* Status pipeline */}
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {STATUS_FLOW.map((s, i) => (
                            <div key={s} className="flex items-center gap-0.5">
                              <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ${i <= currentIdx ? STATUS_COLORS[s] : "bg-muted text-muted-foreground/30"}`}>
                                {i <= currentIdx && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                                {STATUS_LABELS[s]}
                              </Badge>
                              {i < STATUS_FLOW.length - 1 && <span className="text-muted-foreground/20 text-[10px]">→</span>}
                            </div>
                          ))}
                        </div>

                        {/* Dates */}
                        <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                          {order.sent_date && <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />Sent: {order.sent_date}</span>}
                          {order.expected_date && <span>Expected: {order.expected_date}</span>}
                          {order.actual_delivery_date && <span>Delivered: {order.actual_delivery_date}</span>}
                          {order.fitted_date && <span>Cemented: {order.fitted_date}</span>}
                        </div>
                        {order.special_instructions && (
                          <p className="text-[10px] text-muted-foreground mt-1 italic">📋 {order.special_instructions}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        {canAdvance && (
                          <Button size="sm" onClick={() => advanceStatus.mutate(order)} disabled={advanceStatus.isPending} className="text-xs h-7">
                            <ArrowRight className="h-3 w-3 mr-1" />
                            {STATUS_LABELS[STATUS_FLOW[currentIdx + 1]]}
                          </Button>
                        )}
                        {patient?.phone && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(`tel:${patient.phone}`)}>
                              <Phone className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                              const phone = patient.phone.replace(/[^0-9]/g, "");
                              window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Your ${order.work_type || "lab work"} is ready. Please call to schedule your appointment.`)}`, "_blank");
                            }}>
                              <MessageCircle className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
