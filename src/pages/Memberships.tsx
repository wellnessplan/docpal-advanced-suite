import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Crown, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export default function Memberships() {
  const { clinicId } = useAuth();

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ["memberships", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("memberships")
        .select("*, patients(full_name, phone)")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicId,
  });

  const active = memberships.filter((m: any) => m.status === "active").length;
  const totalRevenue = memberships.reduce((sum: number, m: any) => sum + (m.amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Membership Plans</h1>
            <p className="text-muted-foreground text-sm">{active} active members · ₹{totalRevenue.toLocaleString()} revenue</p>
          </div>
          <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Enroll Patient</Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : memberships.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Crown className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No memberships</h3>
              <p className="text-muted-foreground text-sm mt-1">Create dental care plans to generate recurring revenue</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {memberships.map((m: any) => (
              <Card key={m.id}>
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
                    <Crown className="h-4 w-4 text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{m.patients?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{m.plan_name} · ₹{m.amount} · {m.end_date ? `Expires ${format(new Date(m.end_date), "dd MMM yyyy")}` : "No expiry"}</p>
                  </div>
                  <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
