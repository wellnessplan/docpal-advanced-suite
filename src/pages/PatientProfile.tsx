import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Smile, CalendarDays, ChevronLeft,
  Phone, Mail, FileText, User2, HeartPulse, History, Search,
  FileCheck, Package, Bell, Clock
} from "lucide-react";
import MedicalHistoryTab from "@/components/patients/MedicalHistoryTab";
import VisitHistoryTab from "@/components/patients/VisitHistoryTab";
import DocumentsTab from "@/components/patients/DocumentsTab";
import AuditTrailTab from "@/components/patients/AuditTrailTab";
import TreatmentTimeline from "@/components/patients/TreatmentTimeline";
import ConsentForms from "@/components/patients/ConsentForms";
import LabWorkTracker from "@/components/patients/LabWorkTracker";
import RecallReminders from "@/components/patients/RecallReminders";

const TREATMENT_STATUS_COLORS: Record<string, string> = {
  planned: "bg-primary/10 text-primary border-primary/30",
  in_progress: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["patient-appointments", id],
    queryFn: async () => {
      const { data } = await supabase.from("appointments").select("*")
        .eq("patient_id", id!).order("scheduled_at", { ascending: false }).limit(10);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ["patient-treatments", id],
    queryFn: async () => {
      const { data } = await supabase.from("tooth_treatments")
        .select("*, tooth_records!inner(tooth_number)")
        .eq("tooth_records.patient_id", id!)
        .order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["patient-invoices", id],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("*")
        .eq("patient_id", id!).order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
    enabled: !!id,
  });

  const updateTreatmentStatus = useMutation({
    mutationFn: async ({ treatmentId, status }: { treatmentId: string; status: string }) => {
      const update: any = { status: status as any };
      if (status === "completed") update.performed_at = new Date().toISOString();
      const { error } = await supabase.from("tooth_treatments").update(update).eq("id", treatmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-treatments"] });
      toast.success("Treatment status updated!");
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading patient...</div>
      </DashboardLayout>
    );
  }

  if (!patient) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-muted-foreground">Patient not found</p>
          <Button variant="outline" onClick={() => navigate("/patients")}>Back to Patients</Button>
        </div>
      </DashboardLayout>
    );
  }

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate("/patients")} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to Patients
        </Button>

        {/* Profile Header */}
        <Card className="shadow-card border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full gradient-primary text-xl font-bold text-primary-foreground">
                  {patient.full_name[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-heading text-xl font-bold text-foreground">{patient.full_name}</h2>
                    {(patient as any).op_number && <Badge variant="outline" className="font-mono text-xs">{(patient as any).op_number}</Badge>}
                    <Badge className="bg-success/10 text-success border-0">Active</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                    {age && <span className="flex items-center gap-1"><User2 className="h-3 w-3" /> {age} years old</span>}
                    {patient.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {patient.phone}</span>}
                    {patient.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {patient.email}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => navigate(`/dental-chart/${patient.id}`)}>
                  <Smile className="h-4 w-4 mr-1" /> Dental Chart
                </Button>
                <Button size="sm">
                  <CalendarDays className="h-4 w-4 mr-1" /> Schedule
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="timeline">
          <TabsList className="flex-wrap">
            <TabsTrigger value="timeline" className="gap-1"><Clock className="h-3 w-3" />Timeline</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="medical-history" className="gap-1"><HeartPulse className="h-3 w-3" />Medical</TabsTrigger>
            <TabsTrigger value="treatments">Treatments</TabsTrigger>
            <TabsTrigger value="consent" className="gap-1"><FileCheck className="h-3 w-3" />Consent</TabsTrigger>
            <TabsTrigger value="lab-work" className="gap-1"><Package className="h-3 w-3" />Lab Work</TabsTrigger>
            <TabsTrigger value="reminders" className="gap-1"><Bell className="h-3 w-3" />Recalls</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1"><FileText className="h-3 w-3" />Documents</TabsTrigger>
            <TabsTrigger value="audit-trail" className="gap-1"><Search className="h-3 w-3" />Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-4">
            <TreatmentTimeline patientId={patient.id} />
          </TabsContent>

          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="shadow-card border-0">
                <CardHeader className="pb-3"><CardTitle className="text-base font-heading">Personal Information</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Date of Birth</span><span className="font-medium">{patient.date_of_birth || "—"}</span></div>
                  {age && <div className="flex justify-between"><span className="text-muted-foreground">Age</span><span className="font-medium">{age} Years</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-medium">{patient.phone || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{patient.email || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Address</span><span className="font-medium text-right max-w-[200px]">{(patient as any).address || "—"}</span></div>
                </CardContent>
              </Card>
              <Card className="shadow-card border-0">
                <CardHeader className="pb-3"><CardTitle className="text-base font-heading">Quick Stats</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Appointments</span><span className="font-medium">{appointments.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Treatments Done</span><span className="font-medium">{treatments.filter((t: any) => t.status === "completed").length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pending Treatments</span><span className="font-medium">{treatments.filter((t: any) => t.status !== "completed" && t.status !== "cancelled").length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Billed</span><span className="font-medium">₹{invoices.reduce((s: number, i: any) => s + Number(i.amount), 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pending Balance</span><span className="font-medium text-destructive">₹{invoices.filter((i: any) => i.status !== "paid" && i.status !== "cancelled").reduce((s: number, i: any) => s + Number(i.amount), 0).toLocaleString()}</span></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="medical-history" className="mt-4">
            {clinicId && <MedicalHistoryTab patientId={patient.id} clinicId={clinicId} />}
          </TabsContent>

          <TabsContent value="treatments" className="mt-4">
            <Card className="shadow-card border-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Treatment</TableHead>
                      <TableHead>Tooth</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!treatments.length ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No treatments recorded</TableCell></TableRow>
                    ) : treatments.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.treatment_name}</TableCell>
                        <TableCell>#{t.tooth_records?.tooth_number}</TableCell>
                        <TableCell>
                          <Select value={t.status} onValueChange={v => updateTreatmentStatus.mutate({ treatmentId: t.id, status: v })}>
                            <SelectTrigger className="w-32 h-7 text-xs">
                              <Badge className={`${TREATMENT_STATUS_COLORS[t.status] || ""} text-xs`} variant="secondary">
                                {t.status?.replace("_", " ")}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {["planned", "in_progress", "completed", "cancelled"].map(s =>
                                <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{t.cost ? `₹${Number(t.cost).toLocaleString()}` : "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {t.performed_at ? new Date(t.performed_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consent" className="mt-4">
            {clinicId && <ConsentForms patientId={patient.id} clinicId={clinicId} />}
          </TabsContent>

          <TabsContent value="lab-work" className="mt-4">
            {clinicId && <LabWorkTracker patientId={patient.id} clinicId={clinicId} />}
          </TabsContent>

          <TabsContent value="reminders" className="mt-4">
            {clinicId && <RecallReminders patientId={patient.id} clinicId={clinicId} />}
          </TabsContent>

          <TabsContent value="billing" className="mt-4">
            <Card className="shadow-card border-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!invoices.length ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No invoices</TableCell></TableRow>
                    ) : invoices.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell>{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">₹{Number(inv.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${inv.status === "paid" ? "bg-success/10 text-success" : inv.status === "overdue" ? "bg-destructive/10 text-destructive" : ""}`}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            {clinicId && <DocumentsTab patientId={patient.id} clinicId={clinicId} />}
          </TabsContent>

          <TabsContent value="audit-trail" className="mt-4">
            <AuditTrailTab patientId={patient.id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
