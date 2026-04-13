import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ShieldCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";

export default function InsuranceClaims() {
  const { clinicId } = useAuth();
  const [search, setSearch] = useState("");

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["insurance-claims", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("insurance_claims")
        .select("*, patients(full_name, phone)")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicId,
  });

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-blue-100 text-blue-700",
    "pre-auth-pending": "bg-yellow-100 text-yellow-700",
    "pre-auth-approved": "bg-green-100 text-green-700",
    "claim-submitted": "bg-purple-100 text-purple-700",
    settled: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Insurance & Claims</h1>
            <p className="text-muted-foreground text-sm">{claims.length} claims tracked</p>
          </div>
          <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New Claim</Button>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { label: "Pending Pre-Auth", value: claims.filter((c: any) => c.pre_auth_status === "pending").length, color: "text-yellow-600" },
            { label: "Claims Submitted", value: claims.filter((c: any) => c.status === "claim-submitted").length, color: "text-blue-600" },
            { label: "Settled", value: claims.filter((c: any) => c.status === "settled").length, color: "text-green-600" },
            { label: "Rejected", value: claims.filter((c: any) => c.status === "rejected").length, color: "text-red-600" },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search claims..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : claims.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No insurance claims</h3>
              <p className="text-muted-foreground text-sm mt-1">Submit your first insurance claim to track pre-auth and settlements</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {claims.map((claim: any) => (
              <Card key={claim.id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{claim.patients?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{claim.insurer_name} · {claim.claim_number || "No claim #"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">₹{claim.claim_amount?.toLocaleString() || 0}</p>
                    <Badge className={statusColors[claim.status] || ""} variant="secondary">{claim.status}</Badge>
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
