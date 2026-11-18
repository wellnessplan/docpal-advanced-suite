import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Crown,
  FlaskConical,
  Gift,
  IndianRupee,
  Library,
  ListOrdered,
  Megaphone,
  MessageCircle,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Star,
  Target,
  TestTubes,
  Truck,
  UserCog,
  Users,
  Wallet,
  LogOut,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileMoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sections = [
  {
    label: "Patient Care",
    icon: Users,
    items: [
      { href: "/patients", label: "Patients", icon: Users },
      { href: "/appointments", label: "Appointments", icon: CalendarDays },
      { href: "/queue", label: "Queue", icon: ListOrdered },
      { href: "/today-schedule", label: "Calendar", icon: CalendarClock },
      { href: "/tasks", label: "Follow-Ups", icon: ClipboardList },
      { href: "/treatment-plans", label: "Treatment Plans", icon: ClipboardCheck },
      { href: "/lab-orders", label: "Lab Orders", icon: TestTubes },
    ],
  },
  {
    label: "Finance",
    icon: IndianRupee,
    items: [
      { href: "/finance-hub", label: "Billing & Payments", icon: Receipt },
      { href: "/inventory", label: "Inventory", icon: Package },
    ],
  },
  {
    label: "Analytics",
    icon: BarChart3,
    items: [{ href: "/analytics", label: "Reports & Insights", icon: BarChart3 }],
  },
  {
    label: "Communication",
    icon: MessageCircle,
    items: [{ href: "/whatsapp", label: "WhatsApp", icon: MessageCircle }],
  },
  {
    label: "More Tools",
    icon: Library,
    items: [
      { href: "/memberships", label: "Memberships", icon: Crown },
      { href: "/ortho", label: "Orthodontics", icon: FlaskConical },
      { href: "/patient-education", label: "Patient Education", icon: Library },
      { href: "/displays", label: "Clinic Screens / TV", icon: Activity },
      { href: "/reviews", label: "Feedback", icon: Star },
      { href: "/google-reviews", label: "Google Reviews", icon: Star },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/programs", label: "Patient Programs", icon: Gift },
      { href: "/social-calendar", label: "Social Calendar", icon: CalendarDays },
      { href: "/leads", label: "Leads", icon: Target },
      { href: "/referrals", label: "Referrals", icon: Gift },
      { href: "/partners", label: "Partners", icon: Package },
    ],
  },
] as const;

const adminItems = [
  { href: "/settings?tab=team", label: "Team", icon: UserCog, roles: ["owner", "admin"] },
  { href: "/settings?tab=branches", label: "Branches", icon: Building2, roles: ["owner", "admin"] },
  { href: "/settings?tab=vendors", label: "Vendors & Suppliers", icon: Truck, roles: ["owner", "admin"] },
  { href: "/settings?tab=tpa", label: "TPAs", icon: ShieldCheck, roles: ["owner", "admin"] },
  { href: "/staff", label: "Staff", icon: UserCog },
  { href: "/audit-log", label: "Audit Log", icon: ClipboardList },
];

function isActivePath(pathname: string, href: string) {
  const path = href.split("?")[0];
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function MobileMoreDrawer({ open, onOpenChange }: MobileMoreDrawerProps) {
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();
  const role = profile?.role as string | undefined;
  const visibleAdminItems = adminItems.filter((item) => !item.roles || item.roles.includes(role ?? ""));

  const quickLinks = [
    { href: "/today-schedule", label: "Schedule", icon: CalendarClock },
    { href: "/appointments", label: "Appointments", icon: CalendarDays },
    { href: "/finance-hub", label: "Billing", icon: Receipt },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="font-heading">More</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <nav aria-label="Quick links" className="grid grid-cols-3 gap-2 pb-4">
            {quickLinks.map((item) => (
              <Button key={item.href} asChild variant="outline" className="h-auto min-h-16 flex-col gap-1.5 px-2 py-3">
                <Link to={item.href} onClick={() => onOpenChange(false)}>
                  <item.icon className="h-5 w-5" />
                  <span className="text-xs">{item.label}</span>
                </Link>
              </Button>
            ))}
          </nav>

          <div className="divide-y divide-border border-y border-border">
            {sections.map((section) => {
              const active = section.items.some((item) => isActivePath(pathname, item.href));
              return (
                <details key={section.label} open={active} className="group py-1">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    <section.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{section.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">{section.items.length}</span>
                  </summary>
                  <div className="grid grid-cols-2 gap-1 pb-2 pl-6">
                    {section.items.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          "flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                          isActivePath(pathname, item.href) && "bg-accent text-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="leading-tight">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </details>
              );
            })}

            <details open={visibleAdminItems.some((item) => isActivePath(pathname, item.href))} className="group py-1">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <UserCog className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Administration</span>
                <span className="text-xs font-normal text-muted-foreground">{visibleAdminItems.length}</span>
              </summary>
              <div className="grid grid-cols-2 gap-1 pb-2 pl-6">
                {visibleAdminItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      isActivePath(pathname, item.href) && "bg-accent text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="leading-tight">{item.label}</span>
                  </Link>
                ))}
              </div>
            </details>
          </div>

          <div className="flex gap-2 pt-4">
            <Button asChild variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              <Link to="/settings"><Settings className="h-4 w-4" />Settings</Link>
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => { signOut(); onOpenChange(false); }}>
              <LogOut className="h-4 w-4" />Sign Out
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}