import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useThemeLoader } from "@/hooks/useThemeLoader";
import { useSuperAdmin } from "@/hooks/useSubscription";
import MobileBottomNav from "./MobileBottomNav";
import InstallPromptBanner from "./InstallPromptBanner";
import GlobalSearchDialog from "./GlobalSearchDialog";
import {
  LayoutDashboard, Users, CalendarDays, Receipt, Megaphone,
  Settings, LogOut, ChevronLeft, ChevronRight,
  ListOrdered, Package, TrendingUp, BarChart3, Stethoscope,
  ChevronDown, ChevronUp, FlaskConical, TestTubes, ClipboardList,
  ClipboardCheck, Wallet, ShieldCheck, IndianRupee, Activity,
  Target, Star, Gift, Crown, UserCog, Plug, ScrollText, CalendarClock, Shield
} from "lucide-react";

interface NavGroup {
  label: string;
  groupIcon: React.ElementType;
  collapsible?: boolean;
  items: { href: string; label: string; icon: React.ElementType }[];
}

const navGroups: NavGroup[] = [
  {
    label: "OPERATIONS",
    groupIcon: Stethoscope,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dr-dashboard", label: "Dr Dashboard", icon: Stethoscope },
      { href: "/today-schedule", label: "Today's Schedule", icon: CalendarClock },
      { href: "/queue", label: "Queue", icon: ListOrdered },
      { href: "/tasks", label: "Follow-Ups", icon: ClipboardList },
    ],
  },
  {
    label: "PATIENTS",
    groupIcon: Users,
    collapsible: true,
    items: [
      { href: "/patients", label: "Patients", icon: Users },
      { href: "/appointments", label: "Appointments", icon: CalendarDays },
      { href: "/treatment-plans", label: "Treatment Plans", icon: ClipboardCheck },
      { href: "/lab-orders", label: "Lab Orders", icon: TestTubes },
      { href: "/ortho", label: "Orthodontics", icon: FlaskConical },
    ],
  },
  {
    label: "BILLING & FINANCE",
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
    label: "ANALYTICS",
    groupIcon: BarChart3,
    collapsible: true,
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/revenue", label: "Revenue", icon: IndianRupee },
      { href: "/performance", label: "Performance", icon: Activity },
    ],
  },
  {
    label: "GROWTH",
    groupIcon: Target,
    collapsible: true,
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/leads", label: "Leads", icon: Target },
      { href: "/reviews", label: "Feedback", icon: Star },
      { href: "/referrals", label: "Referrals", icon: Gift },
      { href: "/memberships", label: "Membership", icon: Crown },
    ],
  },
  {
    label: "ADMIN",
    groupIcon: Settings,
    collapsible: true,
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/staff", label: "Staff", icon: UserCog },
      { href: "/audit-log", label: "Audit Log", icon: ScrollText },
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
  const { data: isSuperAdmin } = useSuperAdmin();

  const allItems = navGroups.flatMap((g) => g.items);
  const currentPageLabel = allItems.find((i) => i.href === pathname || pathname.startsWith(i.href + "/"))?.label ?? "DoctorsBuddy";

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const isCurrentlyOpen = prev[label];
      // Close all groups, then toggle the clicked one
      const allClosed: Record<string, boolean> = {};
      navGroups.forEach(g => { if (g.collapsible) allClosed[g.label] = false; });
      return { ...allClosed, [label]: !isCurrentlyOpen };
    });
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some(i => pathname === i.href || pathname.startsWith(i.href + "/"));

  const initials = (profile?.full_name || "U").charAt(0).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {!isMobile && (
        <div className="p-2 pr-0 h-screen flex">
          <aside
            className={cn(
              "flex flex-col bg-sidebar/80 backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/[0.06]",
              collapsed ? "w-[60px]" : "w-[240px]"
            )}
          >
            {/* Logo */}
            <div className="flex h-14 items-center gap-2.5 px-3 pt-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-primary/25">
                <Stethoscope className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
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
                <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] p-2.5">
                  <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground ring-2 ring-sidebar-primary/20">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{profile?.full_name || "Doctor"}</p>
                    <p className="text-xs text-sidebar-foreground/70 truncate">{profile?.role || "Admin"}</p>
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
                      <div className="h-px bg-white/[0.06] mx-2 mb-2" />
                    )}

                    {!collapsed && group.collapsible ? (
                      <button
                        onClick={() => toggleGroup(group.label)}
                        className="flex w-full items-center justify-between px-2.5 mb-1 group/label"
                      >
                        <div className="flex items-center gap-1.5">
                          <group.groupIcon className="h-3.5 w-3.5 text-sidebar-foreground/50" />
                          <span className="text-[11px] font-bold tracking-[0.08em] text-sidebar-foreground/60 uppercase group-hover/label:text-sidebar-foreground/80 transition-colors">
                            {group.label}
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp className="h-3 w-3 text-sidebar-foreground/30" /> : <ChevronDown className="h-3 w-3 text-sidebar-foreground/30" />}
                      </button>
                    ) : !collapsed ? (
                      <div className="flex items-center gap-1.5 px-2.5 mb-1">
                        <group.groupIcon className="h-3.5 w-3.5 text-sidebar-foreground/50" />
                        <p className="text-[11px] font-bold tracking-[0.08em] text-sidebar-foreground/60 uppercase">
                          {group.label}
                        </p>
                      </div>
                    ) : null}

                    {(isExpanded || collapsed) && (
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                          return (
                            <Link
                              key={item.href}
                              to={item.href}
                              title={collapsed ? item.label : undefined}
                              className={cn(
                                "relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all duration-200",
                                isActive
                                  ? "bg-sidebar-primary/15 text-sidebar-primary shadow-sm backdrop-blur-sm"
                                  : "text-sidebar-foreground/90 hover:bg-white/[0.08] hover:text-white"
                              )}
                            >
                              <item.icon className={cn(
                                "h-[18px] w-[18px] shrink-0 transition-colors",
                                isActive && "text-sidebar-primary drop-shadow-[0_0_6px_hsl(var(--sidebar-primary)/0.4)]"
                              )} />
                              {!collapsed && <span>{item.label}</span>}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="p-2 space-y-0.5">
              {isSuperAdmin && (
                <Link
                  to="/super-admin"
                  title={collapsed ? "Super Admin" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors",
                    pathname === "/super-admin"
                      ? "bg-sidebar-primary/15 text-sidebar-primary"
                      : "text-amber-400 hover:bg-white/[0.08]"
                  )}
                >
                  <Shield className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>Super Admin</span>}
                </Link>
              )}
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] text-sidebar-foreground hover:bg-white/[0.06] transition-colors"
              >
                {collapsed ? <ChevronRight className="h-[18px] w-[18px]" /> : <ChevronLeft className="h-[18px] w-[18px]" />}
                {!collapsed && <span>Collapse</span>}
              </button>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
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
              <span className="text-xs md:text-sm text-muted-foreground hidden sm:block">{profile?.full_name || "User"}</span>
              <div className="h-7 w-7 md:h-8 md:w-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground ring-2 ring-primary/20">
                {initials}
              </div>
            </div>
          </div>
        </div>
        <div className={cn("p-4 md:p-6", isMobile && "pb-20")}>{children}</div>
      </main>

      {isMobile && <MobileBottomNav />}
    </div>
  );
}
