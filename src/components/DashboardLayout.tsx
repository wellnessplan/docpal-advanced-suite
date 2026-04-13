import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileBottomNav from "./MobileBottomNav";
import InstallPromptBanner from "./InstallPromptBanner";
import {
  LayoutDashboard, Users, CalendarDays, Receipt, Megaphone,
  Settings, LogOut, ChevronLeft, ChevronRight,
  ListOrdered, Package, TrendingUp, BarChart3, Stethoscope,
  ChevronDown, ChevronUp, FlaskConical, Briefcase, Rocket, TestTubes, ClipboardList
} from "lucide-react";

interface NavGroup {
  label: string;
  groupIcon: React.ElementType;
  collapsible?: boolean;
  items: { href: string; label: string; icon: React.ElementType }[];
}

const navGroups: NavGroup[] = [
  {
    label: "CLINIC",
    groupIcon: Stethoscope,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/tasks", label: "Today's Tasks", icon: ClipboardList },
      { href: "/queue", label: "Queue", icon: ListOrdered },
    ],
  },
  {
    label: "PATIENTS",
    groupIcon: Users,
    collapsible: true,
    items: [
      { href: "/patients", label: "Patients", icon: Users },
      { href: "/appointments", label: "Appointments", icon: CalendarDays },
      { href: "/lab-orders", label: "Lab Orders", icon: TestTubes },
      { href: "/ortho", label: "Orthodontics", icon: FlaskConical },
    ],
  },
  {
    label: "FINANCE",
    groupIcon: Briefcase,
    collapsible: true,
    items: [
      { href: "/billing", label: "Billing", icon: Receipt },
      { href: "/finance", label: "Finance", icon: TrendingUp },
      { href: "/inventory", label: "Inventory", icon: Package },
    ],
  },
  {
    label: "GROWTH",
    groupIcon: Rocket,
    collapsible: true,
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
    ],
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const isMobile = useIsMobile();

  const allItems = navGroups.flatMap((g) => g.items);
  const currentPageLabel = allItems.find((i) => i.href === pathname || pathname.startsWith(i.href + "/"))?.label
    ?? (pathname === "/settings" ? "Settings" : "DoctorsBuddy");

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some(i => pathname === i.href || pathname.startsWith(i.href + "/"));

  const initials = (profile?.full_name || "U").charAt(0).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — hidden on mobile */}
      {!isMobile && (
        <aside
          className={cn(
            "flex flex-col bg-sidebar transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            collapsed ? "w-[60px]" : "w-[240px]"
          )}
        >
          {/* Logo */}
          <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary shadow-md shadow-primary/20">
              <Stethoscope className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="font-heading text-sm font-bold text-sidebar-primary-foreground tracking-tight">
                DoctorsBuddy
              </span>
            )}
          </div>

          {/* User mini-profile */}
          {!collapsed && (
            <div className="px-3 py-3 border-b border-sidebar-border">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground ring-2 ring-sidebar-primary/20">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate">{profile?.full_name || "Doctor"}</p>
                  <p className="text-[10px] text-sidebar-foreground/50 truncate">{profile?.role || "Admin"}</p>
                </div>
              </div>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
            {navGroups.map((group, gi) => {
              const groupActive = isGroupActive(group);
              const isExpanded = group.collapsible ? (expandedGroups[group.label] ?? groupActive) : true;

              return (
                <div key={group.label} className={gi > 0 ? "pt-2" : ""}>
                  {/* Group separator line */}
                  {gi > 0 && !collapsed && (
                    <div className="h-px bg-sidebar-border mx-2 mb-2" />
                  )}

                  {!collapsed && group.collapsible ? (
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="flex w-full items-center justify-between px-2.5 mb-1 group/label"
                    >
                      <div className="flex items-center gap-1.5">
                        <group.groupIcon className="h-3 w-3 text-sidebar-foreground/30" />
                        <span className="text-[10px] font-semibold tracking-[0.08em] text-sidebar-foreground/40 uppercase group-hover/label:text-sidebar-foreground/60 transition-colors">
                          {group.label}
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp className="h-3 w-3 text-sidebar-foreground/30" /> : <ChevronDown className="h-3 w-3 text-sidebar-foreground/30" />}
                    </button>
                  ) : !collapsed ? (
                    <div className="flex items-center gap-1.5 px-2.5 mb-1">
                      <group.groupIcon className="h-3 w-3 text-sidebar-foreground/30" />
                      <p className="text-[10px] font-semibold tracking-[0.08em] text-sidebar-foreground/40 uppercase">
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
                              "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-200",
                              isActive
                                ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                            )}
                          >
                            {isActive && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-sidebar-primary shadow-[0_0_8px_hsl(var(--sidebar-primary)/0.5)]" />
                            )}
                            <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-sidebar-primary")} />
                            {!collapsed && <span>{item.label}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Settings */}
            <div className="pt-2">
              {!collapsed && <div className="h-px bg-sidebar-border mx-2 mb-2" />}
              {!collapsed && (
                <div className="flex items-center gap-1.5 px-2.5 mb-1">
                  <Settings className="h-3 w-3 text-sidebar-foreground/30" />
                  <p className="text-[10px] font-semibold tracking-[0.08em] text-sidebar-foreground/40 uppercase">
                    SETTINGS
                  </p>
                </div>
              )}
              <Link
                to="/settings"
                title={collapsed ? "Settings" : undefined}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-200",
                  pathname === "/settings"
                    ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                {pathname === "/settings" && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-sidebar-primary shadow-[0_0_8px_hsl(var(--sidebar-primary)/0.5)]" />
                )}
                <Settings className={cn("h-[18px] w-[18px] shrink-0", pathname === "/settings" && "text-sidebar-primary")} />
                {!collapsed && <span>Settings</span>}
              </Link>
            </div>
          </nav>

          <div className="border-t border-sidebar-border p-2 space-y-0.5">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
            >
              {collapsed ? <ChevronRight className="h-[18px] w-[18px]" /> : <ChevronLeft className="h-[18px] w-[18px]" />}
              {!collapsed && <span>Collapse</span>}
            </button>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <InstallPromptBanner />
        <div className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base md:text-lg font-semibold text-foreground">{currentPageLabel}</h2>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-xs md:text-sm text-muted-foreground hidden sm:block">{profile?.full_name || "User"}</span>
              <div className="h-7 w-7 md:h-8 md:w-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground ring-2 ring-primary/20">
                {initials}
              </div>
            </div>
          </div>
        </div>
        <div className={cn("p-4 md:p-6", isMobile && "pb-20")}>{children}</div>
      </main>

      {/* Mobile bottom nav */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
}
