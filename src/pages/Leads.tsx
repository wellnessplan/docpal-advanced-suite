import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, Search, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function Leads() {
  const { clinicId } = useAuth();
  const [search, setSearch] = useState("");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicId,
  });

  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    contacted: "bg-yellow-100 text-yellow-700",
    interested: "bg-purple-100 text-purple-700",
    converted: "bg-green-100 text-green-700",
    lost: "bg-red-100 text-red-700",
  };

  const filtered = leads.filter((l: any) =>
    l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone?.includes(search)
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Leads</h1>
            <p className="text-muted-foreground text-sm">{leads.filter((l: any) => l.status === "new").length} new leads · {leads.length} total</p>
          </div>
          <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Lead</Button>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {["new", "contacted", "interested", "converted", "lost"].map(status => (
            <Card key={status}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground capitalize">{status}</p>
                <p className="text-xl font-bold">{leads.filter((l: any) => l.status === status).length}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No leads yet</h3>
              <p className="text-muted-foreground text-sm mt-1">Capture enquiries from walk-ins, calls, or social media</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((lead: any) => (
              <Card key={lead.id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{lead.full_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.source} · {lead.interested_in || "General enquiry"}</p>
                  </div>
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="p-2 rounded-lg hover:bg-muted">
                      <Phone className="h-4 w-4 text-primary" />
                    </a>
                  )}
                  <Badge className={statusColors[lead.status] || ""} variant="secondary">{lead.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
