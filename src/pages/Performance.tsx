import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, Users, Armchair } from "lucide-react";

export default function Performance() {
  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold">Performance</h1>
          <p className="text-muted-foreground text-sm">Doctor productivity, chair utilization & patient satisfaction</p>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { label: "Patients Today", value: "0", icon: Users },
            { label: "Avg Wait Time", value: "0 min", icon: Clock },
            { label: "Chair Utilization", value: "0%", icon: Armchair },
            { label: "Patient Satisfaction", value: "N/A", icon: Activity },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xl font-bold">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Doctor-wise Revenue</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              Compare revenue generated per doctor this month
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Treatment Time Analysis</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              Average time per procedure type vs benchmarks
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
