import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import OrthoTreatmentPlan from "@/components/ortho/OrthoTreatmentPlan";
import OrthoVisitLog from "@/components/ortho/OrthoVisitLog";
import OrthoAlignerTracker from "@/components/ortho/OrthoAlignerTracker";
import OrthoCephalometrics from "@/components/ortho/OrthoCephalometrics";
import OrthoPhotoGallery from "@/components/ortho/OrthoPhotoGallery";
import OrthoDebondModule from "@/components/ortho/OrthoDebondModule";
import OrthoFinancials from "@/components/ortho/OrthoFinancials";
import OrthoConsentForms from "@/components/ortho/OrthoConsentForms";

const CASE_TYPE_LABELS: Record<string, string> = {
  fixed_metal: "Metal Braces", fixed_ceramic: "Ceramic Braces",
  fixed_self_ligating: "Self-Ligating", clear_aligners: "Clear Aligners",
  removable_appliance: "Removable", functional_appliance: "Functional",
  retainers: "Retainers",
};

export default function OrthoCase() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();

  const { data: orthoCase, isLoading } = useQuery({
    queryKey: ["ortho-case", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ortho_cases")
        .select("*, patients(full_name, op_number, phone, email), profiles(full_name)")
        .eq("id", caseId!)
        .single();
      return data;
    },
    enabled: !!caseId,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const update: any = { status };
      if (status === "completed") update.actual_end_date = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("ortho_cases").update(update).eq("id", caseId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-case", caseId] });
      toast.success("Case status updated");
    },
  });

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading case...</div></DashboardLayout>;
  if (!orthoCase) return <DashboardLayout><div className="text-center py-12"><p className="text-muted-foreground">Case not found</p><Button variant="outline" onClick={() => navigate("/ortho")} className="mt-4">Back</Button></div></DashboardLayout>;

  const checklist = (orthoCase.pre_treatment_checklist || {}) as Record<string, boolean>;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ortho")} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to Ortho Cases
        </Button>

        {/* Header */}
        <Card className="shadow-card border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="font-heading text-xl font-bold">{(orthoCase as any).patients?.full_name}</h2>
                  <Badge variant="outline" className="font-mono text-xs">{(orthoCase as any).patients?.op_number}</Badge>
                  <Badge className={orthoCase.status === "active" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}>
                    {orthoCase.status}
                  </Badge>
                </div>
                <div className="flex gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                  <span>{CASE_TYPE_LABELS[orthoCase.case_type] || orthoCase.case_type}</span>
                  {orthoCase.malocclusion_class && <span>• {orthoCase.malocclusion_class}</span>}
                  {orthoCase.skeletal_pattern && <span>• {orthoCase.skeletal_pattern}</span>}
                  {orthoCase.estimated_duration_months && <span>• {orthoCase.estimated_duration_months} months est.</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {orthoCase.status === "active" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("on_hold")}>Hold</Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("completed")}>Complete</Button>
                  </>
                )}
                {orthoCase.status === "on_hold" && (
                  <Button size="sm" onClick={() => updateStatus.mutate("active")}>Resume</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => navigate(`/patients/${orthoCase.patient_id}`)}>Patient Profile</Button>
              </div>
            </div>

            {/* Pre-treatment checklist */}
            {Object.keys(checklist).length > 0 && (
              <div className="mt-4 flex gap-2 flex-wrap">
                {Object.entries(checklist).map(([item, done]) => (
                  <Badge key={item} variant="secondary" className={done ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                    {done ? "✓" : "○"} {item}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Case Tabs */}
        <Tabs defaultValue="plan">
          <TabsList className="flex-wrap">
            <TabsTrigger value="plan">Treatment Plan</TabsTrigger>
            <TabsTrigger value="visits">Visit Log</TabsTrigger>
            {orthoCase.case_type === "clear_aligners" && <TabsTrigger value="aligners">Aligners</TabsTrigger>}
            <TabsTrigger value="ceph">Cephalometrics</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="debond">Debond</TabsTrigger>
            <TabsTrigger value="finances">Finances</TabsTrigger>
            <TabsTrigger value="consent">Consent Forms</TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="mt-4">
            <OrthoTreatmentPlan caseId={caseId!} />
          </TabsContent>
          <TabsContent value="visits" className="mt-4">
            <OrthoVisitLog caseId={caseId!} />
          </TabsContent>
          {orthoCase.case_type === "clear_aligners" && (
            <TabsContent value="aligners" className="mt-4">
              <OrthoAlignerTracker caseId={caseId!} />
            </TabsContent>
          )}
          <TabsContent value="ceph" className="mt-4">
            <OrthoCephalometrics caseId={caseId!} clinicId={clinicId!} />
          </TabsContent>
          <TabsContent value="photos" className="mt-4">
            <OrthoPhotoGallery caseId={caseId!} clinicId={clinicId!} />
          </TabsContent>
          <TabsContent value="debond" className="mt-4">
            <OrthoDebondModule caseId={caseId!} />
          </TabsContent>
          <TabsContent value="finances" className="mt-4">
            <OrthoFinancials caseId={caseId!} />
          </TabsContent>
          <TabsContent value="consent" className="mt-4">
            <OrthoConsentForms caseId={caseId!} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
