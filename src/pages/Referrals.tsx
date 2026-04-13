import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Gift, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function Referrals() {
  const { clinicId } = useAuth();

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["referrals", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("referrals")
        .select("*, patients:referring_patient_id(full_name)")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicId,
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Referral Program</h1>
            <p className="text-muted-foreground text-sm">{referrals.filter((r: any) => r.status === "converted").length} converted · {referrals.length} total referrals</p>
          </div>
          <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Referral</Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : referrals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Gift className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No referrals yet</h3>
              <p className="text-muted-foreground text-sm mt-1">Start your patient referral program to grow organically</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {referrals.map((ref: any) => (
              <Card key={ref.id}>
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center">
                    <Users className="h-4 w-4 text-purple-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{ref.patients?.full_name} → {ref.referred_name}</p>
                    <p className="text-xs text-muted-foreground">{ref.reward_type}: ₹{ref.reward_amount}</p>
                  </div>
                  <Badge variant="secondary">{ref.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
