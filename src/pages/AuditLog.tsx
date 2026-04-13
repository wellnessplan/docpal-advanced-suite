import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";

export default function AuditLog() {
  const { clinicId } = useAuth();
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-log", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!clinicId,
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground text-sm">Track all actions performed in your clinic</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search actions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : logs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ScrollText className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No activity recorded</h3>
              <p className="text-muted-foreground text-sm mt-1">Actions will be logged here as your team uses the system</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1">
            {logs.map((log: any) => (
              <Card key={log.id}>
                <CardContent className="flex items-center gap-3 py-2.5 px-4 text-sm">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <span className="font-medium">{log.user_name || "System"}</span>
                  <span className="text-muted-foreground">{log.action}</span>
                  {log.table_name && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{log.table_name}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{format(new Date(log.created_at), "dd MMM, HH:mm")}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
