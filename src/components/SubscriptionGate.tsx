import { useState } from "react";
import { useSubscription, useSuperAdmin } from "@/hooks/useSubscription";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, ShieldX, Mail, Check, Crown, Phone, ArrowUpCircle, Infinity as InfinityIcon } from "lucide-react";
import { toast } from "sonner";

interface PlanRow {
  id: string;
  code: string;
  name: string;
  price_inr: number;
  billing_cycle: string;
  features: string[] | null;
  sort_order: number | null;
}

function PlansAndPurchase({ clinicId, currentPlan, statusLabel }: { clinicId: string | null; currentPlan: string | null; statusLabel: string }) {
  const queryClient = useQueryClient();
  const [requesting, setRequesting] = useState<string | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["public-subscription-plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscription_plans" as any)
        .select("id, code, name, price_inr, billing_cycle, features, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("price_inr", { ascending: true });
      return (data as any[]) as PlanRow[];
    },
  });

  const requestPlan = useMutation({
    mutationFn: async (plan: PlanRow) => {
      if (!clinicId) throw new Error("No clinic context");
      await supabase.from("audit_log").insert({
        clinic_id: clinicId,
        action: "plan_purchase_requested",
        table_name: "clinic_subscriptions",
        details: {
          current_plan: currentPlan,
          requested_plan: plan.code,
          plan_name: plan.name,
          price_inr: plan.price_inr,
          billing_cycle: plan.billing_cycle,
          requested_at: new Date().toISOString(),
          source: "subscription_gate",
        },
      } as any);
    },
    onMutate: (p) => setRequesting(p.code),
    onSuccess: () => {
      toast.success("Purchase request submitted! Our team will contact you within 24 hours.");
      queryClient.invalidateQueries({ queryKey: ["clinic-subscription"] });
      setRequesting(null);
    },
    onError: (e: any) => {
      toast.error(e.message || "Could not submit request");
      setRequesting(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Badge variant="outline">{statusLabel}</Badge>
        <h2 className="text-2xl sm:text-3xl font-bold">Choose a plan to continue</h2>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          Pick the plan that fits your clinic. Our team will reach out to complete activation and payment.
        </p>
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground">Loading plans...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans?.map((plan) => {
            const isLifetime = plan.billing_cycle === "lifetime";
            const isPopular = plan.code === "pro";
            return (
              <Card key={plan.id} className={`relative border-0 shadow-card ${isLifetime ? "ring-2 ring-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20" : isPopular ? "ring-1 ring-primary/40" : ""}`}>
                {isLifetime && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 bg-amber-500 hover:bg-amber-500 gap-1">
                    <InfinityIcon className="h-3 w-3" /> Best Value
                  </Badge>
                )}
                {isPopular && !isLifetime && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">Most Popular</Badge>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {isLifetime && <Crown className="h-4 w-4 text-amber-500" />}
                    {plan.name}
                  </CardTitle>
                  <div className="mt-1">
                    <span className="text-2xl font-bold">₹{plan.price_inr.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {isLifetime ? "one-time" : `/ ${plan.billing_cycle}`}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-1.5">
                    {(plan.features || []).map((f, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5">
                        <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant={isLifetime ? "default" : isPopular ? "default" : "outline"}
                    className={`w-full gap-1.5 ${isLifetime ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                    onClick={() => requestPlan.mutate(plan)}
                    disabled={requesting === plan.code}
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    {requesting === plan.code ? "Requesting..." : isLifetime ? "Get Lifetime Access" : "Request Purchase"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Questions or need a custom plan?</p>
              <p className="text-xs text-muted-foreground">Talk to our team for tailored pricing for your clinic.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href="tel:+919999999999"><Phone className="h-4 w-4" /> Call</a>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href="mailto:support@doctorsbuddy.in"><Mail className="h-4 w-4" /> Email</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { data: subscription, isLoading } = useSubscription();
  const { data: isSuperAdmin } = useSuperAdmin();
  const { clinicId, signOut } = useAuth();

  if (isSuperAdmin) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!subscription) return <>{children}</>;

  const { status, daysLeft, planName } = subscription;

  if (status === "active" || (status === "trial" && (daysLeft ?? 0) > 0)) {
    return (
      <>
        {status === "trial" && daysLeft !== null && daysLeft <= 7 && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-sm text-amber-700">
            <Clock className="inline h-4 w-4 mr-1" />
            Your free trial ends in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>. Choose a plan to keep access.
          </div>
        )}
        {children}
      </>
    );
  }

  const blockedConfig: Record<string, { icon: any; title: string; description: string; color: string }> = {
    trial_expired: { icon: Clock, title: "Trial Period Ended", description: "Your 30-day free trial has expired. Pick a plan below to keep using DoctorsBuddy.", color: "text-amber-500" },
    pending_approval: { icon: Clock, title: "Pending Approval", description: "Your clinic registration is under review. Meanwhile, you can pre-select a plan below.", color: "text-blue-500" },
    suspended: { icon: ShieldX, title: "Account Suspended", description: "Your account has been suspended. Contact support, or request reactivation by choosing a plan.", color: "text-destructive" },
    expired: { icon: AlertTriangle, title: "Subscription Expired", description: "Your subscription has expired. Renew by picking a plan below.", color: "text-amber-500" },
    no_subscription: { icon: AlertTriangle, title: "No Active Subscription", description: "Get started by choosing a plan that fits your clinic.", color: "text-muted-foreground" },
  };

  const config = blockedConfig[status] || blockedConfig.expired;
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-8 pb-6 text-center space-y-3">
            <Icon className={`h-14 w-14 mx-auto ${config.color}`} />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{config.title}</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">{config.description}</p>
          </CardContent>
        </Card>

        <PlansAndPurchase clinicId={clinicId} currentPlan={planName} statusLabel={config.title} />

        <div className="text-center pt-4 pb-8">
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
