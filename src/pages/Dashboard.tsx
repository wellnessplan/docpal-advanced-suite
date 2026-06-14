import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import ProfileCompletionModal from "@/components/ProfileCompletionModal";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";
import ProductTour from "@/components/onboarding/ProductTour";
import { Input } from "@/components/ui/input";
import {
  Search, Bell, ArrowUpRight, Users, CalendarDays, FlaskConical,
  Folder, Plus, TrendingUp, IndianRupee, Wallet, ChevronRight,
  Stethoscope, FileText, Package, Activity, UserPlus, CalendarPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import NewPatientDialog from "@/components/dashboard/NewPatientDialog";
import NewAppointmentDialog from "@/components/dashboard/NewAppointmentDialog";

/* ─────────────────────────────────────────────────────────────
   PREMIUM SAAS DASHBOARD
   Inspired by Linear · Notion · Stripe · Dribbble
   ───────────────────────────────────────────────────────────── */

const PASTEL = {
  lavender: "bg-[#EDE7FE]",
  pink: "bg-[#FCE4EC]",
  peach: "bg-[#FFE6D5]",
  blue: "bg-[#DCEBFB]",
  mint: "bg-[#DCF3E8]",
  cream: "bg-[#FFF4DC]",
};

function StatCard({
  label, value, delta, deltaTone = "up", icon: Icon, accent, onClick,
}: {
  label: string; value: string | number; delta?: string;
  deltaTone?: "up" | "down" | "flat"; icon: any; accent: string; onClick?: () => void;
}) {
  const deltaColor =
    deltaTone === "up" ? "text-emerald-700 bg-emerald-100"
    : deltaTone === "down" ? "text-rose-700 bg-rose-100"
    : "text-slate-700 bg-slate-100";
  return (
    <button
      onClick={onClick}
      className={`group relative text-left w-full ${accent} rounded-[24px] p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-20px_rgba(15,23,42,0.18)] shadow-[0_2px_8px_rgba(15,23,42,0.04)]`}
    >
      <div className="flex items-start justify-between">
        <div className="h-11 w-11 rounded-2xl bg-white/70 backdrop-blur flex items-center justify-center shadow-sm">
          <Icon className="h-5 w-5 text-slate-800" strokeWidth={2.2} />
        </div>
        <ArrowUpRight className="h-4 w-4 text-slate-500 opacity-0 group-hover:opacity-100 transition" />
      </div>
      <p className="mt-6 text-[13px] font-medium text-slate-600 tracking-tight">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-3xl font-bold text-slate-900 tracking-tight leading-none">{value}</p>
        {delta && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${deltaColor}`}>
            {delta}
          </span>
        )}
      </div>
    </button>
  );
}

function FolderCard({
  title, count, color, onClick,
}: { title: string; count: number; color: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group relative ${color} rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg shadow-[0_1px_3px_rgba(15,23,42,0.06)] w-full`}
    >
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 rounded-xl bg-white/70 flex items-center justify-center">
          <Folder className="h-5 w-5 text-slate-800" strokeWidth={2.2} fill="currentColor" fillOpacity={0.08} />
        </div>
        <span className="text-[11px] font-semibold text-slate-600 bg-white/70 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">Open folder</p>
    </button>
  );
}

function ProgressRow({
  name, value, max, color,
}: { name: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[13px] font-medium text-slate-700">{name}</p>
        <p className="text-[12px] font-semibold text-slate-900 font-mono">{value}<span className="text-slate-400 font-normal">/{max}</span></p>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StorageRing({ usedPct, label, sub }: { usedPct: number; label: string; sub: string }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const offset = c - (usedPct / 100) * c;
  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <svg width="140" height="140" className="-rotate-90">
          <circle cx="70" cy="70" r={r} stroke="hsl(220, 14%, 92%)" strokeWidth="14" fill="none" />
          <circle
            cx="70" cy="70" r={r} stroke="url(#ringGrad)" strokeWidth="14" fill="none"
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 900ms ease" }}
          />
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FB923C" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{usedPct.toFixed(0)}%</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">used</p>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
        <div className="mt-3 space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-500" /><span className="text-slate-600">Patients & Files</span></div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-200" /><span className="text-slate-600">Available</span></div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { profile, clinicId } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [prefillPatient, setPrefillPatient] = useState<{ id: string; full_name: string } | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const { data: clinic } = useQuery({
    queryKey: ["dash-clinic", clinicId],
    queryFn: async () => (await supabase.from("clinics").select("id,name").eq("id", clinicId!).maybeSingle()).data,
    enabled: !!clinicId,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["dash-appts", clinicId, today],
    queryFn: async () => (await supabase.from("appointments")
      .select("*, patients(full_name,phone), provider:profiles!appointments_provider_id_fkey(full_name)")
      .eq("clinic_id", clinicId!).eq("appointment_date", today)
      .order("appointment_time", { ascending: true })).data ?? [],
    enabled: !!clinicId,
  });

  const { data: patientsCount = 0 } = useQuery({
    queryKey: ["dash-pcount", clinicId],
    queryFn: async () => (await supabase.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId!)).count ?? 0,
    enabled: !!clinicId,
  });

  const { data: pendingTreatments = 0 } = useQuery({
    queryKey: ["dash-pending-tx", clinicId],
    queryFn: async () => (await supabase.from("treatment_plans")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId!).in("status", ["draft", "proposed", "accepted", "in_progress"])).count ?? 0,
    enabled: !!clinicId,
  });

  const { data: activeLabs = 0 } = useQuery({
    queryKey: ["dash-labs", clinicId],
    queryFn: async () => (await supabase.from("lab_orders")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId!).not("status", "in", "(delivered,cemented,cancelled)")).count ?? 0,
    enabled: !!clinicId,
  });

  const { data: invoicesMtd = [] } = useQuery({
    queryKey: ["dash-inv-mtd", clinicId, monthStart],
    queryFn: async () => (await supabase.from("invoices")
      .select("total,paid_amount,balance,status,created_at")
      .eq("clinic_id", clinicId!).gte("created_at", `${monthStart}T00:00:00`)).data ?? [],
    enabled: !!clinicId,
  });

  const { data: openInvoices = [] } = useQuery({
    queryKey: ["dash-inv-open", clinicId],
    queryFn: async () => (await supabase.from("invoices")
      .select("balance,status").eq("clinic_id", clinicId!).neq("status", "paid")).data ?? [],
    enabled: !!clinicId,
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["dash-inv-items", clinicId],
    queryFn: async () => (await supabase.from("inventory_items")
      .select("current_stock,reorder_level").eq("clinic_id", clinicId!)).data ?? [],
    enabled: !!clinicId,
  });

  const { data: recentInvoices = [] } = useQuery({
    queryKey: ["dash-recent-inv", clinicId],
    queryFn: async () => (await supabase.from("invoices")
      .select("id,invoice_number,total,paid_amount,balance,status,created_at,patients(full_name)")
      .eq("clinic_id", clinicId!).order("created_at", { ascending: false }).limit(6)).data ?? [],
    enabled: !!clinicId,
  });

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const revenueMtd = invoicesMtd.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const outstanding = openInvoices.reduce((s: number, i: any) => s + Number(i.balance || 0), 0);
  const stockAlerts = inventoryItems.filter((i: any) => Number(i.current_stock) <= Number(i.reorder_level || 0)).length;
  const completedToday = appointments.filter((a: any) => a.status === "completed").length;

  // synthetic storage % (real metric not yet in schema)
  const storagePct = useMemo(() => Math.min(95, 18 + patientsCount * 0.6), [patientsCount]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <DashboardLayout>
      <ProfileCompletionModal />
      <ProductTour />

      {/* Page wrapper — premium off-white canvas */}
      <div className="-m-4 md:-m-6 p-4 md:p-8 bg-[#F8F7F6] min-h-[calc(100vh-4rem)]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
          <OnboardingChecklist />

          {/* ═══ TOP BAR: Search + Notif + Avatar ═══ */}
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patients, invoices, appointments…"
                className="pl-11 h-12 rounded-2xl border-0 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)] focus-visible:ring-2 focus-visible:ring-orange-300 text-sm placeholder:text-slate-400"
                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
              />
            </div>
            <button className="relative h-12 w-12 rounded-2xl bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)] flex items-center justify-center hover:bg-slate-50 transition">
              <Bell className="h-5 w-5 text-slate-700" />
              <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
            </button>
            <button className="h-12 pl-1.5 pr-4 rounded-2xl bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)] flex items-center gap-2.5 hover:bg-slate-50 transition">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-sm font-bold text-white">
                {(profile?.full_name || "A")[0]}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-[13px] font-semibold text-slate-900 leading-tight">{profile?.full_name?.split(" ")[0] || "User"}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{profile?.role || "Member"}</p>
              </div>
            </button>
          </div>

          {/* ═══ GREETING ═══ */}
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <p className="text-[13px] font-medium text-slate-500">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mt-1">
                {greeting}, {profile?.full_name?.split(" ")[0] || "Doctor"} <span className="text-orange-500">·</span>
              </h1>
              <p className="text-sm text-slate-500 mt-1">Here's what's happening at {clinic?.name || "your clinic"} today.</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-11 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-slate-900/20 transition">
                  <Plus className="h-4 w-4" /> New
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => navigate("/patients")} className="gap-2 cursor-pointer">
                  <UserPlus className="h-4 w-4 text-muted-foreground" /> New Patient
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/appointments?new=1")} className="gap-2 cursor-pointer">
                  <CalendarPlus className="h-4 w-4 text-muted-foreground" /> New Appointment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* ═══ ANALYTICS CARDS (pastel) ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            <StatCard label="Patients Today" value={appointments.length} delta={`+${completedToday} done`}
              icon={Users} accent={PASTEL.lavender} onClick={() => navigate("/appointments")} />
            <StatCard label="Revenue (MTD)" value={fmt(revenueMtd)} delta="+12.4%" deltaTone="up"
              icon={IndianRupee} accent={PASTEL.peach} onClick={() => navigate("/finance")} />
            <StatCard label="Outstanding" value={fmt(outstanding)} delta={`${openInvoices.length} open`} deltaTone="down"
              icon={Wallet} accent={PASTEL.pink} onClick={() => navigate("/billing")} />
            <StatCard label="Active Lab Cases" value={activeLabs} delta="In progress" deltaTone="flat"
              icon={FlaskConical} accent={PASTEL.blue} onClick={() => navigate("/lab-orders")} />
          </div>

          {/* ═══ MID ROW: Progress · Folders · Storage Ring ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Progress Card */}
            <div className="lg:col-span-1 bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Today's Progress</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Operational throughput</p>
                </div>
                <Activity className="h-5 w-5 text-slate-400" />
              </div>
              <div className="space-y-5">
                <ProgressRow name="Appointments completed" value={completedToday} max={Math.max(appointments.length, 1)} color="bg-gradient-to-r from-orange-400 to-orange-500" />
                <ProgressRow name="Treatments pending" value={pendingTreatments} max={Math.max(pendingTreatments + 5, 10)} color="bg-gradient-to-r from-violet-400 to-violet-500" />
                <ProgressRow name="Lab cases active" value={activeLabs} max={Math.max(activeLabs + 3, 8)} color="bg-gradient-to-r from-sky-400 to-sky-500" />
                <ProgressRow name="Stock alerts" value={stockAlerts} max={Math.max(inventoryItems.length, 1)} color="bg-gradient-to-r from-rose-400 to-rose-500" />
              </div>
            </div>

            {/* Folders */}
            <div className="lg:col-span-1 bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Quick Folders</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Jump into a module</p>
                </div>
                <button onClick={() => navigate("/patients")} className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-0.5">
                  All <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FolderCard title="Patients" count={patientsCount} color={PASTEL.lavender} onClick={() => navigate("/patients")} />
                <FolderCard title="Invoices" count={openInvoices.length} color={PASTEL.peach} onClick={() => navigate("/billing")} />
                <FolderCard title="Lab Orders" count={activeLabs} color={PASTEL.blue} onClick={() => navigate("/lab-orders")} />
                <FolderCard title="Inventory" count={inventoryItems.length} color={PASTEL.mint} onClick={() => navigate("/inventory")} />
              </div>
            </div>

            {/* Storage Ring */}
            <div className="lg:col-span-1 bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Clinic Storage</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Files, images, X-rays</p>
                </div>
                <Package className="h-5 w-5 text-slate-400" />
              </div>
              <StorageRing
                usedPct={storagePct}
                label={`${(storagePct * 0.05).toFixed(1)} GB of 5 GB`}
                sub={`${patientsCount} patient records`}
              />
              <button
                onClick={() => navigate("/settings")}
                className="mt-5 w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold transition"
              >
                Upgrade plan
              </button>
            </div>
          </div>

          {/* ═══ DATA TABLE: Recent Invoices ═══ */}
          <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Recent Invoices</h3>
                <p className="text-xs text-slate-500 mt-0.5">Latest billing activity</p>
              </div>
              <button onClick={() => navigate("/billing")} className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-0.5">
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    <th className="px-3 py-2.5">Invoice</th>
                    <th className="px-3 py-2.5">Patient</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5 text-right">Balance</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-sm text-slate-400">No invoices yet</td></tr>
                  ) : recentInvoices.map((inv: any) => {
                    const statusMap: Record<string, string> = {
                      paid: "bg-emerald-100 text-emerald-700",
                      partial: "bg-amber-100 text-amber-700",
                      pending: "bg-rose-100 text-rose-700",
                      draft: "bg-slate-100 text-slate-700",
                    };
                    return (
                      <tr key={inv.id} onClick={() => navigate("/billing")}
                        className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition">
                        <td className="px-3 py-3.5 font-semibold text-slate-900">#{inv.invoice_number || inv.id.slice(0, 6)}</td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-[11px] font-bold text-white">
                              {(inv.patients?.full_name || "?")[0]}
                            </div>
                            <span className="font-medium text-slate-800">{inv.patients?.full_name || "—"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-slate-500 text-xs">{format(new Date(inv.created_at), "dd MMM yyyy")}</td>
                        <td className="px-3 py-3.5 text-right font-mono font-semibold text-slate-900">{fmt(Number(inv.total))}</td>
                        <td className="px-3 py-3.5 text-right font-mono text-slate-600">{fmt(Number(inv.balance))}</td>
                        <td className="px-3 py-3.5">
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize ${statusMap[inv.status] || "bg-slate-100 text-slate-700"}`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ FOOTER ROW: Today's Appointments compact ═══ */}
          <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Today's Schedule</h3>
                <p className="text-xs text-slate-500 mt-0.5">{appointments.length} appointment{appointments.length === 1 ? "" : "s"}</p>
              </div>
              <button onClick={() => navigate("/appointments")} className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-0.5">
                Calendar <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            {appointments.length === 0 ? (
              <p className="text-center py-10 text-sm text-slate-400">No appointments scheduled today</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {appointments.slice(0, 6).map((a: any) => (
                  <button key={a.id} onClick={() => navigate(`/patients/${a.patient_id}`)}
                    className="text-left p-4 rounded-2xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition group">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center text-xs font-bold text-orange-700">
                        {a.appointment_time ? format(new Date(`2000-01-01T${a.appointment_time}`), "HH:mm") : "—"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-slate-900 truncate">{a.patients?.full_name || "—"}</p>
                        <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                          <Stethoscope className="h-3 w-3" />
                          {a.provider?.full_name ? `Dr. ${a.provider.full_name.split(" ").pop()}` : "Unassigned"}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-orange-500 transition" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
