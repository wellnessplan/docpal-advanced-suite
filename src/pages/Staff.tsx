import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, UserCog, Clock, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/supabase-paged";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

export default function Staff() {
  const { clinicId } = useAuth();
  const navigate = useNavigate();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["staff-profiles", clinicId],
    queryFn: async () => {
      return await fetchAllPaged<any>((from, to) =>
        supabase
          .from("profiles")
          .select("*")
          .eq("clinic_id", clinicId!)
          .order("full_name")
          .range(from, to)
      );
    },
    enabled: !!clinicId,
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Staff Management</h1>
            <p className="text-muted-foreground text-sm">{profiles.length} team members</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/settings?tab=team")}>
            <Plus className="h-3.5 w-3.5" /> Invite Staff
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : profiles.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <UserCog className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No staff members</h3>
              <p className="text-muted-foreground text-sm mt-1">Invite your team to manage clinic operations</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {(p.full_name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.full_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.role || "staff"} {p.specialization ? `· ${p.specialization}` : ""}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Attendance Today</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground text-center py-6">
              Attendance tracking coming soon
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> Leave Calendar</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground text-center py-6">
              Leave management coming soon
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
