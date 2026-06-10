import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, ClipboardList, BellRing, FlaskConical, PackageX,
  TrendingUp, Percent, Calculator, Coins, CreditCard, Wallet,
  HandCoins, CalendarClock, AlertTriangle, Wrench, Bell, Briefcase,
  Stethoscope, Plus, FileText,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import ProfileCompletionModal from "@/components/ProfileCompletionModal";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";
import ProductTour from "@/components/onboarding/ProductTour";
import { format } from "date-fns";

const statusStyle: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-700 border-sky-200",
  confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  arrived: "bg-emerald-100 text-emerald-700 border-emerald-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
  no_show: "bg-slate-200 text-slate-600 border-slate-300",
};

type TileProps = {
  label: string;
  value: string | number;
  icon: any;
  tone: string;
  onClick?: () => void;
  cta?: { label: string; onClick: (e: React.MouseEvent) => void };
};

function KpiTile({ label, value, icon: Icon, tone, onClick, cta }: TileProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative text-left rounded-2xl border border-white/60 backdrop-blur-xl p-4 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.15)] transition-all hover:shadow-[0_8px_28px_-6px_rgba(15,23,42,0.22)] hover:-translate-y-0.5 ${tone}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider font-medium text-slate-600/80">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 font-mono leading-tight truncate">{value}</p>
        </div>
        <div className="shrink-0 h-10 w-10 rounded-xl bg-white/70 flex items-center justify-center shadow-inner">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>
      {cta && (
        <span
          onClick={cta.onClick}
          className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-white/80 text-slate-700 border border-white shadow-sm hover:bg-white"
        >
          {cta.label}
        </span>
      )}
    </button>
  );
}

export default function DashboardPage() {
  const { profile, clinicId } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const { data: clinic } = useQuery({
    queryKey: ["dash-clinic", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("id,name,address").eq("id", clinicId!).maybeSingle();
      return data;
    },
    enabled: !!clinicId,
  });

  // ===== Appointments today =====
  const { data: appointments = [] } = useQuery({
    queryKey: ["dash-appts", clinicId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, patients(full_name,phone,gender,date_of_birth), provider:profiles!appointments_provider_id_fkey(full_name)")
        .eq("clinic_id", clinicId!)
        .eq("appointment_date", today)
        .order("appointment_time", { ascending: true });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // ===== KPI queries =====
  const { data: pendingTreatments = 0 } = useQuery({
    queryKey: ["dash-pending-tx", clinicId],
    queryFn: async () => {
      const { count } = await supabase.from("treatment_plans")
        .select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId!).in("status", ["draft", "proposed", "accepted", "in_progress"]);
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  const { data: recallsDue = 0 } = useQuery({
    queryKey: ["dash-recalls", clinicId, today],
    queryFn: async () => {
      const { count } = await supabase.from("recall_reminders")
        .select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId!).lte("recall_date", today).neq("status", "completed");
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  const { data: activeLabs = 0 } = useQuery({
    queryKey: ["dash-labs", clinicId],
    queryFn: async () => {
      const { count } = await supabase.from("lab_orders")
        .select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId!).not("status", "in", "(delivered,cemented,cancelled)");
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  const { data: stockAlerts = 0 } = useQuery({
    queryKey: ["dash-stock", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_items")
        .select("current_stock,reorder_level").eq("clinic_id", clinicId!);
      return (data ?? []).filter((i: any) => Number(i.current_stock) <= Number(i.reorder_level || 0)).length;
    },
    enabled: !!clinicId,
  });

  // Invoices today + MTD
  const { data: invoicesToday = [] } = useQuery({
    queryKey: ["dash-inv-today", clinicId, today],
    queryFn: async () => {
      const { data } = await supabase.from("invoices")
        .select("total,paid_amount,balance,status")
        .eq("clinic_id", clinicId!)
        .gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: invoicesMtd = [] } = useQuery({
    queryKey: ["dash-inv-mtd", clinicId, monthStart],
    queryFn: async () => {
      const { data } = await supabase.from("invoices")
        .select("total,paid_amount,balance,status,created_at")
        .eq("clinic_id", clinicId!).gte("created_at", `${monthStart}T00:00:00`);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: allOpenInvoices = [] } = useQuery({
    queryKey: ["dash-inv-open", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices")
        .select("balance,status").eq("clinic_id", clinicId!).neq("status", "paid");
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: expensesMtd = [] } = useQuery({
    queryKey: ["dash-exp-mtd", clinicId, monthStart],
    queryFn: async () => {
      const { data } = await supabase.from("expenses")
        .select("amount,expense_date").eq("clinic_id", clinicId!).gte("expense_date", monthStart);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Year breakdown for monthly table
  const { data: invoicesYear = [] } = useQuery({
    queryKey: ["dash-inv-year", clinicId, yearStart],
    queryFn: async () => {
      const { data } = await supabase.from("invoices")
        .select("total,created_at").eq("clinic_id", clinicId!).gte("created_at", `${yearStart}T00:00:00`);
      return data ?? [];
    },
    enabled: !!clinicId,
  });
  const { data: expensesYear = [] } = useQuery({
    queryKey: ["dash-exp-year", clinicId, yearStart],
    queryFn: async () => {
      const { data } = await supabase.from("expenses")
        .select("amount,expense_date").eq("clinic_id", clinicId!).gte("expense_date", yearStart);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // Doctors performance MTD
  const { data: doctors = [] } = useQuery({
    queryKey: ["dash-doctors", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("id,full_name,role").eq("clinic_id", clinicId!).in("role", ["owner", "dentist"]);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: doctorTxCounts = [] } = useQuery({
    queryKey: ["dash-doc-tx", clinicId, monthStart],
    queryFn: async () => {
      const { data } = await supabase.from("appointments")
        .select("provider_id,status,appointment_date")
        .eq("clinic_id", clinicId!).gte("appointment_date", monthStart).eq("status", "completed");
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  // ===== Computed =====
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const patientsToday = new Set(appointments.map((a: any) => a.patient_id)).size;

  const revenueToday = invoicesToday.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const paidToday = invoicesToday.reduce((s: number, i: any) => s + Number(i.paid_amount || 0), 0);
  const collectionRate = revenueToday > 0 ? (paidToday / revenueToday) * 100 : 0;

  const avgTreatment = invoicesMtd.length
    ? invoicesMtd.reduce((s: number, i: any) => s + Number(i.total || 0), 0) / invoicesMtd.length
    : 0;
  const revenueMtd = invoicesMtd.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const expMtd = expensesMtd.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const netProfitMtd = revenueMtd - expMtd;
  const outstanding = allOpenInvoices.reduce((s: number, i: any) => s + Number(i.balance || 0), 0);

  // Monthly table
  const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthlyRows = monthLabels.map((label, idx) => {
    const rev = invoicesYear
      .filter((i: any) => new Date(i.created_at).getMonth() === idx)
      .reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const exp = expensesYear
      .filter((e: any) => new Date(e.expense_date).getMonth() === idx)
      .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const net = rev - exp;
    const margin = rev > 0 ? (net / rev) * 100 : 0;
    return { label, rev, exp, net, margin };
  });

  // Doctor stats
  const doctorStats = doctors.map((d: any) => {
    const treatments = doctorTxCounts.filter((a: any) => a.provider_id === d.id).length;
    return { ...d, treatments, rate: "10%" };
  }).sort((a: any, b: any) => b.treatments - a.treatments);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Morning";
    if (h < 17) return "Afternoon";
    return "Evening";
  })();

  const calcAge = (dob: string | null) => {
    if (!dob) return "-";
    return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
  };

  // Tile palette (pastel glass)
  const tiles: TileProps[] = [
    { label: "Patients Today", value: patientsToday, icon: Users, tone: "bg-gradient-to-br from-sky-50 to-blue-100/60", onClick: () => navigate("/patients"),
      cta: { label: "+ Add Patient", onClick: (e) => { e.stopPropagation(); navigate("/patients?new=1"); } } },
    { label: "Pending Treatment", value: pendingTreatments, icon: ClipboardList, tone: "bg-gradient-to-br from-violet-50 to-purple-100/60", onClick: () => navigate("/treatment-plans") },
    { label: "Recalls Due", value: recallsDue, icon: BellRing, tone: "bg-gradient-to-br from-rose-50 to-pink-100/60", onClick: () => navigate("/patients"),
      cta: { label: "Send SMS", onClick: (e) => { e.stopPropagation(); navigate("/whatsapp"); } } },
    { label: "Active Lab Cases", value: activeLabs, icon: FlaskConical, tone: "bg-gradient-to-br from-emerald-50 to-teal-100/60", onClick: () => navigate("/lab-orders") },

    { label: "Stock Alerts", value: stockAlerts, icon: PackageX, tone: "bg-gradient-to-br from-orange-50 to-amber-100/60", onClick: () => navigate("/inventory"),
      cta: { label: "View Inventory", onClick: (e) => { e.stopPropagation(); navigate("/inventory"); } } },
    { label: "Revenue Today", value: fmt(revenueToday), icon: TrendingUp, tone: "bg-gradient-to-br from-indigo-50 to-blue-100/60", onClick: () => navigate("/billing") },
    { label: "Collection Rate", value: `${collectionRate.toFixed(1)}%`, icon: Percent, tone: "bg-gradient-to-br from-cyan-50 to-sky-100/60", onClick: () => navigate("/billing") },
    { label: "Avg. Treatment", value: fmt(avgTreatment), icon: Calculator, tone: "bg-gradient-to-br from-slate-50 to-gray-100/60", onClick: () => navigate("/billing") },

    { label: "Revenue MTD", value: fmt(revenueMtd), icon: Coins, tone: "bg-gradient-to-br from-amber-50 to-yellow-100/60", onClick: () => navigate("/finance") },
    { label: "Expenses MTD", value: fmt(expMtd), icon: CreditCard, tone: "bg-gradient-to-br from-fuchsia-50 to-pink-100/60", onClick: () => navigate("/finance") },
    { label: "Net Profit MTD", value: fmt(netProfitMtd), icon: Wallet, tone: "bg-gradient-to-br from-green-50 to-emerald-100/60", onClick: () => navigate("/finance") },
    { label: "Outstanding Dues", value: fmt(outstanding), icon: HandCoins, tone: "bg-gradient-to-br from-blue-50 to-indigo-100/60", onClick: () => navigate("/billing") },
  ];

  const priorityAlerts = [
    { color: "border-l-rose-500 bg-rose-50/60 text-rose-700", icon: FileText, label: `Overdue Invoices — ${allOpenInvoices.length} unpaid invoices · ${fmt(outstanding)}`, onClick: () => navigate("/billing") },
    { color: "border-l-amber-500 bg-amber-50/60 text-amber-700", icon: AlertTriangle, label: `Critical Stock — ${stockAlerts} items below reorder`, onClick: () => navigate("/inventory") },
    { color: "border-l-yellow-500 bg-yellow-50/60 text-yellow-700", icon: Wrench, label: "Equipment Overdue — review maintenance", onClick: () => navigate("/settings") },
    { color: "border-l-sky-500 bg-sky-50/60 text-sky-700", icon: Bell, label: `Recalls Due — ${recallsDue} patients`, onClick: () => navigate("/patients") },
    { color: "border-l-violet-500 bg-violet-50/60 text-violet-700", icon: Briefcase, label: "Commissions Pending — review payouts", onClick: () => navigate("/finance") },
  ];

  return (
    <DashboardLayout>
      <ProfileCompletionModal />
      <ProductTour />
      <div className="space-y-5 animate-fade-in">
        <OnboardingChecklist />

        {/* === Clinic Header Bar === */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0b1438] via-[#142158] to-[#1a2a6b] text-white shadow-lg">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_50%,white,transparent_60%)]" />
          <div className="relative flex items-center justify-between gap-4 px-5 py-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
                <Stethoscope className="h-6 w-6 text-sky-300" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight font-heading truncate">
                  {clinic?.name || "Your Clinic"} <span className="text-sky-300 font-light">— Management Dashboard</span>
                </h1>
                <p className="text-[11px] text-sky-200/80 truncate font-mono">
                  Clinic ID: {clinic?.id?.slice(0, 8).toUpperCase() || "—"} {clinic?.address ? `· ${clinic.address}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-sky-200/70">{format(new Date(), "EEEE")}</p>
                <p className="text-sm font-bold font-mono">{format(new Date(), "dd-MMM-yyyy").toUpperCase()}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-sm font-bold uppercase">
                {(profile?.full_name || "A")[0]}
              </div>
            </div>
          </div>
        </div>

        {/* === 12 KPI Tiles === */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {tiles.map((t) => <KpiTile key={t.label} {...t} />)}
        </div>

        {/* === Appointments + Priority Alerts === */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden border-0 shadow-card">
            <div className="bg-gradient-to-r from-[#0b1438] to-[#1a2a6b] text-white px-4 py-2.5 flex items-center justify-between">
              <h3 className="font-heading font-semibold text-sm flex items-center gap-2"><CalendarClock className="h-4 w-4" /> TODAY'S APPOINTMENTS</h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-sky-200 hover:text-white hover:bg-white/10" onClick={() => navigate("/appointments")}>View All</Button>
            </div>
            <div className="divide-y">
              {appointments.length === 0 ? (
                <p className="text-center py-10 text-sm text-muted-foreground">No appointments today</p>
              ) : appointments.slice(0, 6).map((a: any) => (
                <div key={a.id} onClick={() => navigate(`/patients/${a.patient_id}`)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition">
                  <div className="w-16 shrink-0 text-xs font-mono font-semibold text-slate-700">
                    {a.appointment_time ? format(new Date(`2000-01-01T${a.appointment_time}`), "h:mm a") : "—"}
                  </div>
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-200 to-blue-300 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
                    {(a.patients?.full_name || "?")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{a.patients?.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {a.provider?.full_name ? `Dr. ${a.provider.full_name.split(" ").pop()}` : "Unassigned"} · {a.reason || "Consultation"}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] capitalize ${statusStyle[a.status] || ""}`}>
                    {a.status?.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden border-0 shadow-card">
            <div className="bg-gradient-to-r from-[#0b1438] to-[#1a2a6b] text-white px-4 py-2.5 flex items-center justify-between">
              <h3 className="font-heading font-semibold text-sm flex items-center gap-2"><BellRing className="h-4 w-4" /> PRIORITY ALERTS (AUTO)</h3>
            </div>
            <div className="p-3 space-y-2">
              {priorityAlerts.map((al, i) => (
                <button key={i} onClick={al.onClick}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border-l-4 ${al.color} hover:opacity-90 transition`}>
                  <al.icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">{al.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* === Monthly Revenue + Doctor Performance === */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden border-0 shadow-card">
            <div className="bg-sky-100 text-slate-700 px-4 py-2.5 text-center">
              <h3 className="font-heading font-semibold text-sm">📅 MONTHLY REVENUE vs EXPENSES ({new Date().getFullYear()})</h3>
            </div>
            <div className="overflow-x-auto max-h-[360px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Month</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Revenue</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Expenses</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Net Profit</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((r) => (
                    <tr key={r.label} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{r.label}</td>
                      <td className="px-4 py-2 text-right font-mono">{Math.round(r.rev).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2 text-right font-mono">{Math.round(r.exp).toLocaleString("en-IN")}</td>
                      <td className={`px-4 py-2 text-right font-mono ${r.net < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                        {Math.round(r.net).toLocaleString("en-IN")}
                      </td>
                      <td className={`px-4 py-2 text-right font-mono ${r.margin < 0 ? "text-rose-600" : "text-slate-700"}`}>
                        {r.margin.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden border-0 shadow-card">
            <div className="bg-sky-100 text-slate-700 px-4 py-2.5 text-center">
              <h3 className="font-heading font-semibold text-sm">👤 DOCTOR PERFORMANCE (MTD)</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Doctor</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground">Treatments</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground">Commission</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Rate</th>
                </tr>
              </thead>
              <tbody>
                {doctorStats.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No doctors yet</td></tr>
                ) : doctorStats.map((d: any) => {
                  const maxBars = 4;
                  const bars = Math.min(maxBars, d.treatments);
                  return (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-sky-200 to-blue-300 flex items-center justify-center text-[10px] font-bold text-slate-700">
                          {(d.full_name || "D")[0]}
                        </div>
                        Dr. {d.full_name?.split(" ").pop() || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono font-bold mr-2">{d.treatments}</span>
                        <span className="inline-flex items-end gap-0.5 align-middle">
                          {Array.from({ length: maxBars }).map((_, i) => (
                            <span key={i} className={`w-1 rounded-sm ${i < bars ? "bg-sky-500" : "bg-slate-200"}`} style={{ height: `${(i + 1) * 3 + 4}px` }} />
                          ))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">—</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{d.rate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 flex justify-end">
              <Button size="sm" onClick={() => navigate("/appointments?new=1")} className="gap-1.5 bg-slate-800 hover:bg-slate-900">
                <Plus className="h-3.5 w-3.5" /> New Appointment
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
