import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Wallet, Search, IndianRupee } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";

export default function Payments() {
  const { clinicId } = useAuth();
  const [search, setSearch] = useState("");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, patients(full_name, phone)")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicId,
  });

  const totalCollected = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Payments</h1>
            <p className="text-muted-foreground text-sm">₹{totalCollected.toLocaleString()} collected · {payments.length} payments</p>
          </div>
          <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Record Payment</Button>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { label: "Today", value: "₹0", color: "text-green-600" },
            { label: "This Week", value: "₹0", color: "text-blue-600" },
            { label: "Pending EMI", value: "₹0", color: "text-orange-600" },
            { label: "Overdue", value: "₹0", color: "text-red-600" },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search payments..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : payments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No payments recorded</h3>
              <p className="text-muted-foreground text-sm mt-1">Record your first payment to track collections</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {payments.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
                    <IndianRupee className="h-4 w-4 text-green-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.patients?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{p.payment_method} · {format(new Date(p.payment_date), "dd MMM yyyy")}</p>
                  </div>
                  <span className="font-bold text-green-700">₹{p.amount?.toLocaleString()}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
