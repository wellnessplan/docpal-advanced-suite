import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, CalendarDays, Receipt, ListOrdered,
  Package, TrendingUp, BarChart3, Megaphone, Settings, Target,
  Star, Gift, Crown, UserCog, ScrollText, ClipboardList,
  ClipboardCheck, Wallet, ShieldCheck, IndianRupee, Activity,
  TestTubes, FlaskConical, CalendarClock, Phone, User, Plug,
  Plus, MessageCircle, Stethoscope, Zap, FileText
} from "lucide-react";

interface QuickAction { label: string; hint: string; icon: any; run: (nav: (p: string) => void) => void; }
const quickActions: QuickAction[] = [
  { label: "New patient", hint: "register add", icon: Plus, run: (n) => n("/patients?new=1") },
  { label: "New appointment", hint: "book schedule", icon: CalendarDays, run: (n) => n("/appointments?new=1") },
  { label: "New invoice", hint: "billing", icon: Receipt, run: (n) => n("/finance-hub?tab=billing&new=1") },
  { label: "Record payment", hint: "wallet", icon: Wallet, run: (n) => n("/finance-hub?tab=payments&new=1") },
  { label: "New lab order", hint: "lab", icon: TestTubes, run: (n) => n("/lab-orders?new=1") },
  { label: "New task / follow-up", hint: "todo", icon: ClipboardList, run: (n) => n("/tasks?new=1") },
  { label: "Send WhatsApp", hint: "chat message", icon: MessageCircle, run: (n) => n("/whatsapp") },
];

const pages = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Today's Schedule", href: "/today-schedule", icon: CalendarClock },
  { label: "Queue", href: "/queue", icon: ListOrdered },
  { label: "Follow-Ups", href: "/tasks", icon: ClipboardList },
  { label: "Patients", href: "/patients", icon: Users },
  { label: "Appointments", href: "/appointments", icon: CalendarDays },
  { label: "Treatment Plans", href: "/treatment-plans", icon: ClipboardCheck },
  { label: "Lab Orders", href: "/lab-orders", icon: TestTubes },
  { label: "Orthodontics", href: "/ortho", icon: FlaskConical },
  { label: "Billing & Payments", href: "/finance-hub", icon: Receipt },
  { label: "Memberships", href: "/memberships", icon: Crown },
  { label: "Reports & Insights", href: "/analytics", icon: BarChart3 },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Leads", href: "/leads", icon: Target },
  { label: "Feedback", href: "/reviews", icon: Star },
  { label: "Referrals", href: "/referrals", icon: Gift },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Staff / Team", href: "/settings?tab=team", icon: UserCog },
  { label: "Audit Log", href: "/audit-log", icon: ScrollText },
  { label: "Integrations", href: "/integrations", icon: Plug },
];

interface PatientResult { id: string; full_name: string; phone: string | null; }

interface Props { mode?: "search" | "new" }

export default function GlobalSearchDialog({ mode = "search" }: Props) {
  const [open, setOpen] = useState(false);
  const [forceNew, setForceNew] = useState(false);
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { profile } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); setForceNew(false); setOpen((o) => !o);
      }
      if (e.key === "n" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault(); setForceNew(true); setOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Patient search — phone-number-aware: digit-only query searches phone, else name OR phone
  useEffect(() => {
    if (!query || query.length < 2 || !profile?.clinic_id) { setPatients([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const digits = query.replace(/\D/g, "");
      const isPhone = digits.length >= 3 && digits.length === query.replace(/[\s+()-]/g, "").length;
      const filter = isPhone ? `phone.ilike.%${digits}%` : `full_name.ilike.%${query}%,phone.ilike.%${digits || query}%`;
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, phone")
        .eq("clinic_id", profile.clinic_id)
        .or(filter)
        .limit(8);
      setPatients(data || []); setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query, profile?.clinic_id]);

  const go = useCallback((path: string) => { setOpen(false); setQuery(""); navigate(path); }, [navigate]);

  const filteredPages = query ? pages.filter((p) => p.label.toLowerCase().includes(query.toLowerCase())) : pages;
  const showQuickFirst = forceNew || /^(new|add|create|\+)/i.test(query.trim());

  if (mode === "new") {
    return (
      <>
        <Button size="sm" variant="default" onClick={() => { setForceNew(true); setOpen(true); }}
          className="gap-1.5 h-9 px-3 rounded-xl shadow-md">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs font-bold">New</span>
        </Button>
        {renderDialog()}
      </>
    );
  }

  function renderDialog() {
    return (
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <span className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>Search patients by phone or name, jump to pages, or create new records</DialogDescription>
        </span>
        <CommandInput
          placeholder={forceNew ? "What do you want to create?" : "Search by phone, name, or page…  (try a phone number)"}
          value={query}
          onValueChange={setQuery}
          inputMode={/^\d/.test(query) ? "tel" : "search"}
        />
        <CommandList>
          <CommandEmpty>{loading ? "Searching…" : "No results."}</CommandEmpty>

          {patients.length > 0 && !forceNew && (
            <CommandGroup heading={/^\d/.test(query) ? "Patients (phone match)" : "Patients"}>
              {patients.map((p) => (
                <CommandItem key={p.id} value={`patient-${p.id}`} onSelect={() => go(`/patients/${p.id}`)} className="gap-2.5">
                  <User className="h-4 w-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="font-medium">{p.full_name}</span>
                    {p.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{p.phone}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {(showQuickFirst || patients.length === 0) && (
            <CommandGroup heading={forceNew ? "Create new" : "Quick actions"}>
              {quickActions
                .filter(a => !query || forceNew || a.label.toLowerCase().includes(query.toLowerCase()) || a.hint.includes(query.toLowerCase()))
                .map((a) => (
                  <CommandItem key={a.label} value={`action-${a.label}`} onSelect={() => { setOpen(false); setQuery(""); a.run(navigate); }} className="gap-2.5">
                    <a.icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{a.label}</span>
                    <Zap className="ml-auto h-3 w-3 text-muted-foreground" />
                  </CommandItem>
                ))}
            </CommandGroup>
          )}

          {!forceNew && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Pages">
                {filteredPages.map((page) => (
                  <CommandItem key={page.href} value={page.label} onSelect={() => go(page.href)} className="gap-2.5">
                    <page.icon className="h-4 w-4 text-muted-foreground" />
                    <span>{page.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    );
  }

  return (
    <>
      <button
        onClick={() => { setForceNew(false); setOpen(true); }}
        className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/70 transition-colors min-w-[180px]"
      >
        <Phone className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Phone or name…</span>
        <kbd className="hidden md:inline-flex h-5 ml-auto items-center gap-0.5 rounded border border-border/80 bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      {renderDialog()}
    </>
  );
}
