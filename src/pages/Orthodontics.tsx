import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Activity, Users, TrendingUp, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import OrthoCaseForm from "@/components/ortho/OrthoCaseForm";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/10 text-success",
  completed: "bg-primary/10 text-primary",
  on_hold: "bg-warning/10 text-warning",
  cancelled: "bg-destructive/10 text-destructive",
};

const CASE_TYPE_LABELS: Record<string, string> = {
  fixed_metal: "Metal Braces",
  fixed_ceramic: "Ceramic Braces",
  fixed_self_ligating: "Self-Ligating Braces",
  clear_aligners: "Clear Aligners",
  removable_appliance: "Removable Appliance",
  functional_appliance: "Functional Appliance",
  retainers: "Retainers",
};

export default function Orthodontics() {
  const { clinicId } = useAuth();
  const navigate = useNavigate();
  const [showNewCase, setShowNewCase] = useState(false);

  const { data: cases = [], refetch } = useQuery({
    queryKey: ["ortho-cases", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ortho_cases")
        .select("*, patients(full_name, op_number), profiles(full_name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const activeCases = cases.filter((c: any) => c.status === "active");
  const completedCases = cases.filter((c: any) => c.status === "completed");
  const alignerCases = cases.filter((c: any) => c.case_type === "clear_aligners");
  const bracesCases = cases.filter((c: any) => c.case_type?.startsWith("fixed_"));

  const totalPipeline = activeCases.reduce((s: number, c: any) => s + Number(c.total_estimated_cost || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Orthodontics</h1>
            <p className="text-sm text-muted-foreground">Manage ortho cases, track progress, and monitor treatment outcomes</p>
          </div>
          <Button onClick={() => setShowNewCase(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Ortho Case
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Active Cases</p>
                  <p className="text-2xl font-bold">{activeCases.length}</p>
                </div>
                <Activity className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Aligners / Braces</p>
                  <p className="text-2xl font-bold">{alignerCases.length} / {bracesCases.length}</p>
                </div>
                <Users className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completedCases.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pipeline Value</p>
                  <p className="text-2xl font-bold">Rs {totalPipeline.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Cases ({cases.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({activeCases.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedCases.length})</TabsTrigger>
          </TabsList>

          {["all", "active", "completed"].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <Card className="shadow-card border-0">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Case Type</TableHead>
                        <TableHead>Classification</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(tab === "all" ? cases : tab === "active" ? activeCases : completedCases).map((c: any) => (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/ortho/${c.id}`)}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{c.patients?.full_name}</p>
                              <p className="text-xs text-muted-foreground">{c.patients?.op_number}</p>
                            </div>
                          </TableCell>
                          <TableCell>{CASE_TYPE_LABELS[c.case_type] || c.case_type}</TableCell>
                          <TableCell className="text-sm">{c.malocclusion_class || "—"}</TableCell>
                          <TableCell className="text-sm">{c.case_start_date || "—"}</TableCell>
                          <TableCell className="text-sm">{c.estimated_duration_months ? `${c.estimated_duration_months} mo` : "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={STATUS_COLORS[c.status] || ""}>{c.status}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">Rs {Number(c.total_estimated_cost || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); navigate(`/ortho/${c.id}`); }}>View</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!(tab === "all" ? cases : tab === "active" ? activeCases : completedCases).length && (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No ortho cases found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {showNewCase && clinicId && (
          <OrthoCaseForm
            clinicId={clinicId}
            onClose={() => setShowNewCase(false)}
            onSuccess={() => { setShowNewCase(false); refetch(); }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
