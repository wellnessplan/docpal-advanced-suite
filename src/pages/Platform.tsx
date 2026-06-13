import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSuperAdmin } from "@/hooks/useSubscription";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Activity, Building2, Users, DollarSign, TrendingUp, Plus, Trash2, Shield,
  CheckCircle, PauseCircle, PlayCircle, UserPlus, Search, RefreshCw,
  CalendarIcon, ScrollText, Filter, Package, Sparkles, UserCheck, LineChart,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format, subDays, differenceInDays, startOfDay, endOfDay } from "date-fns";
import PlansTab from "./platform/PlansTab";
import AiApiTab from "./platform/AiApiTab";
import ClinicAiReportTab from "./platform/ClinicAiReportTab";
import RevenueTab from "./platform/RevenueTab";
import InvoicesTab from "./platform/InvoicesTab";
import GlobalSettingsTab from "./platform/GlobalSettingsTab";
import SupportInboxTab from "./platform/SupportInboxTab";
import AnnouncementsTab from "./platform/AnnouncementsTab";
import TenantHealthTab from "./platform/TenantHealthTab";

const STATUS_COLORS: Record<string, string> = {
  trial: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  active: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  trial_expired: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  expired: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  suspended: "bg-destructive/15 text-destructive border-destructive/30",
  no_subscription: "bg-muted text-muted-foreground border-border",
};

const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  clinic_create: { label: "Clinic created", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  clinic_activate: { label: "Clinic activated", tone: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30" },
  clinic_suspend: { label: "Clinic suspended", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  admin_grant: { label: "Super admin granted", tone: "bg-primary/15 text-primary border-primary/30" },
  admin_revoke: { label: "Super admin revoked", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
};

export default function PlatformConsole() {
  const { session, profile } = useAuth();
  const { data: isSuperAdmin, isLoading: checkingAdmin } = useSuperAdmin();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // ---- Usage filters ----
  const [usageFrom, setUsageFrom] = useState<Date>(subDays(new Date(), 30));
  const [usageTo, setUsageTo] = useState<Date>(new Date());
  const [usageStatus, setUsageStatus] = useState<string>("all");

  // ---------- Audit helper ----------
  const logAudit = async (entry: {
    action: string;
    target_type: string;
    target_id?: string | null;
    target_label?: string | null;
    details?: Record<string, any>;
  }) => {
    if (!session?.user?.id) return;
    await (supabase.from("platform_audit_log" as any) as any).insert({
      actor_user_id: session.user.id,
      actor_name: profile?.full_name || session.user.email || "Unknown admin",
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id ?? null,
      target_label: entry.target_label ?? null,
      details: entry.details ?? {},
    });
  };

  // ---------- Queries ----------
  const { data: clinics = [], isLoading: clinicsLoading } = useQuery({
    queryKey: ["platform-clinics"],
    queryFn: async () => {
      const [c, s, p, st, i] = await Promise.all([
        supabase.from("clinics").select("id, name, email, phone, created_at").order("created_at", { ascending: false }),
        supabase.from("clinic_subscriptions" as any).select("*"),
        supabase.from("patients").select("clinic_id, created_at"),
        supabase.from("profiles").select("clinic_id"),
        supabase.from("invoices").select("clinic_id, total, paid_amount, created_at"),
      ]);
      const subMap = new Map((s.data || []).map((x: any) => [x.clinic_id, x]));
      const pCount = new Map<string, number>();
      const sCount = new Map<string, number>();
      const rev = new Map<string, number>();
      (p.data || []).forEach((r: any) => pCount.set(r.clinic_id, (pCount.get(r.clinic_id) || 0) + 1));
      (st.data || []).forEach((r: any) => r.clinic_id && sCount.set(r.clinic_id, (sCount.get(r.clinic_id) || 0) + 1));
      (i.data || []).forEach((r: any) => rev.set(r.clinic_id, (rev.get(r.clinic_id) || 0) + Number(r.paid_amount || 0)));
      return (c.data || []).map((cl: any) => ({
        ...cl,
        subscription: subMap.get(cl.id),
        patient_count: pCount.get(cl.id) || 0,
        staff_count: sCount.get(cl.id) || 0,
        revenue: rev.get(cl.id) || 0,
      }));
    },
    enabled: !!isSuperAdmin,
  });

  const getStatus = (sub: any) => {
    if (!sub) return "no_subscription";
    if (sub.status === "trial" && sub.trial_ends_at && new Date(sub.trial_ends_at) <= new Date()) return "trial_expired";
    return sub.status;
  };

  // Build set of clinic ids matching the usage status filter
  const usageClinicIdSet = useMemo(() => {
    if (usageStatus === "all") return null;
    return new Set(clinics.filter((c: any) => getStatus(c.subscription) === usageStatus).map((c: any) => c.id));
  }, [clinics, usageStatus]);

  const { data: activity = { signupsByDay: [], revenueByDay: [], totals: { dau: 0, wau: 0, mau: 0, totalRevenue: 0 } } } = useQuery({
    queryKey: ["platform-activity", usageFrom.toISOString(), usageTo.toISOString(), usageStatus, clinics.length],
    queryFn: async () => {
      const fromIso = startOfDay(usageFrom).toISOString();
      const toIso = endOfDay(usageTo).toISOString();
      const days = Math.max(1, differenceInDays(usageTo, usageFrom) + 1);

      const [appts, invoices, clinicsRes] = await Promise.all([
        supabase.from("appointments").select("clinic_id, created_at").gte("created_at", fromIso).lte("created_at", toIso),
        supabase.from("invoices").select("paid_amount, created_at, clinic_id").gte("created_at", fromIso).lte("created_at", toIso),
        supabase.from("clinics").select("id, created_at").gte("created_at", fromIso).lte("created_at", toIso),
      ]);

      const inFilter = (cid: string) => !usageClinicIdSet || usageClinicIdSet.has(cid);

      const signupsMap = new Map<string, number>();
      const revenueMap = new Map<string, number>();
      for (let i = days - 1; i >= 0; i--) {
        const day = format(subDays(usageTo, i), "MMM d");
        signupsMap.set(day, 0);
        revenueMap.set(day, 0);
      }
      (clinicsRes.data || []).forEach((r: any) => {
        if (!inFilter(r.id)) return;
        const k = format(new Date(r.created_at), "MMM d");
        if (signupsMap.has(k)) signupsMap.set(k, (signupsMap.get(k) || 0) + 1);
      });
      (invoices.data || []).forEach((r: any) => {
        if (!inFilter(r.clinic_id)) return;
        const k = format(new Date(r.created_at), "MMM d");
        if (revenueMap.has(k)) revenueMap.set(k, (revenueMap.get(k) || 0) + Number(r.paid_amount || 0));
      });

      const dayAgo = subDays(new Date(), 1);
      const weekAgo = subDays(new Date(), 7);
      const monthAgo = subDays(new Date(), 30);
      const dau = new Set<string>(), wau = new Set<string>(), mau = new Set<string>();
      (appts.data || []).forEach((r: any) => {
        if (!inFilter(r.clinic_id)) return;
        const t = new Date(r.created_at);
        if (t >= dayAgo) dau.add(r.clinic_id);
        if (t >= weekAgo) wau.add(r.clinic_id);
        if (t >= monthAgo) mau.add(r.clinic_id);
      });

      const totalRevenue = (invoices.data || [])
        .filter((r: any) => inFilter(r.clinic_id))
        .reduce((a: number, r: any) => a + Number(r.paid_amount || 0), 0);

      return {
        signupsByDay: Array.from(signupsMap.entries()).map(([day, signups]) => ({ day, signups })),
        revenueByDay: Array.from(revenueMap.entries()).map(([day, revenue]) => ({ day, revenue })),
        totals: { dau: dau.size, wau: wau.size, mau: mau.size, totalRevenue },
      };
    },
    enabled: !!isSuperAdmin && clinics.length >= 0,
  });

  const { data: admins = [] } = useQuery({
    queryKey: ["platform-admins"],
    queryFn: async () => {
      const { data: rows } = await supabase.from("super_admins" as any).select("id, user_id, created_at");
      if (!rows?.length) return [];
      const ids = rows.map((r: any) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name, phone").in("user_id", ids);
      const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
      return rows.map((r: any) => ({ ...r, profile: profMap.get(r.user_id) }));
    },
    enabled: !!isSuperAdmin,
  });

  const { data: auditEntries = [] } = useQuery({
    queryKey: ["platform-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_audit_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data as any[]) || [];
    },
    enabled: !!isSuperAdmin,
  });

  // ---------- Mutations ----------
  const updateStatus = useMutation({
    mutationFn: async ({ clinicId, status, name }: { clinicId: string; status: string; name: string }) => {
      const update: any = { status };
      if (status === "active") update.approved_at = new Date().toISOString();
      const { error } = await supabase.from("clinic_subscriptions" as any).update(update).eq("clinic_id", clinicId);
      if (error) throw error;
      await logAudit({
        action: status === "active" ? "clinic_activate" : "clinic_suspend",
        target_type: "clinic",
        target_id: clinicId,
        target_label: name,
        details: { new_status: status },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-clinics"] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createClinic = useMutation({
    mutationFn: async (input: { name: string; email: string; phone: string }) => {
      const { data: clinic, error } = await supabase.from("clinics").insert({
        name: input.name, email: input.email || null, phone: input.phone || null,
      }).select().single();
      if (error) throw error;
      const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 14);
      await supabase.from("clinic_subscriptions" as any).insert({
        clinic_id: clinic.id, status: "trial", trial_ends_at: trialEnd.toISOString(), plan_name: "basic",
      });
      await logAudit({
        action: "clinic_create",
        target_type: "clinic",
        target_id: clinic.id,
        target_label: clinic.name,
        details: { email: input.email, phone: input.phone, trial_ends_at: trialEnd.toISOString() },
      });
      return clinic;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-clinics"] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
      toast.success("Clinic created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addAdmin = useMutation({
    mutationFn: async (query: string) => {
      const { data: profs, error: pe } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(2);
      if (pe) throw pe;
      if (!profs || profs.length === 0) throw new Error("No user found matching that name/phone.");
      if (profs.length > 1) throw new Error("Multiple users matched — be more specific.");
      const { error } = await supabase.from("super_admins" as any).insert({ user_id: profs[0].user_id });
      if (error) throw error;
      await logAudit({
        action: "admin_grant",
        target_type: "user",
        target_id: profs[0].user_id,
        target_label: profs[0].full_name || profs[0].phone || "Unknown",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-admins"] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
      toast.success("Super admin added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeAdmin = useMutation({
    mutationFn: async (admin: { id: string; user_id: string; profile?: any }) => {
      const { error } = await supabase.from("super_admins" as any).delete().eq("id", admin.id);
      if (error) throw error;
      await logAudit({
        action: "admin_revoke",
        target_type: "user",
        target_id: admin.user_id,
        target_label: admin.profile?.full_name || admin.profile?.phone || "Unknown",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-admins"] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
      toast.success("Super admin removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const extendTrial = useMutation({
    mutationFn: async ({ clinicId, name, days, currentTrialEnd }: { clinicId: string; name: string; days: number; currentTrialEnd: string | null }) => {
      const base = currentTrialEnd && new Date(currentTrialEnd) > new Date()
        ? new Date(currentTrialEnd)
        : new Date();
      base.setDate(base.getDate() + days);
      const { error } = await supabase
        .from("clinic_subscriptions" as any)
        .update({ trial_ends_at: base.toISOString(), status: "trial" })
        .eq("clinic_id", clinicId);
      if (error) throw error;
      await logAudit({
        action: "trial_extended",
        target_type: "clinic",
        target_id: clinicId,
        target_label: name,
        details: { days, new_trial_end: base.toISOString() },
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["platform-clinics"] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
      toast.success(`Trial extended by ${v.days} days`);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const impersonate = useMutation({
    mutationFn: async ({ clinicId, name }: { clinicId: string; name: string }) => {
      const { error } = await (supabase.rpc as any)("start_impersonation", { p_clinic_id: clinicId });
      if (error) throw error;
      return name;
    },
    onSuccess: (name) => {
      toast.success(`Impersonating ${name}. Redirecting…`);
      setTimeout(() => window.location.assign("/dashboard"), 400);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to start impersonation"),
  });

  // ---------- Derived ----------
  const filtered = useMemo(() => clinics.filter((c: any) => {
    const s = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    const status = getStatus(c.subscription);
    const ms = statusFilter === "all" || status === statusFilter;
    return s && ms;
  }), [clinics, search, statusFilter]);

  const stats = useMemo(() => ({
    total: clinics.length,
    active: clinics.filter((c: any) => getStatus(c.subscription) === "active").length,
    trial: clinics.filter((c: any) => getStatus(c.subscription) === "trial").length,
    suspended: clinics.filter((c: any) => getStatus(c.subscription) === "suspended").length,
    totalPatients: clinics.reduce((a: number, c: any) => a + c.patient_count, 0),
    totalRevenue: clinics.reduce((a: number, c: any) => a + c.revenue, 0),
  }), [clinics]);

  const setUsagePreset = (days: number) => {
    setUsageTo(new Date());
    setUsageFrom(subDays(new Date(), days));
  };

  // ---------- Guards ----------
  if (checkingAdmin) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground animate-pulse">Verifying access…</div>;
  }
  if (!session) return <Navigate to="/auth" replace />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Platform Console</h1>
              <p className="text-sm text-muted-foreground">Monitor usage, manage clinics & super-admins across the platform</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Kpi icon={Building2} label="Clinics" value={stats.total} accent="text-primary" />
          <Kpi icon={CheckCircle} label="Active" value={stats.active} accent="text-green-600" />
          <Kpi icon={PlayCircle} label="On Trial" value={stats.trial} accent="text-blue-600" />
          <Kpi icon={PauseCircle} label="Suspended" value={stats.suspended} accent="text-destructive" />
          <Kpi icon={Users} label="Patients" value={stats.totalPatients} accent="text-foreground" />
          <Kpi icon={DollarSign} label="Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} accent="text-foreground" />
        </div>

        <Tabs defaultValue="usage" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="revenue"><LineChart className="h-3.5 w-3.5 mr-1" />Revenue</TabsTrigger>
            <TabsTrigger value="clinics"><Building2 className="h-3.5 w-3.5 mr-1" />Centers</TabsTrigger>
            <TabsTrigger value="health">Tenant Health</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="plans"><Package className="h-3.5 w-3.5 mr-1" />Plans</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles className="h-3.5 w-3.5 mr-1" />AI & API</TabsTrigger>
            <TabsTrigger value="ai-report">AI Report</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
            <TabsTrigger value="settings">Global Settings</TabsTrigger>
            <TabsTrigger value="admins">Super Admins</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue"><RevenueTab /></TabsContent>
          <TabsContent value="health"><TenantHealthTab /></TabsContent>
          <TabsContent value="invoices"><InvoicesTab /></TabsContent>
          <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>
          <TabsContent value="support"><SupportInboxTab /></TabsContent>
          <TabsContent value="settings"><GlobalSettingsTab /></TabsContent>



          {/* USAGE */}
          <TabsContent value="usage" className="space-y-4">
            {/* Filters bar */}
            <Card>
              <CardContent className="p-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
                  <Filter className="h-3.5 w-3.5" /> Filters
                </div>
                <DatePickerButton label="From" date={usageFrom} onChange={setUsageFrom} />
                <DatePickerButton label="To" date={usageTo} onChange={setUsageTo} />
                <Select value={usageStatus} onValueChange={setUsageStatus}>
                  <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clinic statuses</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="trial_expired">Trial expired</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1 ml-auto">
                  <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setUsagePreset(7)}>7d</Button>
                  <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setUsagePreset(30)}>30d</Button>
                  <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setUsagePreset(90)}>90d</Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Kpi icon={TrendingUp} label="Active today (DAU)" value={activity.totals.dau} accent="text-primary" />
              <Kpi icon={TrendingUp} label="Active this week (WAU)" value={activity.totals.wau} accent="text-primary" />
              <Kpi icon={TrendingUp} label="Active this month (MAU)" value={activity.totals.mau} accent="text-primary" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    New clinic signups
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {format(usageFrom, "MMM d")} – {format(usageTo, "MMM d")}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={activity.signupsByDay}>
                      <defs>
                        <linearGradient id="cs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(activity.signupsByDay.length / 8))} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Area type="monotone" dataKey="signups" stroke="hsl(var(--primary))" fill="url(#cs)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Platform revenue
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Total: ₹{activity.totals.totalRevenue.toLocaleString()}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={activity.revenueByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(activity.revenueByDay.length / 8))} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => `₹${Number(v).toLocaleString()}`} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Top 10 clinics by revenue (all-time)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[...clinics].sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 10)} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => `₹${Number(v).toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CLINICS */}
          <TabsContent value="clinics" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search clinic name or email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="trial_expired">Trial expired</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <CreateClinicDialog onSubmit={(d) => createClinic.mutate(d)} loading={createClinic.isPending} />
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Clinic</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Patients</TableHead>
                      <TableHead className="text-right">Staff</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="hidden md:table-cell">Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clinicsLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No clinics found</TableCell></TableRow>
                    ) : filtered.map((c: any) => {
                      const status = getStatus(c.subscription);
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">{c.email || c.phone || "—"}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_COLORS[status]}>{status.replace("_", " ")}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{c.patient_count}</TableCell>
                          <TableCell className="text-right">{c.staff_count}</TableCell>
                          <TableCell className="text-right font-medium">₹{c.revenue.toLocaleString()}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, yyyy")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {status !== "active" && (
                                <Button size="sm" variant="outline" className="h-8 text-xs text-green-600"
                                  onClick={() => updateStatus.mutate({ clinicId: c.id, status: "active", name: c.name })}>
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />Activate
                                </Button>
                              )}
                              {(status === "trial" || status === "trial_expired") && (
                                <Select onValueChange={(v) => extendTrial.mutate({
                                  clinicId: c.id, name: c.name, days: Number(v),
                                  currentTrialEnd: c.subscription?.trial_ends_at ?? null,
                                })}>
                                  <SelectTrigger className="h-8 w-[110px] text-xs">
                                    <SelectValue placeholder="Extend…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="7">+7 days</SelectItem>
                                    <SelectItem value="14">+14 days</SelectItem>
                                    <SelectItem value="30">+30 days</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              {status !== "suspended" && (
                                <Button size="sm" variant="outline" className="h-8 text-xs text-destructive"
                                  onClick={() => updateStatus.mutate({ clinicId: c.id, status: "suspended", name: c.name })}>
                                  <PauseCircle className="h-3.5 w-3.5 mr-1" />Suspend
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-8 text-xs"
                                onClick={() => impersonate.mutate({ clinicId: c.id, name: c.name })}
                                disabled={impersonate.isPending}
                                title="Sign in as a user of this clinic (logged)">
                                <UserCheck className="h-3.5 w-3.5 mr-1" />Impersonate
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PLANS */}
          <TabsContent value="plans" className="space-y-4">
            <PlansTab />
          </TabsContent>

          {/* AI & API */}
          <TabsContent value="ai" className="space-y-4">
            <AiApiTab />
          </TabsContent>

          <TabsContent value="ai-report" className="space-y-4">
            <ClinicAiReportTab />
          </TabsContent>


          {/* SUPER ADMINS */}
          <TabsContent value="admins" className="space-y-4">
            <AddAdminCard onAdd={(email) => addAdmin.mutate(email)} loading={addAdmin.isPending} />

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" />Active super admins ({admins.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="hidden md:table-cell">Granted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No super admins yet</TableCell></TableRow>
                    ) : admins.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.profile?.full_name || "Unknown user"}</TableCell>
                        <TableCell className="text-muted-foreground">{a.profile?.phone || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{format(new Date(a.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 text-destructive">
                                <Trash2 className="h-3.5 w-3.5 mr-1" />Revoke
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke super admin access?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {a.profile?.full_name || "This user"} will lose access to the Platform Console immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeAdmin.mutate(a)}>Revoke</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AUDIT LOG */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ScrollText className="h-4 w-4" />
                  Platform Console activity ({auditEntries.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditEntries.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No actions logged yet</TableCell></TableRow>
                    ) : auditEntries.map((e: any) => {
                      const meta = ACTION_LABELS[e.action] || { label: e.action, tone: "bg-muted text-muted-foreground border-border" };
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(e.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{e.target_label || "—"}</div>
                            <div className="text-xs text-muted-foreground capitalize">{e.target_type}</div>
                          </TableCell>
                          <TableCell className="text-sm">{e.actor_name || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold mt-0.5 truncate">{value}</p>
          </div>
          <Icon className={`h-5 w-5 shrink-0 ${accent}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function DatePickerButton({ label, date, onChange }: { label: string; date: Date; onChange: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 text-xs justify-start font-normal min-w-[140px]")}>
          <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
          <span className="text-muted-foreground mr-1">{label}:</span>
          {format(date, "MMM d, yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onChange(d)}
          disabled={(d) => d > new Date()}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function CreateClinicDialog({ onSubmit, loading }: { onSubmit: (d: { name: string; email: string; phone: string }) => void; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const submit = () => {
    if (!form.name.trim()) return toast.error("Clinic name is required");
    onSubmit(form);
    setForm({ name: "", email: "", phone: "" });
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />New clinic</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create clinic</DialogTitle>
          <DialogDescription>This creates an empty clinic with a 14-day trial subscription.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAdminCard({ onAdd, loading }: { onAdd: (q: string) => void; loading: boolean }) {
  const [query, setQuery] = useState("");
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" />Grant super admin access</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Search by full name or phone (must already have an account)"
            value={query} onChange={e => setQuery(e.target.value)} className="flex-1" />
          <Button onClick={() => { if (!query.trim()) return toast.error("Enter a name or phone"); onAdd(query.trim()); setQuery(""); }} disabled={loading}>
            {loading ? "Granting…" : "Grant access"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">User must already be signed up. Search must match exactly one profile.</p>
      </CardContent>
    </Card>
  );
}
