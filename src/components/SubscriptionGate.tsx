import { useSubscription, useSuperAdmin } from "@/hooks/useSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, ShieldX, Mail } from "lucide-react";

export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { data: subscription, isLoading } = useSubscription();
  const { data: isSuperAdmin } = useSuperAdmin();

  // Super admins bypass all gates
  if (isSuperAdmin) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!subscription) return <>{children}</>;

  const { status, daysLeft } = subscription;

  // Active or trial with days remaining → allow access
  if (status === "active" || (status === "trial" && (daysLeft ?? 0) > 0)) {
    return (
      <>
        {status === "trial" && daysLeft !== null && daysLeft <= 7 && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-sm text-amber-700">
            <Clock className="inline h-4 w-4 mr-1" />
            Your free trial ends in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>. Contact us to upgrade.
          </div>
        )}
        {children}
      </>
    );
  }

  // Blocked states
  const blockedConfig = {
    trial_expired: {
      icon: Clock,
      title: "Trial Period Ended",
      description: "Your 30-day free trial has expired. Please contact us to activate your subscription and continue using DoctorsBuddy.",
      color: "text-amber-500",
    },
    pending_approval: {
      icon: Clock,
      title: "Pending Approval",
      description: "Your clinic registration is under review. We'll notify you once your account is approved.",
      color: "text-blue-500",
    },
    suspended: {
      icon: ShieldX,
      title: "Account Suspended",
      description: "Your account has been suspended. Please contact support for assistance.",
      color: "text-destructive",
    },
    expired: {
      icon: AlertTriangle,
      title: "Subscription Expired",
      description: "Your subscription has expired. Please renew to continue using DoctorsBuddy.",
      color: "text-amber-500",
    },
    no_subscription: {
      icon: AlertTriangle,
      title: "No Subscription Found",
      description: "Please contact support to set up your subscription.",
      color: "text-muted-foreground",
    },
  };

  const config = blockedConfig[status as keyof typeof blockedConfig] || blockedConfig.expired;
  const Icon = config.icon;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <Icon className={`h-16 w-16 mx-auto ${config.color}`} />
          <h2 className="text-2xl font-bold text-foreground">{config.title}</h2>
          <p className="text-muted-foreground">{config.description}</p>
          <Button variant="outline" className="gap-2" asChild>
            <a href="mailto:support@doctorsbuddy.in">
              <Mail className="h-4 w-4" /> Contact Support
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
