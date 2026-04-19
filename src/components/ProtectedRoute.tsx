import { ReactNode, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SubscriptionGate from "./SubscriptionGate";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading, refreshProfile, user } = useAuth();
  const creatingRef = useRef(false);

  // Auto-create a placeholder clinic so users land directly on Dashboard.
  // They are nudged to complete profile via ProfileCompletionModal.
  useEffect(() => {
    if (loading) return;
    if (!session || !user) return;
    if (profile?.clinic_id) return;
    if (creatingRef.current) return;
    creatingRef.current = true;
    (async () => {
      try {
        const defaultName = (profile?.full_name?.trim() || user.email?.split("@")[0] || "My") + "'s Clinic";
        const { error } = await supabase.rpc("create_clinic_for_user" as any, {
          p_name: defaultName,
          p_phone: null,
          p_address: null,
          p_email: user.email || null,
        });
        if (!error) await refreshProfile();
      } catch {
        /* ignore — fall through to onboarding fallback */
      } finally {
        creatingRef.current = false;
      }
    })();
  }, [loading, session, user, profile, refreshProfile]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  // Wait briefly for auto-clinic creation; show loader rather than bounce to onboarding.
  if (!profile?.clinic_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Setting up your workspace...</div>
      </div>
    );
  }

  return <SubscriptionGate>{children}</SubscriptionGate>;
}

export function AuthOnlyRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
