import { lazy, Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, Activity, FileText, IndianRupee } from "lucide-react";

const Revenue = lazy(() => import("./Revenue"));
const Performance = lazy(() => import("./Performance"));
const Reports = lazy(() => import("./Reports"));
const Finance = lazy(() => import("./Finance"));

const TABS = [
  { v: "revenue", label: "Revenue", icon: IndianRupee, C: Revenue },
  { v: "performance", label: "Performance", icon: Activity, C: Performance },
  { v: "reports", label: "Reports", icon: FileText, C: Reports },
  { v: "pnl", label: "P&L / Finance", icon: TrendingUp, C: Finance },
];

export default function AnalyticsHub() {
  const [sp, setSp] = useSearchParams();
  const active = useMemo(() => {
    const t = sp.get("tab");
    return TABS.some(x => x.v === t) ? t! : "revenue";
  }, [sp]);

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <Tabs value={active} onValueChange={v => { const n = new URLSearchParams(sp); n.set("tab", v); setSp(n, { replace: true }); }}>
          <TabsList className="w-full flex-wrap h-auto">
            {TABS.map(t => (
              <TabsTrigger key={t.v} value={t.v} className="flex-1 gap-1 text-xs min-w-[110px]">
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
