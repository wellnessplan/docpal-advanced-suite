import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import DentalChartGrid from "@/components/dental-chart/DentalChartGrid";
import UnifiedToothEntry from "@/components/dental-chart/UnifiedToothEntry";
import ClinicalExamPanel from "@/components/dental-chart/ClinicalExamPanel";
import TreatmentPlanBuilder from "@/components/dental-chart/TreatmentPlanBuilder";
import XRayVault from "@/components/xray/XRayVault";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Phone, Calendar, Stethoscope, ClipboardList, FileImage } from "lucide-react";

export default function DentalChartPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [chartType, setChartType] = useState<"adult" | "kids">("adult");
  const [activeTab, setActiveTab] = useState("chart");

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [gumCondition, setGumCondition] = useState("normal");
  const [alignmentCondition, setAlignmentCondition] = useState("normal");
  const [diagnosisNotes, setDiagnosisNotes] = useState("");

  // Prescription ID for tooth entry linkage
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("*").eq("id", patientId!).single();
      return data;
    },
    enabled: !!patientId,
  });

  const { data: clinic } = useQuery({
    queryKey: ["clinic", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("*").eq("id", clinicId!).single();
      return data;
    },
    enabled: !!clinicId,
  });

  const { data: toothRecords, refetch: refetchRecords } = useQuery({
    queryKey: ["tooth-records", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("tooth_records").select("*").eq("patient_id", patientId!);
      return data ?? [];
    },
    enabled: !!patientId,
  });

  // Auto-create prescription for tooth entry linkage
  useEffect(() => {
    if (!patientId || !clinicId) return;
    const loadPrescription = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await (supabase.from("prescriptions") as any)
        .select("id").eq("patient_id", patientId).eq("clinic_id", clinicId)
        .gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59")
        .order("created_at", { ascending: false }).limit(1);

      if (existing && existing.length > 0) {
        setPrescriptionId(existing[0].id);
      } else {
        const { data: newRx } = await (supabase.from("prescriptions") as any).insert({
          patient_id: patientId, clinic_id: clinicId, chart_type: chartType,
        }).select("id").single();
        if (newRx) setPrescriptionId(newRx.id);
      }
    };
    loadPrescription();
  }, [patientId, clinicId]);

  const handleClinicalChange = (field: string, value: string) => {
    if (field === "chief_complaint") setChiefComplaint(value);
    if (field === "gum_condition") setGumCondition(value);
    if (field === "alignment_condition") setAlignmentCondition(value);
    if (field === "diagnosis_notes") setDiagnosisNotes(value);
  };

  const selectedRecord = toothRecords?.find((r: any) => r.tooth_number === selectedTooth);

  if (!patientId || !clinicId) return null;

  return (
    <DashboardLayout>
      <div className="space-y-3 animate-fade-in">
        {/* Patient header */}
        <div className="flex items-center gap-3 bg-card rounded-xl p-3 shadow-card border-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/patients")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-base font-bold truncate">{patient?.full_name || "Loading..."}</h1>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {patient?.date_of_birth && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{patient.date_of_birth}</span>}
              {patient?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone}</span>}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="chart" className="flex-1 gap-1"><Stethoscope className="h-3 w-3" />Examine</TabsTrigger>
            <TabsTrigger value="plan" className="flex-1 gap-1"><ClipboardList className="h-3 w-3" />Treatment Plan</TabsTrigger>
            <TabsTrigger value="xrays" className="flex-1 gap-1"><FileImage className="h-3 w-3" />X-Rays</TabsTrigger>
          </TabsList>

          {/* EXAMINE TAB */}
          <TabsContent value="chart" className="mt-3 space-y-3">
            <ClinicalExamPanel
              chiefComplaint={chiefComplaint}
              gumCondition={gumCondition}
              alignmentCondition={alignmentCondition}
              diagnosisNotes={diagnosisNotes}
              onChange={handleClinicalChange}
            />

            <Card className="shadow-card border-0">
              <CardContent className="p-4">
                <DentalChartGrid
                  toothRecords={toothRecords ?? []}
                  selectedTooth={selectedTooth}
                  onSelectTooth={setSelectedTooth}
                  chartType={chartType}
                  onChartTypeChange={setChartType}
                />
              </CardContent>
            </Card>

            {/* Tooth detail — bottom sheet on mobile, inline on desktop */}
            {selectedTooth && prescriptionId && isMobile ? (
              <Drawer open={!!selectedTooth} onOpenChange={(open) => { if (!open) setSelectedTooth(null); }}>
                <DrawerContent className="max-h-[85vh]">
                  <DrawerHeader><DrawerTitle>Tooth #{selectedTooth}</DrawerTitle></DrawerHeader>
                  <div className="px-4 pb-6 overflow-y-auto max-h-[70vh]">
                    <UnifiedToothEntry
                      prescriptionId={prescriptionId}
                      clinicId={clinicId}
                      toothNumber={selectedTooth}
                      currentStatus={selectedRecord?.status || "healthy"}
                      toothRecordId={selectedRecord?.id}
                      patientId={patientId}
                      onUpdate={() => {
                        refetchRecords();
                        queryClient.invalidateQueries({ queryKey: ["prescription-items-all"] });
                      }}
                    />
                  </div>
                </DrawerContent>
              </Drawer>
            ) : selectedTooth && prescriptionId ? (
              <UnifiedToothEntry
                prescriptionId={prescriptionId}
                clinicId={clinicId}
                toothNumber={selectedTooth}
                currentStatus={selectedRecord?.status || "healthy"}
                toothRecordId={selectedRecord?.id}
                patientId={patientId}
                onUpdate={() => {
                  refetchRecords();
                  queryClient.invalidateQueries({ queryKey: ["prescription-items-all"] });
                }}
              />
            ) : null}

            {!selectedTooth && (
              <Card className="shadow-card border-0">
                <CardContent className="py-6 md:py-8 text-center text-muted-foreground text-xs md:text-sm">
                  ← Tap a tooth on the chart to add condition, treatment & cost
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TREATMENT PLAN TAB */}
          <TabsContent value="plan" className="mt-3">
            <TreatmentPlanBuilder
              patientId={patientId}
              clinicId={clinicId}
              patient={patient}
              clinic={clinic}
            />
          </TabsContent>

          {/* X-RAYS TAB */}
          <TabsContent value="xrays" className="mt-3">
            <XRayVault patientId={patientId} clinicId={clinicId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
