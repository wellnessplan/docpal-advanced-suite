import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MessageCircle, Search } from "lucide-react";

type Row = {
  id: string;
  patient_id: string;
  template_name: string;
  phone: string | null;
  status: string;
  delivery_status: string | null;
  sent_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  read: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  failed: "bg-destructive/15 text-destructive",
};

function StatusBadge({ value }: { value: string | null }) {
  const v = (value ?? "queued").toLowerCase();
  return <Badge className={`capitalize ${STATUS_COLOR[v] ?? "bg-muted"}`}>{v}</Badge>;
}

export default function WhatsAppStatus() {
  const { clinicId } = useAuth();
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["wa-status", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_logs")
        .select("id, patient_id, template_name, phone, status, delivery_status, sent_at")
        .eq("clinic_id", clinicId!)
        .order("sent_at", { ascending: false })
        .limit(200);
      return (data ?? []) as Row[];
    },
    enabled: !!clinicId,
    refetchInterval: 15_000,
  });

  const filtered = rows.filter(
    (r) =>
      !search ||
      r.phone?.includes(search) ||
      r.template_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold">WhatsApp Delivery Status</h1>
          <p className="text-muted-foreground text-sm">
            Live queue · sent · delivered · read state for outbound messages.
          </p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search phone or template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No messages yet</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Outbound WhatsApp messages will appear here as they are queued.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent messages</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="divide-y">
                {filtered.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/40"
                  >
                    <span className="font-medium truncate min-w-0 flex-1">{r.template_name}</span>
                    <span className="text-muted-foreground hidden sm:inline">{r.phone ?? "—"}</span>
                    <StatusBadge value={r.delivery_status ?? r.status} />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {format(new Date(r.sent_at), "dd MMM HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
