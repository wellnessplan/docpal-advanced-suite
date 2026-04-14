import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SubscriptionStatus = "trial" | "trial_expired" | "active" | "expired" | "suspended" | "pending_approval" | "no_subscription";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  daysLeft: number | null;
  planName: string | null;
}

export function useSubscription() {
  const { clinicId } = useAuth();

  return useQuery({
    queryKey: ["clinic-subscription", clinicId],
    queryFn: async (): Promise<SubscriptionInfo> => {
      if (!clinicId) return { status: "no_subscription", trialEndsAt: null, daysLeft: null, planName: null };

      const { data, error } = await supabase
        .from("clinic_subscriptions" as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .single();

      if (error || !data) return { status: "no_subscription", trialEndsAt: null, daysLeft: null, planName: null };

      const sub = data as any;
      let status: SubscriptionStatus = sub.status;

      if (sub.status === "trial" && sub.trial_ends_at) {
        const endsAt = new Date(sub.trial_ends_at);
        if (endsAt <= new Date()) {
          status = "trial_expired";
        }
      }

      const daysLeft = sub.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

      return {
        status,
        trialEndsAt: sub.trial_ends_at,
        daysLeft,
        planName: sub.plan_name,
      };
    },
    enabled: !!clinicId,
  });
}

export function useSuperAdmin() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-super-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("super_admins" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });
}
