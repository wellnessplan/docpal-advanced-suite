// Map of route base path -> dynamic import. Used to warm up chunks on hover.
const map: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("@/pages/Dashboard"),
  "/dr-dashboard": () => import("@/pages/DrDashboard"),
  "/today-schedule": () => import("@/pages/TodaySchedule"),
  "/patients": () => import("@/pages/Patients"),
  "/appointments": () => import("@/pages/Appointments"),
  "/treatment-plans": () => import("@/pages/TreatmentPlans"),
  "/billing": () => import("@/pages/Billing"),
  "/payments": () => import("@/pages/Payments"),
  "/insurance": () => import("@/pages/InsuranceClaims"),
  "/campaigns": () => import("@/pages/Campaigns"),
  "/whatsapp": () => import("@/pages/WhatsApp"),
  "/queue": () => import("@/pages/Queue"),
  "/lab-orders": () => import("@/pages/LabOrders"),
  "/tasks": () => import("@/pages/Tasks"),
  "/inventory": () => import("@/pages/Inventory"),
  "/treatment-costing": () => import("@/pages/TreatmentCosting"),
  "/finance": () => import("@/pages/Finance"),
  "/reports": () => import("@/pages/Reports"),
  "/revenue": () => import("@/pages/Revenue"),
  "/performance": () => import("@/pages/Performance"),
  "/leads": () => import("@/pages/Leads"),
  "/reviews": () => import("@/pages/Reviews"),
  "/referrals": () => import("@/pages/Referrals"),
  "/memberships": () => import("@/pages/Memberships"),
  "/staff": () => import("@/pages/Staff"),
  "/integrations": () => import("@/pages/Integrations"),
  "/audit-log": () => import("@/pages/AuditLog"),
  "/ortho": () => import("@/pages/Orthodontics"),
  "/social-calendar": () => import("@/pages/SocialCalendar"),
  "/settings": () => import("@/pages/Settings"),
};

const warmed = new Set<string>();

export function prefetchRoute(href: string) {
  const base = href.split("?")[0];
  if (warmed.has(base)) return;
  const loader = map[base];
  if (!loader) return;
  warmed.add(base);
  loader().catch(() => warmed.delete(base));
}
