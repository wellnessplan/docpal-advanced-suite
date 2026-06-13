import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Bug } from "lucide-react";
import { format } from "date-fns";

const LEVEL_TONES: Record<string, string> = {
  error: "bg-destructive/15 text-destructive border-destructive/30",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
};

export default function SupportInboxTab() {
  const qc = useQueryClient();
  const [showResolved, setShowResolved] = useState(false);

  const { data: errors = [] } = useQuery({
    queryKey: ["support-errors", showResolved],
    queryFn: async () => {
      let q = supabase.from("error_logs").select("*, clinics(name)").order("created_at", { ascending: false }).limit(200);
      if (!showResolved) q = q.eq("resolved", false);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: failures = [] } = useQuery({
    queryKey: ["support-failures"],
    queryFn: async () => {
      const { data } = await supabase.from("edge_function_failures")
        .select("*, clinics(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("error_logs")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-errors"] });
      toast.success("Marked resolved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="errors">
        <TabsList>
          <TabsTrigger value="errors"><AlertTriangle className="h-3.5 w-3.5 mr-1" />Errors ({(errors as any[]).length})</TabsTrigger>
          <TabsTrigger value="jobs"><Bug className="h-3.5 w-3.5 mr-1" />Failed jobs ({(failures as any[]).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="errors" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowResolved((s) => !s)}>
              {showResolved ? "Hide resolved" : "Show resolved"}
            </Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(errors as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">All clear — no open errors</TableCell></TableRow>
                  ) : (errors as any[]).map((e: any) => (
                    <TableRow key={e.id} className={e.resolved ? "opacity-60" : ""}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(e.created_at), "MMM d, HH:mm")}</TableCell>
                      <TableCell className="text-sm">{e.clinics?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={LEVEL_TONES[e.level] || ""}>{e.level}</Badge></TableCell>
                      <TableCell className="text-sm max-w-md truncate" title={e.message}>{e.message}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.source || "—"}</TableCell>
                      <TableCell className="text-right">
                        {!e.resolved && (
                          <Button size="sm" variant="ghost" onClick={() => resolve.mutate(e.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Resolve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Function</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(failures as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No failed jobs</TableCell></TableRow>
                  ) : (failures as any[]).map((f: any) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(f.created_at), "MMM d, HH:mm")}</TableCell>
                      <TableCell className="font-mono text-xs">{f.function_name}</TableCell>
                      <TableCell className="text-sm">{f.clinics?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{f.attempts}</TableCell>
                      <TableCell><Badge variant="outline">{f.status}</Badge></TableCell>
                      <TableCell className="text-xs max-w-md truncate" title={f.error_message}>{f.error_message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
