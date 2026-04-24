import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, X, Sparkles, Building2, Users, CalendarDays, Receipt, Database, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  icon: any;
  done: boolean;
  action: () => void;
}

export default function OnboardingChecklist() {
  const { clinicId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: onboarding } = useQuery({
    queryKey: ["onboarding", clinicId],
    queryFn: async () => {
      if (!clinicId) return null;
      const { data } = await supabase
        .from("clinic_onboarding" as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();
      if (!data) {
        const { data: created } = await (supabase.from("clinic_onboarding" as any) as any)
          .insert({ clinic_id: clinicId })
          .select()
          .single();
        return created;
      }
      return data;
    },
    enabled: !!clinicId,
  });

  // Auto-mark items as done by checking actual data
  const { data: counts } = useQuery({
    queryKey: ["onboarding-counts", clinicId],
    queryFn: async () => {
      if (!clinicId) return { patients: 0, appointments: 0, invoices: 0 };
      const [{ count: p }, { count: a }, { count: i }] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId),
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId),
      ]);
      return { patients: p ?? 0, appointments: a ?? 0, invoices: i ?? 0 };
    },
    enabled: !!clinicId,
  });

  const updateOnboarding = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!clinicId) return;
      await (supabase.from("clinic_onboarding" as any) as any)
        .update(patch)
        .eq("clinic_id", clinicId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding"] }),
  });

  const loadDemo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("load_demo_data" as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demo data loaded! 20 patients added with appointments and invoices.");
      queryClient.invalidateQueries();
    },
    onError: (e: any) => toast.error("Failed: " + e.message),
  });

  const clearDemo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("clear_demo_data" as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demo data cleared");
      queryClient.invalidateQueries();
    },
    onError: (e: any) => toast.error("Failed: " + e.message),
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      if (!clinicId) return;
      await (supabase.from("clinic_onboarding" as any) as any)
        .update({ checklist_dismissed: true })
        .eq("clinic_id", clinicId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding"] }),
  });

  if (!onboarding || (onboarding as any).checklist_dismissed) return null;

  const ob = onboarding as any;
  const items: ChecklistItem[] = [
    {
      key: "profile",
      label: "Complete clinic profile",
      description: "Add logo, address, working hours",
      icon: Building2,
      done: !!ob.profile_completed,
      action: () => navigate("/settings?tab=clinic"),
    },
    {
      key: "patient",
      label: "Add your first patient",
      description: "Or load demo data to explore",
      icon: Users,
      done: !!ob.first_patient_added || (counts?.patients ?? 0) > 0,
      action: () => navigate("/patients"),
    },
    {
      key: "appointment",
      label: "Book an appointment",
      description: "Try the scheduling workflow",
      icon: CalendarDays,
      done: !!ob.first_appointment_booked || (counts?.appointments ?? 0) > 0,
      action: () => navigate("/appointments"),
    },
    {
      key: "invoice",
      label: "Generate an invoice",
      description: "See branded billing in action",
      icon: Receipt,
      done: !!ob.first_invoice_created || (counts?.invoices ?? 0) > 0,
      action: () => navigate("/billing"),
    },
    {
      key: "tour",
      label: "Take the product tour",
      description: "5-minute walkthrough of key features",
      icon: Compass,
      done: !!ob.tour_completed,
      action: () => {
        sessionStorage.setItem("startTour", "1");
        updateOnboarding.mutate({ tour_completed: true });
        navigate("/dashboard");
        toast.info("Tour complete — explore the sidebar to discover all modules!");
      },
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const progressPct = Math.round((doneCount / items.length) * 100);

  if (doneCount === items.length) return null;

  return (
    <Card className="shadow-card border-0 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Get started with DoctorsBuddy
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {doneCount} of {items.length} steps complete
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!ob.demo_data_loaded ? (
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 text-xs"
                onClick={() => loadDemo.mutate()}
                disabled={loadDemo.isPending}
              >
                <Database className="h-3.5 w-3.5" />
                {loadDemo.isPending ? "Loading..." : "Load Demo Data"}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs"
                onClick={() => clearDemo.mutate()}
                disabled={clearDemo.isPending}
              >
                Clear demo
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => dismiss.mutate()}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Progress value={progressPct} className="h-1.5 mt-2" />
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={item.action}
            className={`flex items-start gap-3 rounded-lg p-3 text-left transition-all border ${
              item.done
                ? "bg-success/5 border-success/20 cursor-default"
                : "bg-background border-border hover:border-primary/40 hover:shadow-sm"
            }`}
            disabled={item.done}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                item.done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {item.done ? <Check className="h-4 w-4" /> : <item.icon className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                {item.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
