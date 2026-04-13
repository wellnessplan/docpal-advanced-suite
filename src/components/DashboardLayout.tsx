import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, CalendarDays, Receipt, Megaphone,
  Sparkles, MessageSquare, Settings, LogOut, ChevronLeft, ChevronRight,
  ListOrdered, Package, TrendingUp, BarChart3, Waypoints, Stethoscope,
  IndianRupee, ChevronDown, ChevronUp
} from "lucide-react";

interface NavGroup {
  label: string;
  collapsible?: boolean;
  items: { href: string; label: string; icon: React.ElementType }[];
}

const navGroups: NavGroup[] = [
  {
    label: "CLINIC",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/queue", label: "Queue", icon: ListOrdered },
      { href: "/patients", label: "Patients", icon: Users },
      { href: "/appointments", label: "Appointments", icon: CalendarDays },
      { href: "/ortho", label: "Orthodontics", icon: Waypoints },
    ],
  },
  {
    label: "OPERATIONS",
    collapsible: true,
    items: [
      { href: "/billing", label: "Billing", icon: Receipt },
      { href: "/finance", label: "Finance", icon: TrendingUp },
      { href: "/treatment-costing", label: "Treatment Pricing", icon: IndianRupee },
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "GROWTH",
    collapsible: true,
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
      { href: "/ai-generator", label: "AI Generator", icon: Sparkles },
    ],
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const allItems = navGroups.flatMap((g) => g.items);
  const currentPageLabel = allItems.find((i) => i.href === pathname || pathname.startsWith(i.href + "/"))?.label
    ?? (pathname === "/settings" ? "Settings" : "DoctorsBuddy");

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some(i => pathname === i.href || pathname.startsWith(i.href + "/"));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "flex flex-col bg-sidebar transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed ? "w-[60px]" : "w-[240px]"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
            <Stethoscope className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-heading text-sm font-bold text-sidebar-primary-foreground tracking-tight">
              DoctorsBuddy
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
          {navGroups.map((group) => {
            const groupActive = isGroupActive(group);
            const isExpanded = group.collapsible ? (expandedGroups[group.label] ?? groupActive) : true;

            return (
              <div key={group.label}>
                {!collapsed && group.collapsible ? (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="flex w-full items-center justify-between px-2 mb-1 text-[10px] font-semibold tracking-[0.08em] text-sidebar-foreground/50 uppercase hover:text-sidebar-foreground/70 transition-colors"
                  >
                    <span>{group.label}</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                ) : !collapsed ? (
                  <p className="px-2 mb-1 text-[10px] font-semibold tracking-[0.08em] text-sidebar-foreground/50 uppercase">
                    {group.label}
                  </p>
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
                            "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-primary"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sidebar-primary" />
                          )}
                          <item.icon className="h-[18px] w-[18px] shrink-0" />
                          {!collapsed && <span>{item.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Settings always visible */}
          <div>
            {!collapsed && (
              <p className="px-2 mb-1 text-[10px] font-semibold tracking-[0.08em] text-sidebar-foreground/50 uppercase">
                SETTINGS
              </p>
            )}
            <Link
              to="/settings"
              title={collapsed ? "Settings" : undefined}
              className={cn(
                "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
                pathname === "/settings"
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              {pathname === "/settings" && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sidebar-primary" />
              )}
              <Settings className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>Settings</span>}
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-2 space-y-0.5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            {collapsed ? <ChevronRight className="h-[18px] w-[18px]" /> : <ChevronLeft className="h-[18px] w-[18px]" />}
            {!collapsed && <span>Collapse</span>}
          </button>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md px-6 py-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-foreground">{currentPageLabel}</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{profile?.full_name || "User"}</span>
              <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                {(profile?.full_name || "U").charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
