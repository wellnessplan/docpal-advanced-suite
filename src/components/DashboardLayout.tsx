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
import ImpersonationBanner from "./ImpersonationBanner";
import AnnouncementBanner from "./AnnouncementBanner";
import GlobalSearchDialog from "./GlobalSearchDialog";
import UserMenuDropdown from "./UserMenuDropdown";
import BranchSwitcher from "./BranchSwitcher";
import { prefetchRoute } from "@/lib/route-prefetch";
import {
  LayoutDashboard, Users, CalendarDays, Receipt, Megaphone,
  Settings, LogOut, ChevronLeft, ChevronRight,
  ListOrdered, Package, TrendingUp, BarChart3, Stethoscope,
  ChevronDown, ChevronUp, FlaskConical, TestTubes, ClipboardList,
  ClipboardCheck, Wallet, ShieldCheck, IndianRupee, Activity,
  Target, Star, Gift, Crown, UserCog, ScrollText, CalendarClock, Shield,
  Truck, ListChecks, Focus, MessageCircle, MoreHorizontal, Library, Tv
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem { href: string; label: string; icon: React.ElementType; roles?: string[] }
interface NavGroup {
  label: string;
  groupIcon: React.ElementType;
  collapsible?: boolean;
  items: NavItem[];
}

// Role visibility:
//  - Front-desk essentials are pinned at top: Calendar, Patients, Billing, WhatsApp.
//  - Everything else lives under role-filtered groups, hidden by default behind "More".
//  - Assistants/receptionists do NOT see Revenue/Finance/Reports.
const FRONT_DESK_ESSENTIALS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const moreGroups: NavGroup[] = [
  {
    label: "PATIENTS",
    groupIcon: Users,
    collapsible: true,
    items: [
      { href: "/appointments", label: "Appointments", icon: CalendarDays },
      { href: "/queue", label: "Queue", icon: ListOrdered },
      { href: "/today-schedule", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "DOCTOR",
    groupIcon: Stethoscope,
    collapsible: true,
    items: [
      { href: "/dr-dashboard", label: "Dr Dashboard", icon: Stethoscope, roles: ["owner", "dentist"] },
      { href: "/tasks", label: "Follow-Ups", icon: ClipboardList },
      { href: "/treatment-plans", label: "Treatment Plans", icon: ClipboardCheck },
      { href: "/treatment-costing", label: "Procedure List", icon: ListChecks, roles: ["owner", "dentist"] },
      { href: "/ortho", label: "Orthodontics", icon: FlaskConical, roles: ["owner", "dentist"] },
      { href: "/lab-orders", label: "Lab Orders", icon: TestTubes },
    ],
  },
  {
    label: "BILLING",
    groupIcon: Receipt,
    collapsible: true,
    items: [
      { href: "/payments", label: "Payments", icon: Wallet },
      { href: "/insurance", label: "Insurance", icon: ShieldCheck },
      { href: "/finance", label: "Expenses", icon: TrendingUp, roles: ["owner", "admin"] },
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
      { href: "/patient-education", label: "Patient Education", icon: Library },
      { href: "/displays", label: "Clinic Screens / TV", icon: Tv },
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
      { href: "/reports", label: "Reports", icon: BarChart3, roles: ["owner", "admin", "dentist"] },
      { href: "/revenue", label: "Revenue", icon: IndianRupee, roles: ["owner", "admin"] },
      { href: "/performance", label: "Performance", icon: Activity, roles: ["owner", "admin"] },
      { href: "/settings?tab=vendors", label: "Vendors", icon: Truck, roles: ["owner", "admin"] },
      { href: "/staff", label: "Staff", icon: UserCog, roles: ["owner", "admin"] },
      { href: "/audit-log", label: "Audit Log", icon: ScrollText, roles: ["owner", "admin"] },
      { href: "/settings", label: "Settings", icon: Settings, roles: ["owner", "admin"] },
    ],
  },
];

function filterByRole(items: NavItem[], role: string | undefined | null): NavItem[] {
  if (!role) return items.filter(i => !i.roles);
  return items.filter(i => !i.roles || i.roles.includes(role));
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [moreOpen, setMoreOpen] = useState(false);
  const isMobile = useIsMobile();
  useKeyboardShortcuts();
  useThemeLoader();
  useClinicPdfDefaults(profile?.clinic_id);
  const { data: isSuperAdmin } = useSuperAdmin();

  const role = profile?.role as string | undefined;

  // Role-filtered groups for the "More" section
  const visibleGroups = moreGroups
    .map(g => ({ ...g, items: filterByRole(g.items, role) }))
    .filter(g => g.items.length > 0);

  const allItems = [...FRONT_DESK_ESSENTIALS, ...visibleGroups.flatMap((g) => g.items)];
  const currentPageLabel = allItems.find((i) => {
    const href = i.href.split("?")[0];
    return pathname === href || pathname.startsWith(href + "/");
  })?.label ?? "DoctorsBuddy";

  // Auto-open "More" if current route is in a More group
  const currentInMore = visibleGroups.some(g => g.items.some(i => {
    const href = i.href.split("?")[0];
    return pathname === href || pathname.startsWith(href + "/");
  }));
  const moreEffective = moreOpen || currentInMore || collapsed;

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const isCurrentlyOpen = prev[label];
      const allClosed: Record<string, boolean> = {};
      visibleGroups.forEach(g => { if (g.collapsible) allClosed[g.label] = false; });
      return { ...allClosed, [label]: !isCurrentlyOpen };
    });
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some(i => {
      const href = i.href.split("?")[0];
      return pathname === href || pathname.startsWith(href + "/");
    });

  const initials = (profile?.full_name || "U").charAt(0).toUpperCase();

  const renderNavItem = (item: NavItem) => {
    const hrefBase = item.href.split("?")[0];
    const isActive = pathname === hrefBase || pathname.startsWith(hrefBase + "/");
    return (
      <Link
        key={item.href}
        to={item.href}
        onMouseEnter={() => prefetchRoute(item.href)}
        onFocus={() => prefetchRoute(item.href)}
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
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {!isMobile && (
        <div className="p-2 pr-0 h-screen flex">
          <aside
            style={{ background: "var(--gradient-hero, hsl(var(--sidebar-background)))" }}
            className={cn(
              "flex flex-col text-sidebar-foreground backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] border border-white/[0.12]",
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
              {/* Pinned essentials */}
              <div className="space-y-0.5">
                {FRONT_DESK_ESSENTIALS.map(renderNavItem)}
              </div>

              {/* More toggle */}
              <div className="pt-2">
                {!collapsed && <div className="h-px bg-white/[0.15] mx-2 mb-2" />}
                {!collapsed ? (
                  <button
                    onClick={() => setMoreOpen(o => !o)}
                    className="flex w-full items-center justify-between px-2.5 py-1.5 mb-1 rounded-lg hover:bg-white/[0.08] transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <MoreHorizontal className="h-3.5 w-3.5 text-white/80" />
                      <span className="font-bold tracking-[0.08em] text-white/85 uppercase font-sans text-xs">More</span>
                    </div>
                    {moreEffective ? <ChevronUp className="h-3 w-3 text-white/70" /> : <ChevronDown className="h-3 w-3 text-white/70" />}
                  </button>
                ) : (
                  <div className="flex justify-center py-1">
                    <MoreHorizontal className="h-4 w-4 text-white/70" />
                  </div>
                )}
              </div>

              {/* More groups (role-filtered) */}
              {moreEffective && visibleGroups.map((group, gi) => {
                const groupActive = isGroupActive(group);
                const isExpanded = group.collapsible ? (expandedGroups[group.label] ?? groupActive) : true;

                return (
                  <div key={group.label} className={gi > 0 ? "pt-2" : ""}>
                    {gi > 0 && !collapsed && (
                      <div className="h-px bg-white/[0.10] mx-2 mb-2" />
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
                        <p className="font-bold tracking-[0.08em] text-white/85 uppercase font-sans rounded-sm text-xs border-0">
                          {group.label}
                        </p>
                      </div>
                    ) : null}

                    {(isExpanded || collapsed) && (
                      <div className="space-y-0.5">
                        {group.items.map(renderNavItem)}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="p-2 space-y-0.5 border-t border-white/15">
              {isSuperAdmin && (
                <>
                  <Link
                    to="/platform"
                    title={collapsed ? "Platform Console" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors",
                      pathname === "/platform"
                        ? "bg-white text-primary"
                        : "text-amber-200 hover:bg-white/15"
                    )}
                  >
                    <Shield className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span>Platform Console</span>}
                  </Link>
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
                  <Link
                    to="/incidents"
                    title={collapsed ? "Incidents" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors",
                      pathname === "/incidents"
                        ? "bg-white text-primary"
                        : "text-amber-200 hover:bg-white/15"
                    )}
                  >
                    <Activity className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span>Incidents</span>}
                  </Link>
                </>
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
        <ImpersonationBanner />
        <AnnouncementBanner />
        <InstallPromptBanner />

        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-3 md:px-6 py-3 safe-area-top">
          <div className="flex items-center justify-between gap-2 bg-card rounded-2xl shadow-[0_2px_10px_rgba(15,23,42,0.04)] px-4 py-2.5">
            <h2 className="text-[15px] md:text-lg font-bold tracking-tight text-foreground truncate min-w-0">{currentPageLabel}</h2>
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 h-9 px-3 rounded-xl bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                onClick={() => window.location.assign("/focus")}
                title="Switch to simplified 2-screen doctor flow"
              >
                <Focus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs font-bold">Focus Mode</span>
              </Button>
              <BranchSwitcher />
              <GlobalSearchDialog />
              <UserMenuDropdown />
            </div>
          </div>
        </div>
        <div className={cn("p-3 md:p-6", isMobile && "pb-24")}>{children}</div>
      </main>

      {isMobile && <MobileBottomNav />}
      <MobileQuickFab />
    </div>
  );
}
