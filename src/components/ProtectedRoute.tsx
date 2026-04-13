import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// ⚠️ DEV MODE: Auth checks bypassed for testing
const DEV_BYPASS_AUTH = true;

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (DEV_BYPASS_AUTH) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (!profile?.clinic_id) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export function AuthOnlyRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (DEV_BYPASS_AUTH) return <>{children}</>;

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
