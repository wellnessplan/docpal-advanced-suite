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
  Phone, Mail, User2, HeartPulse, FileText, Clock, IndianRupee
} from "lucide-react";
import MedicalHistoryTab from "@/components/patients/MedicalHistoryTab";
import DocumentsTab from "@/components/patients/DocumentsTab";
import TreatmentTimeline from "@/components/patients/TreatmentTimeline";
import ConsentForms from "@/components/patients/ConsentForms";
import LabWorkTracker from "@/components/patients/LabWorkTracker";
import RecallReminders from "@/components/patients/RecallReminders";

const STATUS_COLORS: Record<string, string> = {
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
        .eq("patient_id", id!).order("appointment_date", { ascending: false }).limit(10);
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
      toast.success("Status updated!");
    },
  });

  if (isLoading) {
    return <DashboardLayout><div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading...</div></DashboardLayout>;
  }

  if (!patient) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-muted-foreground">Patient not found</p>
          <Button variant="outline" onClick={() => navigate("/patients")}>Back</Button>
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
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {/* Profile Header */}
        <Card className="shadow-card border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full gradient-primary text-lg font-bold text-primary-foreground">
                  {patient.full_name[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-heading text-xl font-bold">{patient.full_name}</h2>
                    {(patient as any).op_number && <Badge variant="outline" className="font-mono text-xs">{(patient as any).op_number}</Badge>}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                    {age && <span className="flex items-center gap-1"><User2 className="h-3 w-3" /> {age}y</span>}
                    {patient.gender && <span className="capitalize">{patient.gender}</span>}
                    {patient.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {patient.phone}</span>}
                    {patient.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {patient.email}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => navigate(`/dental-chart/${patient.id}`)}>
                  <Smile className="h-4 w-4 mr-1" /> Dental Chart
                </Button>
                <Button size="sm" onClick={() => navigate(`/appointments`)}>
                  <CalendarDays className="h-4 w-4 mr-1" /> Book Visit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Simplified Tabs — 5 clear tabs */}
        <Tabs defaultValue="history">
          <TabsList>
            <TabsTrigger value="history" className="gap-1"><Clock className="h-3 w-3" /> History</TabsTrigger>
            <TabsTrigger value="medical" className="gap-1"><HeartPulse className="h-3 w-3" /> Medical</TabsTrigger>
            <TabsTrigger value="clinical" className="gap-1"><Smile className="h-3 w-3" /> Clinical</TabsTrigger>
            <TabsTrigger value="billing" className="gap-1"><IndianRupee className="h-3 w-3" /> Billing</TabsTrigger>
            <TabsTrigger value="files" className="gap-1"><FileText className="h-3 w-3" /> Files</TabsTrigger>
          </TabsList>

          {/* History = Timeline of everything */}
          <TabsContent value="history" className="mt-4">
            <TreatmentTimeline patientId={patient.id} />
          </TabsContent>

          {/* Medical = Medical history + Consent + Recalls */}
          <TabsContent value="medical" className="mt-4 space-y-6">
            {clinicId && <MedicalHistoryTab patientId={patient.id} clinicId={clinicId} />}
            <div className="grid gap-6 lg:grid-cols-2">
              {clinicId && <ConsentForms patientId={patient.id} clinicId={clinicId} />}
              {clinicId && <RecallReminders patientId={patient.id} clinicId={clinicId} />}
            </div>
          </TabsContent>

          {/* Clinical = Treatments + Lab Work */}
          <TabsContent value="clinical" className="mt-4 space-y-6">
            <Card className="shadow-card border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading">Treatments</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Treatment</TableHead>
                      <TableHead>Tooth</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!treatments.length ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No treatments yet</TableCell></TableRow>
                    ) : treatments.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.treatment_name}</TableCell>
                        <TableCell>#{t.tooth_records?.tooth_number}</TableCell>
                        <TableCell>
                          <Select value={t.status} onValueChange={v => updateTreatmentStatus.mutate({ treatmentId: t.id, status: v })}>
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <Badge className={`${STATUS_COLORS[t.status] || ""} text-xs`} variant="secondary">
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
                        <TableCell className="text-muted-foreground text-xs">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {clinicId && <LabWorkTracker patientId={patient.id} clinicId={clinicId} />}
          </TabsContent>

          {/* Billing */}
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

          {/* Files = Documents */}
          <TabsContent value="files" className="mt-4">
            {clinicId && <DocumentsTab patientId={patient.id} clinicId={clinicId} />}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
