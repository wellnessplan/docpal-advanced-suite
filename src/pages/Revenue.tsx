import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";

export default function Revenue() {
  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold">Revenue Analytics</h1>
          <p className="text-muted-foreground text-sm">Track income trends and identify growth opportunities</p>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { label: "Today", value: "₹0", icon: IndianRupee, trend: "+0%", up: true },
            { label: "This Month", value: "₹0", icon: TrendingUp, trend: "+0%", up: true },
            { label: "Outstanding", value: "₹0", icon: TrendingDown, trend: "", up: false },
            { label: "Avg per Patient", value: "₹0", icon: ArrowUpRight, trend: "+0%", up: true },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xl font-bold">{kpi.value}</p>
                {kpi.trend && (
                  <p className={`text-xs mt-1 ${kpi.up ? "text-green-600" : "text-red-600"}`}>{kpi.trend} vs last month</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Revenue by Treatment</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              Chart coming soon — tracks revenue breakdown by procedure type
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Monthly Trend</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              Chart coming soon — month-over-month revenue comparison
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue Leakage</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            Identifies unpaid invoices, missed follow-ups, and cancelled treatments with potential revenue loss
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
