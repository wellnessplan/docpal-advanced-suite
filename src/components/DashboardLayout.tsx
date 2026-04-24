import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useThemeLoader } from "@/hooks/useThemeLoader";
import { useSuperAdmin } from "@/hooks/useSubscription";
import { useClinicPdfDefaults } from "@/hooks/useClinicPdfDefaults";
import MobileBottomNav from "./MobileBottomNav";
import MobileQuickFab from "./MobileQuickFab";
import InstallPromptBanner from "./InstallPromptBanner";
import GlobalSearchDialog from "./GlobalSearchDialog";
import UserMenuDropdown from "./UserMenuDropdown";
import {
  LayoutDashboard, Users, CalendarDays, Receipt, Megaphone,
  Settings, LogOut, ChevronLeft, ChevronRight,
  ListOrdered, Package, TrendingUp, BarChart3, Stethoscope,
  ChevronDown, ChevronUp, FlaskConical, TestTubes, ClipboardList,
  ClipboardCheck, Wallet, ShieldCheck, IndianRupee, Activity,
  Target, Star, Gift, Crown, UserCog, ScrollText, CalendarClock, Shield,
  Truck, ListChecks
} from "lucide-react";

interface NavGroup {
  label: string;
  groupIcon: React.ElementType;
  collapsible?: boolean;
  items: { href: string; label: string; icon: React.ElementType }[];
}

const navGroups: NavGroup[] = [
  {
    label: "",
    groupIcon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "PATIENTS",
    groupIcon: Users,
    collapsible: true,
    items: [
      { href: "/patients", label: "Patients", icon: Users },
      { href: "/today-schedule", label: "Today's Schedule", icon: CalendarClock },
      { href: "/appointments", label: "Appointments", icon: CalendarDays },
      { href: "/queue", label: "Queue", icon: ListOrdered },
    ],
  },
  {
    label: "DOCTOR",
    groupIcon: Stethoscope,
    collapsible: true,
    items: [
      { href: "/dr-dashboard", label: "Dr Dashboard", icon: Stethoscope },
      { href: "/tasks", label: "Follow-Ups", icon: ClipboardList },
      { href: "/treatment-plans", label: "Treatment Plans", icon: ClipboardCheck },
      { href: "/treatment-costing", label: "Procedure List", icon: ListChecks },
      { href: "/ortho", label: "Orthodontics", icon: FlaskConical },
      { href: "/lab-orders", label: "Lab Orders", icon: TestTubes },
    ],
  },
  {
    label: "BILLING",
    groupIcon: Receipt,
    collapsible: true,
    items: [
      { href: "/billing", label: "Invoices", icon: Receipt },
      { href: "/payments", label: "Payments", icon: Wallet },
      { href: "/insurance", label: "Insurance", icon: ShieldCheck },
      { href: "/finance", label: "Expenses", icon: TrendingUp },
      { href: "/inventory", label: "Inventory", icon: Package },
    ],
  },
  {
    label: "GROWTH",
    groupIcon: TrendingUp,
    collapsible: true,
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/social-calendar", label: "Social Calendar", icon: CalendarDays },
      { href: "/leads", label: "Leads", icon: Target },
      { href: "/reviews", label: "Feedback", icon: Star },
      { href: "/referrals", label: "Referrals", icon: Gift },
      { href: "/memberships", label: "Membership", icon: Crown },
    ],
  },
  {
    label: "MANAGEMENT",
    groupIcon: Settings,
    collapsible: true,
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/revenue", label: "Revenue", icon: IndianRupee },
      { href: "/performance", label: "Performance", icon: Activity },
      { href: "/settings?tab=vendors", label: "Vendors", icon: Truck },
      { href: "/staff", label: "Staff", icon: UserCog },
      { href: "/audit-log", label: "Audit Log", icon: ScrollText },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const isMobile = useIsMobile();
  useKeyboardShortcuts();
  useThemeLoader();
  useClinicPdfDefaults(profile?.clinic_id);
  const { data: isSuperAdmin } = useSuperAdmin();

  const allItems = navGroups.flatMap((g) => g.items);
  const currentPageLabel = allItems.find((i) => {
    const href = i.href.split("?")[0];
    return pathname === href || pathname.startsWith(href + "/");
  })?.label ?? "DoctorsBuddy";

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const isCurrentlyOpen = prev[label];
      const allClosed: Record<string, boolean> = {};
      navGroups.forEach(g => { if (g.collapsible) allClosed[g.label] = false; });
      return { ...allClosed, [label]: !isCurrentlyOpen };
    });
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some(i => {
      const href = i.href.split("?")[0];
      return pathname === href || pathname.startsWith(href + "/");
    });

  const initials = (profile?.full_name || "U").charAt(0).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {!isMobile && (
        <div className="p-2 pr-0 h-screen flex">
          <aside
            className={cn(
              "flex flex-col bg-gradient-to-b from-[hsl(210,80%,32%)] via-[hsl(205,75%,38%)] to-[hsl(200,70%,28%)] backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] rounded-2xl shadow-[0_8px_32px_rgba(15,76,129,0.35)] border border-white/[0.12]",
              collapsed ? "w-[60px]" : "w-[240px]"
            )}
          >
            {/* Logo */}
            <div className="flex h-14 items-center gap-2.5 px-3 pt-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur shadow-lg ring-1 ring-white/30">
                <Stethoscope className="h-4.5 w-4.5 text-white" />
              </div>
              {!collapsed && (
                <span className="font-heading text-base font-bold text-white tracking-tight">
                  DoctorsBuddy
                </span>
              )}
            </div>

            {/* User mini-profile */}
            {!collapsed && (
              <div className="px-3 py-3">
                <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.15] p-2.5 ring-1 ring-white/15">
                  <div className="h-8 w-8 rounded-xl bg-white text-primary flex items-center justify-center text-xs font-bold ring-2 ring-white/40">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{profile?.full_name || "Doctor"}</p>
                    <p className="text-xs text-white/80 truncate capitalize">{profile?.role || "Admin"}</p>
                  </div>
                </div>
              </div>
            )}

            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
              {navGroups.map((group, gi) => {
                const groupActive = isGroupActive(group);
                const isExpanded = group.collapsible ? (expandedGroups[group.label] ?? groupActive) : true;

                return (
                  <div key={group.label} className={gi > 0 ? "pt-2" : ""}>
                    {gi > 0 && !collapsed && (
                      <div className="h-px bg-white/[0.15] mx-2 mb-2" />
                    )}

                    {!collapsed && group.collapsible ? (
                      <button
                        onClick={() => toggleGroup(group.label)}
                        className="flex w-full items-center justify-between px-2.5 mb-1 group/label text-base font-sans font-normal"
                      >
                        <div className="flex items-center gap-1.5">
                          <group.groupIcon className="h-3.5 w-3.5 text-white/80" />
                          <span className="font-bold tracking-[0.08em] text-white/85 uppercase group-hover/label:text-white transition-colors font-sans rounded-sm text-xs border-0">
                            {group.label}
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp className="h-3 w-3 text-white/70" /> : <ChevronDown className="h-3 w-3 text-white/70" />}
                      </button>
                    ) : !collapsed && group.label ? (
                      <div className="flex items-center gap-1.5 px-2.5 mb-1">
                        <group.groupIcon className="h-3.5 w-3.5 text-white/80" />
                        <p className="font-bold tracking-[0.08em] text-white/85 uppercase font-sans border-2 rounded-sm text-xs">
                          {group.label}
                        </p>
                      </div>
                    ) : null}

                    {(isExpanded || collapsed) && (
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const hrefBase = item.href.split("?")[0];
                          const isActive = pathname === hrefBase || pathname.startsWith(hrefBase + "/");
                          return (
                            <Link
                              key={item.href}
                              to={item.href}
                              title={collapsed ? item.label : undefined}
                              className={cn(
                                "relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 font-semibold transition-all duration-200 text-base",
                                isActive
                                  ? "bg-white text-primary shadow-md"
                                  : "text-white/95 hover:bg-white/15 hover:text-white"
                              )}
                            >
                              <item.icon className={cn(
                                "h-[18px] w-[18px] shrink-0 transition-colors",
                                isActive ? "text-primary" : "text-white"
                              )} />
                              {!collapsed && <span className="text-sm">{item.label}</span>}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="p-2 space-y-0.5 border-t border-white/15">
              {isSuperAdmin && (
                <Link
                  to="/super-admin"
                  title={collapsed ? "Super Admin" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors",
                    pathname === "/super-admin"
                      ? "bg-white text-primary"
                      : "text-amber-200 hover:bg-white/15"
                  )}
                >
                  <Shield className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>Super Admin</span>}
                </Link>
              )}
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] text-white/95 hover:bg-white/15 transition-colors"
              >
                {collapsed ? <ChevronRight className="h-[18px] w-[18px]" /> : <ChevronLeft className="h-[18px] w-[18px]" />}
                {!collapsed && <span>Collapse</span>}
              </button>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] text-white/95 hover:bg-destructive/30 hover:text-white transition-colors"
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>Sign Out</span>}
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <InstallPromptBanner />
        <div className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base md:text-lg font-semibold text-foreground">{currentPageLabel}</h2>
            <div className="flex items-center gap-2 md:gap-3">
              <GlobalSearchDialog />
              <UserMenuDropdown />
            </div>
          </div>
        </div>
        <div className={cn("p-4 md:p-6", isMobile && "pb-20")}>{children}</div>
      </main>

      {isMobile && <MobileBottomNav />}
      <MobileQuickFab />
    </div>
  );
}
