import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSubscription";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, Eye, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Filter = "open" | "resolved" | "all";

export default function IncidentsPage() {
  const { data: isSuperAdmin, isLoading: checkingAdmin } = useSuperAdmin();
  const [filter, setFilter] = useState<Filter>("open");
  const [selected, setSelected] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: errors = [], refetch, isFetching } = useQuery({
    queryKey: ["error-logs", filter],
    queryFn: async () => {
      let q = supabase.from("error_logs" as any).select("*").order("created_at", { ascending: false }).limit(200);
      if (filter === "open") q = q.eq("resolved", false);
      else if (filter === "resolved") q = q.eq("resolved", true);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: !!isSuperAdmin,
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("error_logs" as any) as any)
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Incident marked resolved");
      queryClient.invalidateQueries({ queryKey: ["error-logs"] });
      setSelected(null);
    },
  });

  if (checkingAdmin) {
    return <DashboardLayout><div className="text-muted-foreground">Loading...</div></DashboardLayout>;
  }

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <Card className="border-0 shadow-card">
          <CardContent className="py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
            <p className="font-medium">Super admin access required</p>
            <p className="text-sm text-muted-foreground mt-1">This page is restricted to platform administrators.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const counts = {
    open: errors.filter((e) => !e.resolved).length,
    total: errors.length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-warning" />
              Incidents
            </h1>
            <p className="text-sm text-muted-foreground">Frontend & backend errors captured across all clinics</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="open">Open ({counts.open})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="shadow-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Error log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {errors.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No incidents — system is healthy! 🎉</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Level</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Source</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Message</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">When</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => setSelected(e)}
                      >
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[10px] ${levelColor(e.level)}`}>
                            {e.level}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{e.source}</td>
                        <td className="px-4 py-3 max-w-md truncate text-foreground">{e.message}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {format(new Date(e.created_at), "MMM d, h:mm a")}
                        </td>
                        <td className="px-4 py-3">
                          {e.resolved ? (
                            <Badge variant="outline" className="text-[10px] border-success/40 text-success bg-success/5">
                              resolved
                            </Badge>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2"><Eye className="h-3.5 w-3.5" /></Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Incident details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <Field label="Message" value={selected.message} mono />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Level" value={selected.level} />
                <Field label="Source" value={selected.source} />
                <Field label="When" value={format(new Date(selected.created_at), "PPpp")} />
                <Field label="URL" value={selected.url || "-"} />
              </div>
              {selected.stack && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Stack trace</p>
                  <pre className="text-[11px] bg-muted/50 p-3 rounded-lg overflow-auto max-h-60 font-mono whitespace-pre-wrap">{selected.stack}</pre>
                </div>
              )}
              {selected.context && Object.keys(selected.context).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Context</p>
                  <pre className="text-[11px] bg-muted/50 p-3 rounded-lg overflow-auto font-mono">
                    {JSON.stringify(selected.context, null, 2)}
                  </pre>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t">
                {!selected.resolved && (
                  <Button size="sm" onClick={() => resolve.mutate(selected.id)} disabled={resolve.isPending}>
                    Mark resolved
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function levelColor(l: string) {
  if (l === "error") return "border-destructive/40 text-destructive bg-destructive/5";
  if (l === "warning") return "border-warning/40 text-warning bg-warning/5";
  return "border-primary/40 text-primary bg-primary/5";
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
      <p className={`text-sm break-words ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
