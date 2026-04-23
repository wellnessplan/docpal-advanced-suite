import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { setClinicDefaults, type TemplateId, PDF_TEMPLATES } from "@/lib/pdf-templates";

/**
 * Loads clinic-wide default PDF templates (prescription + invoice) from
 * `clinic_settings` and caches them in the pdf-templates module so every
 * PDF builder picks them up automatically.
 */
export function useClinicPdfDefaults(clinicId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["clinic-pdf-defaults", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_settings")
        .select("setting_key, setting_value")
        .eq("clinic_id", clinicId!)
        .in("setting_key", ["default_rx_template", "default_invoice_template"]);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!data) return;
    let rx: TemplateId | null = null;
    let inv: TemplateId | null = null;
    data.forEach((s: any) => {
      if (s.setting_key === "default_rx_template" && PDF_TEMPLATES[s.setting_value as TemplateId]) {
        rx = s.setting_value;
      }
      if (s.setting_key === "default_invoice_template" && PDF_TEMPLATES[s.setting_value as TemplateId]) {
        inv = s.setting_value;
      }
    });
    setClinicDefaults(rx, inv);
  }, [data]);
}
