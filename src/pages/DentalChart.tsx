import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import DentalChartGrid from "@/components/dental-chart/DentalChartGrid";
import UnifiedToothEntry from "@/components/dental-chart/UnifiedToothEntry";
import ClinicalExamPanel from "@/components/dental-chart/ClinicalExamPanel";
import MedicationPanel, { type Medication } from "@/components/dental-chart/MedicationPanel";
import PrescriptionSummary from "@/components/dental-chart/PrescriptionSummary";
import ChairSideQuickMode from "@/components/dental-chart/ChairSideQuickMode";
import XRayVault from "@/components/xray/XRayVault";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Mail, Phone, Calendar, Stethoscope, FileText, Zap, FileImage, CalendarPlus } from "lucide-react";
import { toast } from "sonner";

export default function DentalChartPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [chartType, setChartType] = useState<"adult" | "kids">("adult");
  const [activeTab, setActiveTab] = useState("chart");

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [gumCondition, setGumCondition] = useState("normal");
  const [alignmentCondition, setAlignmentCondition] = useState("normal");
  const [diagnosisNotes, setDiagnosisNotes] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [medications, setMedications] = useState<Medication[]>([]);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [prescriptionStatus, setPrescriptionStatus] = useState("draft");

  // Next appointment booking state
  const [showBookNext, setShowBookNext] = useState(false);
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("10:00");

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

  useEffect(() => {
    if (!patientId || !clinicId) return;
    const loadPrescription = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await (supabase.from("prescriptions") as any)
        .select("*").eq("patient_id", patientId).eq("clinic_id", clinicId)
        .gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59")
        .order("created_at", { ascending: false }).limit(1);

      if (existing && existing.length > 0) {
        const rx = existing[0] as any;
        setPrescriptionId(rx.id);
        setChiefComplaint(rx.chief_complaint || "");
        setGumCondition(rx.gum_condition || "normal");
        setAlignmentCondition(rx.alignment_condition || "normal");
        setDiagnosisNotes(rx.diagnosis_notes || "");
        setTreatmentPlan(rx.treatment_plan || "");
        setMedications(Array.isArray(rx.medications) ? (rx.medications as unknown as Medication[]) : []);
        setPrescriptionStatus(rx.status || "draft");
        setChartType((rx.chart_type as "adult" | "kids") || "adult");
      } else {
        const { data: newRx } = await (supabase.from("prescriptions") as any).insert({
          patient_id: patientId, clinic_id: clinicId, chart_type: chartType,
        }).select("id").single();
        if (newRx) setPrescriptionId(newRx.id);
      }
    };
    loadPrescription();
  }, [patientId, clinicId]);

  const savePrescription = useCallback(async () => {
    if (!prescriptionId) return;
    await (supabase.from("prescriptions") as any).update({
      chief_complaint: chiefComplaint, gum_condition: gumCondition,
      alignment_condition: alignmentCondition, diagnosis_notes: diagnosisNotes,
      treatment_plan: treatmentPlan, medications: medications as any, chart_type: chartType,
    }).eq("id", prescriptionId);
  }, [prescriptionId, chiefComplaint, gumCondition, alignmentCondition, diagnosisNotes, treatmentPlan, medications, chartType]);

  useEffect(() => {
    const timer = setTimeout(savePrescription, 1000);
    return () => clearTimeout(timer);
  }, [savePrescription]);

  const { data: prescriptionItems = [], refetch: refetchItems } = useQuery({
    queryKey: ["prescription-items-all", prescriptionId],
    queryFn: async () => {
      const { data } = await supabase.from("prescription_items").select("*")
        .eq("prescription_id", prescriptionId!).order("tooth_number");
      return data ?? [];
    },
    enabled: !!prescriptionId,
  });

  // Confirm prescription → auto-create draft invoice
  const confirmPrescription = useMutation({
    mutationFn: async () => {
      await savePrescription();
      await (supabase.from("prescriptions") as any).update({ status: "confirmed" }).eq("id", prescriptionId!);

      // Auto-create draft invoice from prescription items
      const totalCost = prescriptionItems.reduce((sum: number, item: any) => sum + (Number(item.cost) || 0), 0);
      if (totalCost > 0 && patientId && clinicId) {
        const { data: invoice } = await supabase.from("invoices").insert({
          patient_id: patientId,
          clinic_id: clinicId,
          amount: totalCost,
          total: totalCost,
          subtotal: totalCost,
          status: "draft",
          invoice_date: new Date().toISOString().split("T")[0],
          notes: `Auto-generated from prescription`,
        }).select("id").single();

        // Add line items
        if (invoice) {
          const lineItems = prescriptionItems
            .filter((item: any) => item.treatment && Number(item.cost) > 0)
            .map((item: any) => ({
              invoice_id: invoice.id,
              description: `${item.treatment}${item.tooth_number ? ` (Tooth #${item.tooth_number})` : ""}`,
              unit_price: Number(item.cost),
              quantity: 1,
              total: Number(item.cost),
            }));
          if (lineItems.length > 0) {
            await supabase.from("invoice_items").insert(lineItems);
          }
        }
      }
    },
    onSuccess: () => {
      setPrescriptionStatus("confirmed");
      setShowBookNext(true);
      toast.success("Prescription confirmed & draft bill created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Book next appointment
  const bookNextAppointment = useMutation({
    mutationFn: async () => {
      if (!nextDate || !nextTime) throw new Error("Select date and time");
      const { error } = await supabase.from("appointments").insert({
        patient_id: patientId!,
        clinic_id: clinicId!,
        appointment_date: nextDate,
        appointment_time: nextTime,
        status: "scheduled",
        type: "Follow-up",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Next appointment booked!");
      setShowBookNext(false);
      setNextDate("");
      setNextTime("10:00");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedRecord = toothRecords?.find((r: any) => r.tooth_number === selectedTooth);

  const handleClinicalChange = (field: string, value: string) => {
    if (field === "chief_complaint") setChiefComplaint(value);
    if (field === "gum_condition") setGumCondition(value);
    if (field === "alignment_condition") setAlignmentCondition(value);
    if (field === "diagnosis_notes") setDiagnosisNotes(value);
  };

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
              {patient?.email && <span className="flex items-center gap-1 hidden sm:flex"><Mail className="h-3 w-3" />{patient.email}</span>}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v === "summary") refetchItems(); }}>
          <TabsList className="w-full">
            <TabsTrigger value="chart" className="flex-1 gap-1"><Stethoscope className="h-3 w-3" />Examine</TabsTrigger>
            <TabsTrigger value="quick" className="flex-1 gap-1"><Zap className="h-3 w-3" />Quick</TabsTrigger>
            <TabsTrigger value="xrays" className="flex-1 gap-1"><FileImage className="h-3 w-3" />X-Rays</TabsTrigger>
            <TabsTrigger value="summary" className="flex-1 gap-1"><FileText className="h-3 w-3" />Rx</TabsTrigger>
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

            {/* Unified tooth entry with condition, treatment, cost, notes — below chart */}
            {selectedTooth && prescriptionId && (
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
            )}

            {!selectedTooth && (
              <Card className="shadow-card border-0">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  ← Tap a tooth on the chart to add condition, treatment & cost
                </CardContent>
              </Card>
            )}

            <MedicationPanel
              medications={medications}
              treatmentPlan={treatmentPlan}
              onMedicationsChange={setMedications}
              onTreatmentPlanChange={setTreatmentPlan}
            />
          </TabsContent>

          <TabsContent value="quick" className="mt-3">
            <ChairSideQuickMode
              patientId={patientId}
              clinicId={clinicId}
              prescriptionId={prescriptionId}
              onUpdate={() => {
                refetchRecords();
                queryClient.invalidateQueries({ queryKey: ["prescription-items-all"] });
              }}
            />
          </TabsContent>

          <TabsContent value="xrays" className="mt-3">
            <XRayVault patientId={patientId} clinicId={clinicId} />
          </TabsContent>

          <TabsContent value="summary" className="mt-3 space-y-3">
            <PrescriptionSummary
              patient={patient}
              clinic={clinic}
              chiefComplaint={chiefComplaint}
              gumCondition={gumCondition}
              alignmentCondition={alignmentCondition}
              diagnosisNotes={diagnosisNotes}
              treatmentPlan={treatmentPlan}
              medications={medications}
              items={prescriptionItems}
              status={prescriptionStatus}
              onConfirm={() => confirmPrescription.mutate()}
              isConfirming={confirmPrescription.isPending}
            />

            {/* Book Next Appointment — inline after confirm */}
            {(showBookNext || prescriptionStatus === "confirmed") && (
              <Card className="shadow-card border-0 border-l-4 border-l-primary">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarPlus className="h-4 w-4 text-primary" />
                    <h3 className="font-heading text-sm font-semibold">Book Next Appointment</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        value={nextDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={e => setNextDate(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Time</Label>
                      <Input
                        type="time"
                        value={nextTime}
                        onChange={e => setNextTime(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => bookNextAppointment.mutate()}
                    disabled={!nextDate || bookNextAppointment.isPending}
                  >
                    <CalendarPlus className="h-3 w-3" />
                    {bookNextAppointment.isPending ? "Booking..." : "Book Follow-up"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
