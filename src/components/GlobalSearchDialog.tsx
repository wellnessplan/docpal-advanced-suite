import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Users, CalendarDays, Receipt, ListOrdered,
  Package, TrendingUp, BarChart3, Megaphone, Settings, Target,
  Star, Gift, Crown, UserCog, ScrollText, ClipboardList,
  ClipboardCheck, Wallet, ShieldCheck, IndianRupee, Activity,
  TestTubes, FlaskConical, CalendarClock, Search, User, Plug,
  Plus, MessageCircle, Stethoscope, Zap
} from "lucide-react";

interface QuickAction {
  label: string;
  hint: string;
  icon: any;
  run: (nav: (p: string) => void) => void;
}
const quickActions: QuickAction[] = [
  { label: "Add new patient", hint: "register", icon: Plus, run: (n) => n("/patients?new=1") },
  { label: "Book appointment", hint: "schedule", icon: CalendarDays, run: (n) => n("/appointments?new=1") },
  { label: "Create invoice", hint: "billing", icon: Receipt, run: (n) => n("/billing?new=1") },
  { label: "Record payment", hint: "wallet", icon: Wallet, run: (n) => n("/payments?new=1") },
  { label: "Send WhatsApp message", hint: "chat", icon: MessageCircle, run: (n) => n("/whatsapp") },
  { label: "Open today's queue", hint: "live", icon: ListOrdered, run: (n) => n("/queue") },
  { label: "Switch to Focus Mode", hint: "doctor", icon: Stethoscope, run: () => window.location.assign("/focus") },
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
  { label: "Billing & Invoices", href: "/billing", icon: Receipt },
  { label: "Payments", href: "/payments", icon: Wallet },
  { label: "Insurance / Claims", href: "/insurance", icon: ShieldCheck },
  { label: "Expenses", href: "/finance", icon: TrendingUp },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Revenue", href: "/revenue", icon: IndianRupee },
  { label: "Performance", href: "/performance", icon: Activity },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Leads", href: "/leads", icon: Target },
  { label: "Feedback", href: "/reviews", icon: Star },
  { label: "Referrals", href: "/referrals", icon: Gift },
  { label: "Membership", href: "/memberships", icon: Crown },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Staff", href: "/staff", icon: UserCog },
  { label: "Audit Log", href: "/audit-log", icon: ScrollText },
  { label: "Integrations", href: "/integrations", icon: Plug },
];

interface PatientResult {
  id: string;
  full_name: string;
  phone: string | null;
}

export default function GlobalSearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Cmd+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search patients with debounce
  useEffect(() => {
    if (!query || query.length < 2 || !profile?.clinic_id) {
      setPatients([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, phone")
        .eq("clinic_id", profile.clinic_id)
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(8);
      setPatients(data || []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, profile?.clinic_id]);

  const go = useCallback((path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  }, [navigate]);

  const filteredPages = query
    ? pages.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))
    : pages;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/70 transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-border/80 bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <span className="sr-only">
          <DialogTitle>Global Search</DialogTitle>
          <DialogDescription>Search patients and pages across the app</DialogDescription>
        </span>
        <CommandInput
          placeholder="Search patients, pages…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>{loading ? "Searching…" : "No results found."}</CommandEmpty>

        <CommandInput
          placeholder="Type a command, patient, or page…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>{loading ? "Searching…" : "No results found."}</CommandEmpty>

          {patients.length > 0 && (
            <CommandGroup heading="Patients">
              {patients.map((p) => (
                <CommandItem key={p.id} value={`patient-${p.id}`} onSelect={() => go(`/patients/${p.id}`)} className="gap-2.5">
                  <User className="h-4 w-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="font-medium">{p.full_name}</span>
                    {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Quick actions">
            {quickActions
              .filter(a => !query || a.label.toLowerCase().includes(query.toLowerCase()) || a.hint.includes(query.toLowerCase()))
              .map((a) => (
                <CommandItem key={a.label} value={`action-${a.label}`} onSelect={() => { setOpen(false); setQuery(""); a.run(navigate); }} className="gap-2.5">
                  <a.icon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{a.label}</span>
                  <Zap className="ml-auto h-3 w-3 text-muted-foreground" />
                </CommandItem>
              ))}
          </CommandGroup>

          <CommandGroup heading="Pages">
            {filteredPages.map((page) => (
              <CommandItem key={page.href} value={page.label} onSelect={() => go(page.href)} className="gap-2.5">
                <page.icon className="h-4 w-4 text-muted-foreground" />
                <span>{page.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
