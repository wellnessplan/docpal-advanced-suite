import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import DentalChartGrid from "@/components/dental-chart/DentalChartGrid";
import UnifiedToothEntry from "@/components/dental-chart/UnifiedToothEntry";
import ClinicalExamPanel from "@/components/dental-chart/ClinicalExamPanel";
import MedicationPanel from "@/components/dental-chart/MedicationPanel";
import type { Medication } from "@/components/dental-chart/MedicationPanel";
import PrescriptionDownload from "@/components/dental-chart/PrescriptionDownload";
import TreatmentPlanBuilder from "@/components/dental-chart/TreatmentPlanBuilder";
import XRayVault from "@/components/xray/XRayVault";
import AllergyBanner from "@/components/dental-chart/AllergyBanner";
import VisitSummaryPDF from "@/components/dental-chart/VisitSummaryPDF";
import PerioChart from "@/components/dental-chart/PerioChart";
import EndoChart from "@/components/dental-chart/EndoChart";
import IntraOralVault from "@/components/patients/IntraOralVault";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, User, Phone, Calendar, Stethoscope, ClipboardList, FileImage, FileText, Activity, Zap, Camera } from "lucide-react";

export default function DentalChartPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { clinicId, profile } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [chartType, setChartType] = useState<"adult" | "kids">("adult");
  const [activeTab, setActiveTab] = useState("chart");

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [gumCondition, setGumCondition] = useState("normal");
  const [alignmentCondition, setAlignmentCondition] = useState("normal");
  const [diagnosisNotes, setDiagnosisNotes] = useState("");
  const [medications, setMedications] = useState<Medication[]>([]);
  const [treatmentPlanText, setTreatmentPlanText] = useState("");

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

  // Fetch all prescription items for this patient's current prescription to derive treatment list
  const { data: prescriptionItems = [] } = useQuery({
    queryKey: ["prescription-items-all", prescriptionId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("prescription_items")
        .select("*")
        .eq("prescription_id", prescriptionId!)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!prescriptionId,
  });

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

  // Derive treatments list (no cost) from prescription items for prescription PDF
  const treatmentsList = prescriptionItems
    .filter((i: any) => i.treatment || i.condition)
    .map((i: any) => ({
      tooth: i.tooth_number,
      condition: i.condition || "",
      treatment: i.treatment || "",
    }));

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

        {/* Allergy & Medical Alert Banner */}
        <AllergyBanner
          allergies={patient?.allergies}
          medicalConditions={patient?.notes}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="chart" className="flex-1 gap-1 text-xs"><Stethoscope className="h-3 w-3" />Examine</TabsTrigger>
            <TabsTrigger value="rx" className="flex-1 gap-1 text-xs"><FileText className="h-3 w-3" />Prescription</TabsTrigger>
            <TabsTrigger value="plan" className="flex-1 gap-1 text-xs"><ClipboardList className="h-3 w-3" />Treatment Plan</TabsTrigger>
            <TabsTrigger value="xrays" className="flex-1 gap-1 text-xs"><FileImage className="h-3 w-3" />Imaging+</TabsTrigger>
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

          {/* PRESCRIPTION TAB */}
          <TabsContent value="rx" className="mt-3 space-y-3">
            <MedicationPanel
              medications={medications}
              treatmentPlan={treatmentPlanText}
              onMedicationsChange={setMedications}
              onTreatmentPlanChange={setTreatmentPlanText}
            />

            {/* Prescription download / print / share */}
            <Card className="shadow-card border-0">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-heading text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Download / Print Prescription
                </h3>
                <p className="text-xs text-muted-foreground">
                  Generates a professional prescription with clinic header, doctor details, complaint, treatment summary (no cost), and medications.
                </p>
                <Separator />
                <PrescriptionDownload
                  patient={patient}
                  patientId={patientId || ""}
                  clinic={clinic}
                  doctorName={profile?.full_name || "Doctor"}
                  doctorRegistration=""
                  doctorDegree={profile?.role || ""}
                  doctorSpecialization={profile?.specialization || ""}
                  chiefComplaint={chiefComplaint}
                  diagnosisNotes={diagnosisNotes}
                  treatments={treatmentsList}
                  medications={medications}
                />
              </CardContent>
            </Card>

            {/* Visit Summary PDF */}
            <Card className="shadow-card border-0">
              <CardContent className="p-4 space-y-2">
                <h3 className="font-heading text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Visit Summary
                </h3>
                <p className="text-xs text-muted-foreground">
                  One-tap shareable summary of today's consultation — treatments, medications, and billing.
                </p>
                <VisitSummaryPDF
                  patient={patient}
                  patientId={patientId || ""}
                  clinic={clinic}
                  chiefComplaint={chiefComplaint}
                  diagnosisNotes={diagnosisNotes}
                  medications={medications}
                />
              </CardContent>
            </Card>

            {/* Summary preview of what will appear */}
            {(treatmentsList.length > 0 || medications.length > 0) && (
              <Card className="shadow-card border-0">
                <CardContent className="p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</h4>
                  {chiefComplaint && (
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground">Complaint:</span>
                      <p className="text-xs">{chiefComplaint}</p>
                    </div>
                  )}
                  {treatmentsList.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground">Treatments ({treatmentsList.length}):</span>
                      {treatmentsList.map((t, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          • Tooth #{t.tooth} — {t.condition}{t.condition && t.treatment ? " → " : ""}{t.treatment}
                        </p>
                      ))}
                    </div>
                  )}
                  {medications.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground">Medications ({medications.length}):</span>
                      {medications.map((m, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {i + 1}. {m.name} — {m.dosage} · {m.frequency} · {m.duration}
                        </p>
                      ))}
                    </div>
                  )}
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
              examFindings={treatmentsList}
            />
          </TabsContent>

          {/* IMAGING & SPECIALTY TAB */}
          <TabsContent value="xrays" className="mt-3 space-y-3">
            <Tabs defaultValue="xray">
              <TabsList className="w-full">
                <TabsTrigger value="xray" className="flex-1 gap-1 text-xs"><FileImage className="h-3 w-3" />X-Rays</TabsTrigger>
                <TabsTrigger value="intraoral" className="flex-1 gap-1 text-xs"><Camera className="h-3 w-3" />Intra-Oral</TabsTrigger>
                <TabsTrigger value="perio" className="flex-1 gap-1 text-xs"><Activity className="h-3 w-3" />Perio</TabsTrigger>
                <TabsTrigger value="endo" className="flex-1 gap-1 text-xs"><Zap className="h-3 w-3" />Endo</TabsTrigger>
              </TabsList>
              <TabsContent value="xray" className="mt-3"><XRayVault patientId={patientId} clinicId={clinicId} /></TabsContent>
              <TabsContent value="intraoral" className="mt-3"><IntraOralVault patientId={patientId} clinicId={clinicId} /></TabsContent>
              <TabsContent value="perio" className="mt-3"><PerioChart patientId={patientId} clinicId={clinicId} /></TabsContent>
              <TabsContent value="endo" className="mt-3"><EndoChart patientId={patientId} clinicId={clinicId} /></TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
