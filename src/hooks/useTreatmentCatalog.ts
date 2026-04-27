import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Single source of truth for the procedure / treatment catalog.
 * Reads from treatment_pricing so any row added there appears in dropdowns
 * across the dental chart, treatment plans, patient profile, etc.
 */
export function useTreatmentCatalog() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;

  const query = useQuery({
    queryKey: ["treatment-catalog", clinicId],
    queryFn: async () => {
      if (!clinicId) return [] as { name: string; price: number }[];
      const { data, error } = await supabase
        .from("treatment_pricing")
        .select("treatment_name, base_price")
        .eq("clinic_id", clinicId)
        .order("treatment_name");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        name: r.treatment_name as string,
        price: Number(r.base_price ?? 0),
      }));
    },
    enabled: !!clinicId,
    staleTime: 60_000,
  });

  return {
    catalog: query.data ?? [],
    names: (query.data ?? []).map((r) => r.name),
    priceFor: (name: string) =>
      (query.data ?? []).find((r) => r.name.toLowerCase() === name.toLowerCase())?.price ?? 0,
    isLoading: query.isLoading,
  };
}
