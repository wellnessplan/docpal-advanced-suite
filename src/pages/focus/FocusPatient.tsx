import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FocusLayout from "@/components/focus/FocusLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone, Mail, User2, HeartPulse, CalendarClock,
  Smile, Receipt, FileText, Plus, ArrowLeft, IndianRupee,
  Stethoscope, MessageCircle, AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const txStatusStyle: Record<string, string> = {
  planned: "bg-primary/10 text-primary border-primary/30",
  in_progress: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

const invStatusStyle: Record<string, string> = {
  unpaid: "bg-destructive/10 text-destructive border-destructive/30",
  partially_paid: "bg-warning/10 text-warning border-warning/30",
  paid: "bg-success/10 text-success border-success/30",
};

export default function FocusPatient() {
  const { id } = useParams<{ id: string }>();
  const { clinicId } = useAuth();
  const navigate = useNavigate();

  const { data: patient } = useQuery({
    queryKey: ["focus-patient", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ["focus-patient-tx", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tooth_treatments")
        .select("*")
        .eq("patient_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["focus-patient-inv", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("patient_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["focus-patient-appts", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_id", id!)
        .order("appointment_date", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!id,
  });

  const calcAge = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
  };

  const totalBalance = invoices.reduce(
    (s: number, i: any) => s + (Number(i.total) - Number(i.paid_amount || 0)),
    0
  );
  const pendingTreatments = treatments.filter((t: any) => t.status !== "completed" && t.status !== "cancelled").length;

  if (!patient) {
    return (
      <FocusLayout activeStep={2}>
        <div className="text-center py-20 text-muted-foreground">Loading patient...</div>
      </FocusLayout>
    );
  }

  return (
    <FocusLayout activeStep={2}>
      <div className="max-w-5xl mx-auto space-y-4 animate-fade-in">
        {/* Back to Today */}
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate("/focus")}>
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs">Back to Today</span>
        </Button>

        {/* Patient header card */}
        <Card className="border-l-4 border-l-primary shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-xl font-bold shadow-lg shrink-0">
                {patient.full_name?.[0] || "?"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">
                    {patient.full_name}
                  </h1>
                  {patient.gender && (
                    <Badge variant="outline" className="capitalize text-xs">
                      {patient.gender}
                    </Badge>
                  )}
                  {patient.date_of_birth && (
                    <Badge variant="outline" className="text-xs">
                      {calcAge(patient.date_of_birth)} yrs
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                  {patient.phone && (
                    <a href={`tel:${patient.phone}`} className="flex items-center gap-1 hover:text-primary">
                      <Phone className="h-3.5 w-3.5" /> {patient.phone}
                    </a>
                  )}
                  {patient.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> {patient.email}
                    </span>
                  )}
                </div>

                {patient.medical_conditions && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs bg-warning/10 text-warning border border-warning/20 rounded-lg px-2 py-1.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span><strong>Medical:</strong> {patient.medical_conditions}</span>
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                {patient.phone && (
                  <Button size="sm" variant="outline" className="gap-1.5 w-full" asChild>
                    <a
                      href={`https://wa.me/${patient.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick stat strip */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Treatments</p>
              <p className="text-xl font-bold font-heading">{treatments.length}</p>
              <p className="text-[10px] text-muted-foreground">{pendingTreatments} pending</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-success">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Invoices</p>
              <p className="text-xl font-bold font-heading">{invoices.length}</p>
              <p className="text-[10px] text-muted-foreground">total</p>
            </CardContent>
          </Card>
          <Card className={cn("border-l-4", totalBalance > 0 ? "border-l-destructive" : "border-l-success")}>
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Balance</p>
              <p className={cn("text-xl font-bold font-heading", totalBalance > 0 ? "text-destructive" : "text-success")}>
                ₹{totalBalance.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-muted-foreground">{totalBalance > 0 ? "due" : "settled"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Primary action buttons - the THREE doctor moves */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            size="lg"
            className="h-auto py-4 flex-col gap-1 shadow-md"
            onClick={() => navigate(`/dental-chart/${patient.id}`)}
          >
            <Smile className="h-6 w-6" />
            <span className="font-bold">Open Chart</span>
            <span className="text-[10px] opacity-90 font-normal">Examine · Treat · Rx</span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-auto py-4 flex-col gap-1 shadow-sm"
            onClick={() => navigate(`/billing?patient=${patient.id}`)}
          >
            <Receipt className="h-6 w-6" />
            <span className="font-bold">Bill / Pay</span>
            <span className="text-[10px] opacity-70 font-normal">Invoice & payments</span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-auto py-4 flex-col gap-1 shadow-sm"
            onClick={() => navigate(`/patients/${patient.id}`)}
          >
            <FileText className="h-6 w-6" />
            <span className="font-bold">Full Record</span>
            <span className="text-[10px] opacity-70 font-normal">History · Files · Lab</span>
          </Button>
        </div>

        {/* Inline tabs: Treatments, Invoices, Visits */}
        <Tabs defaultValue="treatments">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="treatments" className="gap-1.5">
              <Stethoscope className="h-3.5 w-3.5" /> Treatments
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{treatments.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1.5">
              <IndianRupee className="h-3.5 w-3.5" /> Invoices
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{invoices.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="visits" className="gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> Visits
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{appointments.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="treatments" className="mt-3 space-y-2">
            {treatments.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No treatments yet · <Link to={`/dental-chart/${patient.id}`} className="text-primary underline">Open chart</Link>
                </CardContent>
              </Card>
            ) : (
              treatments.slice(0, 10).map((t: any) => (
                <Card key={t.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                      {t.tooth_number || "—"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{t.treatment_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.created_at ? format(new Date(t.created_at), "dd MMM yyyy") : ""}
                        {t.cost ? ` · ₹${Number(t.cost).toLocaleString("en-IN")}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] capitalize", txStatusStyle[t.status] || "")}>
                      {t.status?.replace(/_/g, " ")}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="invoices" className="mt-3 space-y-2">
            {invoices.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No invoices yet
                </CardContent>
              </Card>
            ) : (
              invoices.slice(0, 10).map((inv: any) => (
                <Card
                  key={inv.id}
                  className="hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => navigate(`/billing?invoice=${inv.id}`)}
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                      <Receipt className="h-4 w-4 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {inv.invoice_number || inv.id.slice(0, 8)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {inv.invoice_date ? format(new Date(inv.invoice_date), "dd MMM yyyy") : "—"} · ₹
                        {Number(inv.total).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] capitalize", invStatusStyle[inv.status] || "")}>
                      {inv.status?.replace(/_/g, " ")}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="visits" className="mt-3 space-y-2">
            {appointments.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No visits yet
                </CardContent>
              </Card>
            ) : (
              appointments.map((apt: any) => (
                <Card key={apt.id}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <CalendarClock className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">
                        {format(new Date(apt.appointment_date + "T00:00:00"), "dd MMM yyyy")} ·{" "}
                        {apt.appointment_time?.slice(0, 5)}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {apt.type || "Checkup"} {apt.notes ? `· ${apt.notes}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {apt.status?.replace(/_/g, " ")}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </FocusLayout>
  );
}
