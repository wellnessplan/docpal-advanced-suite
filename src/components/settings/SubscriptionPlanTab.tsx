import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, Clock, ArrowUpCircle, ArrowDownCircle, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  clinicId: string;
}

type BillingCycle = "monthly" | "yearly";
const YEARLY_DISCOUNT = 0.2; // 20% off

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: 999,
    features: ["Up to 500 patients", "1 doctor", "Basic reports", "WhatsApp templates", "Email support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 2499,
    popular: true,
    features: ["Unlimited patients", "Up to 5 doctors", "Advanced analytics", "Automated reminders", "Priority support", "Custom branding"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 5999,
    features: ["Everything in Pro", "Unlimited doctors", "Multi-clinic support", "API access", "Dedicated manager", "Custom integrations"],
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: 50000,
    lifetime: true,
    features: ["One-time payment, never pay again", "Unlimited patients & doctors", "Multi-branch support", "All Pro & Enterprise features", "Priority support for life", "Free future updates"],
  },
];

function getCycledPrice(monthly: number, cycle: BillingCycle) {
  // Yearly = 12 months * monthly * (1 - discount)
  const yearly = Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT));
  return cycle === "yearly" ? yearly : monthly;
}

export default function SubscriptionPlanTab({ clinicId }: Props) {
  const queryClient = useQueryClient();
  const [requesting, setRequesting] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");


  const { data: subscription, isLoading } = useQuery({
    queryKey: ["clinic-subscription-tab", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_subscriptions" as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();
      return data as any;
    },
  });

  const currentPlan = subscription?.plan_name || "basic";
  const status = subscription?.status || "trial";

  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const requestPlanChange = useMutation({
    mutationFn: async ({ planId, planCycle }: { planId: string; planCycle: BillingCycle | "lifetime" }) => {
      const plan = PLANS.find(p => p.id === planId);
      const price = plan?.lifetime ? plan.price : getCycledPrice(plan?.price || 0, planCycle as BillingCycle);
      await supabase.from("audit_log").insert({
        clinic_id: clinicId,
        action: "plan_change_requested",
        table_name: "clinic_subscriptions",
        record_id: subscription?.id || null,
        details: {
          current_plan: currentPlan,
          requested_plan: planId,
          billing_cycle: planCycle,
          price_inr: price,
          requested_at: new Date().toISOString(),
        },
      } as any);
    },
    onMutate: (planId: string) => setRequesting(planId),
    onSuccess: (_d, planId) => {
      const action = PLANS.findIndex(p => p.id === planId) > PLANS.findIndex(p => p.id === currentPlan) ? "upgrade" : "downgrade";
      toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)} request submitted! Our team will contact you shortly.`);
      queryClient.invalidateQueries({ queryKey: ["clinic-subscription-tab"] });
      setRequesting(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setRequesting(null);
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading subscription...</p>;

  const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    trial: { label: "Free Trial", variant: "secondary" },
    active: { label: "Active", variant: "default" },
    pending_approval: { label: "Pending Approval", variant: "outline" },
    suspended: { label: "Suspended", variant: "destructive" },
    expired: { label: "Expired", variant: "destructive" },
  };
  const sb = statusBadge[status] || statusBadge.trial;

  return (
    <div className="space-y-6">
      {/* Current plan summary */}
      <Card className="shadow-card border-0 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Crown className="h-5 w-5 text-primary" /> Current Subscription
              </CardTitle>
              <CardDescription>Your active plan and billing details</CardDescription>
            </div>
            <Badge variant={sb.variant}>{sb.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="font-bold text-lg capitalize">{currentPlan}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Billing</p>
              <p className="font-bold text-lg capitalize">{subscription?.billing_cycle || "Monthly"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{status === "trial" ? "Trial Ends" : "Next Billing"}</p>
              <p className="font-bold text-lg">
                {status === "trial" && trialDaysLeft !== null
                  ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left`
                  : subscription?.next_billing_date
                    ? new Date(subscription.next_billing_date).toLocaleDateString()
                    : "—"}
              </p>
            </div>
          </div>

          {status === "trial" && trialDaysLeft !== null && trialDaysLeft <= 7 && (
            <div className="mt-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Your trial ends in <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}</strong>. Choose a plan below to continue uninterrupted access.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available plans */}
      <div>
        <h3 className="font-heading text-lg font-semibold mb-1">Available Plans</h3>
        <p className="text-sm text-muted-foreground mb-4">Click a plan to request an upgrade or downgrade. Our team will contact you to complete the change.</p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan: any) => {
            const isCurrent = plan.id === currentPlan;
            const currentIdx = PLANS.findIndex(p => p.id === currentPlan);
            const planIdx = PLANS.findIndex(p => p.id === plan.id);
            const isUpgrade = planIdx > currentIdx;
            const isLifetime = !!plan.lifetime;

            return (
              <Card
                key={plan.id}
                className={`relative shadow-card border-0 transition-all ${
                  isCurrent ? "ring-2 ring-primary" :
                  isLifetime ? "ring-2 ring-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20" :
                  plan.popular ? "ring-1 ring-primary/30" : ""
                }`}
              >
                {isLifetime && !isCurrent && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 bg-amber-500 hover:bg-amber-500">Best Value</Badge>
                )}
                {plan.popular && !isCurrent && !isLifetime && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">Most Popular</Badge>
                )}
                {isCurrent && (
                  <Badge variant="secondary" className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">Current Plan</Badge>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-xl">{plan.name}</CardTitle>
                  <div className="mt-1">
                    <span className="text-3xl font-bold">Rs {plan.price.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">{isLifetime ? " one-time" : "/mo"}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((f: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      variant={isUpgrade || isLifetime ? "default" : "outline"}
                      className={`w-full gap-1.5 ${isLifetime ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                      onClick={() => requestPlanChange.mutate(plan.id)}
                      disabled={requesting === plan.id}
                    >
                      {isUpgrade || isLifetime ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                      {requesting === plan.id ? "Requesting..." : isLifetime ? "Get Lifetime" : isUpgrade ? "Request Upgrade" : "Request Downgrade"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Contact card */}
      <Card className="border-dashed">
        <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Need a custom plan or have questions?</p>
              <p className="text-xs text-muted-foreground">Our team is happy to help tailor a plan to your clinic.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="mailto:support@doctorsbuddy.in">Contact Sales</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
