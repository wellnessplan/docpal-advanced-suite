import { lazy, Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Receipt, Wallet, ShieldCheck, Crown } from "lucide-react";

const Billing = lazy(() => import("./Billing"));
const Payments = lazy(() => import("./Payments"));
const InsuranceClaims = lazy(() => import("./InsuranceClaims"));
const Memberships = lazy(() => import("./Memberships"));

const TABS = [
  { v: "billing", label: "Billing", icon: Receipt, C: Billing },
  { v: "payments", label: "Payments", icon: Wallet, C: Payments },
  { v: "insurance", label: "Insurance", icon: ShieldCheck, C: InsuranceClaims },
  { v: "memberships", label: "Memberships", icon: Crown, C: Memberships },
];

export default function FinanceHub() {
  const [sp, setSp] = useSearchParams();
  const active = useMemo(() => {
    const t = sp.get("tab");
    return TABS.some(x => x.v === t) ? t! : "billing";
  }, [sp]);

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <Tabs value={active} onValueChange={v => { const n = new URLSearchParams(sp); n.set("tab", v); setSp(n, { replace: true }); }}>
          <TabsList className="w-full flex-wrap h-auto">
            {TABS.map(t => (
              <TabsTrigger key={t.v} value={t.v} className="flex-1 gap-1 text-xs min-w-[100px]">
                <t.icon className="h-3 w-3" />{t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map(t => (
            <TabsContent key={t.v} value={t.v} className="mt-3">
              {active === t.v && (
                <Suspense fallback={<div className="text-xs text-muted-foreground p-4">Loading…</div>}>
                  <t.C />
                </Suspense>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
