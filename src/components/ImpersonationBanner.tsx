import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut } from "lucide-react";
import { toast } from "sonner";

/**
 * Persistent red banner shown when a super admin has impersonated a clinic.
 * Triggered by presence of `profiles.impersonating_original_clinic_id`.
 * One-click "Return to my account" restores the original clinic_id/group_id.
 */
export default function ImpersonationBanner() {
  const { profile, refreshProfile, clinicId } = useAuth();
  const qc = useQueryClient();
  const orig = (profile as any)?.impersonating_original_clinic_id as string | null | undefined;

  const { data: clinicName } = useQuery({
    queryKey: ["impersonated-clinic-name", clinicId],
    enabled: !!orig && !!clinicId,
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("name").eq("id", clinicId!).maybeSingle();
      return (data as any)?.name ?? "this clinic";
    },
  });

  const exit = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.rpc as any)("end_impersonation");
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Returned to your admin account");
      await refreshProfile();
      qc.invalidateQueries();
      // Hard reload to clear any clinic-scoped caches.
      setTimeout(() => window.location.assign("/platform"), 200);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to end impersonation"),
  });

  if (!orig) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-destructive text-destructive-foreground shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 md:px-6 py-2 text-sm font-medium">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="h-4 w-4 shrink-0 animate-pulse" />
          <span className="truncate">
            Impersonating <strong>{clinicName ?? "clinic"}</strong> — all actions are logged.
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={() => exit.mutate()}
          disabled={exit.isPending}
        >
          <LogOut className="h-3.5 w-3.5 mr-1" />
          {exit.isPending ? "Returning…" : "Return to my account"}
        </Button>
      </div>
    </div>
  );
}
