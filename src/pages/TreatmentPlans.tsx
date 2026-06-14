import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/supabase-paged";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function TreatmentPlans() {
  const { clinicId } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["treatment-plans", clinicId],
    queryFn: async () => fetchAllPaged((from, to) =>
      supabase
        .from("treatment_plans")
        .select("*, patients(full_name, phone)")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false }).range(from, to)
    , { maxRows: 5000 }),
    enabled: !!clinicId,
  });

  const filtered = plans.filter((p: any) =>
    p.patients?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.plan_name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    proposed: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
    "in-progress": "bg-yellow-100 text-yellow-700",
    completed: "bg-emerald-100 text-emerald-700",
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Treatment Plans</h1>
            <p className="text-muted-foreground text-sm">{plans.length} plans total</p>
          </div>
          <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New Plan</Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search plans..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No treatment plans yet</h3>
              <p className="text-muted-foreground text-sm mt-1">Create treatment plans from the dental chart or click "New Plan"</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((plan: any) => (
              <Card key={plan.id} onClick={() => plan.patient_id && navigate(`/dental-chart/${plan.patient_id}?tab=canvas`)} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{plan.patients?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{plan.plan_name}</p>
                    </div>
                    <Badge className={statusColors[plan.status] || ""}>{plan.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Rs {plan.total_estimated_cost?.toLocaleString() || 0}</span>
                    <span>{format(new Date(plan.created_at), "dd MMM yyyy")}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
