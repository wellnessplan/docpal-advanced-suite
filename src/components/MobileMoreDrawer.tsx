import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  CalendarDays, Receipt, TrendingUp, Package, BarChart3,
  Megaphone, Settings, LogOut, Stethoscope, FlaskConical, TestTubes, ClipboardList,
  ClipboardCheck, Wallet, ShieldCheck, IndianRupee, Activity,
  Target, Star, Gift, Crown, UserCog, Plug, ScrollText, CalendarClock, ListOrdered
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const sections = [
  {
    label: "Operations",
    items: [
      { href: "/today-schedule", label: "Schedule", icon: CalendarClock },
      { href: "/queue", label: "Queue", icon: ListOrdered },
      { href: "/tasks", label: "Tasks", icon: ClipboardList },
    ],
  },
  {
    label: "Patients",
    items: [
      { href: "/appointments", label: "Appointments", icon: CalendarDays },
      { href: "/treatment-plans", label: "Tx Plans", icon: ClipboardCheck },
      { href: "/lab-orders", label: "Lab Orders", icon: TestTubes },
      { href: "/ortho", label: "Orthodontics", icon: FlaskConical },
    ],
  },
  {
    label: "Billing & Finance",
    items: [
      { href: "/billing", label: "Invoices", icon: Receipt },
      { href: "/payments", label: "Payments", icon: Wallet },
      { href: "/insurance", label: "Insurance", icon: ShieldCheck },
      { href: "/finance", label: "Expenses", icon: TrendingUp },
      { href: "/inventory", label: "Inventory", icon: Package },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/revenue", label: "Revenue", icon: IndianRupee },
      { href: "/performance", label: "Performance", icon: Activity },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/leads", label: "Leads", icon: Target },
      { href: "/reviews", label: "Feedback", icon: Star },
      { href: "/referrals", label: "Referrals", icon: Gift },
      { href: "/memberships", label: "Membership", icon: Crown },
    ],
  },
  {
    label: "Partners",
    items: [
      { href: "/partners", label: "Partners", icon: Package },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/staff", label: "Staff", icon: UserCog },
      { href: "/audit-log", label: "Audit Log", icon: ScrollText },
    ],
  },
];

interface MobileMoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileMoreDrawer({ open, onOpenChange }: MobileMoreDrawerProps) {
  const { signOut } = useAuth();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <Stethoscope className="h-4 w-4 text-primary-foreground" />
            </div>
            <DrawerTitle className="font-heading">DoctorsBuddy</DrawerTitle>
          </div>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-4 overflow-y-auto">
          {sections.map(section => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase mb-2">
                {section.label}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {section.items.map(item => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => onOpenChange(false)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 hover:bg-accent transition-colors min-h-[72px] justify-center"
                  >
                    <item.icon className="h-5 w-5 text-primary" />
                    <span className="text-[11px] font-medium text-center leading-tight">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div className="border-t pt-3 space-y-1">
            <Link
              to="/settings"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted min-h-[44px]"
            >
              <Settings className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Settings</span>
            </Link>
            <button
              onClick={() => { signOut(); onOpenChange(false); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted w-full text-left min-h-[44px]"
            >
              <LogOut className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium text-destructive">Sign Out</span>
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
