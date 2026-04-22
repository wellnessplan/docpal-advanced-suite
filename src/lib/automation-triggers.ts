import { supabase } from "@/integrations/supabase/client";

/**
 * Fires an instant WhatsApp automation (post-treatment Rx + post-op).
 * Fails silently — automation is optional and never blocks clinical flow.
 */
export async function fireInstantPostTreatment(opts: {
  clinicId: string;
  treatmentId: string;
}) {
  try {
    await supabase.functions.invoke("run-automation-rules", {
      body: {
        event: "post_treatment_instant",
        clinic_id: opts.clinicId,
        treatment_id: opts.treatmentId,
      },
    });
  } catch (e) {
    // Non-blocking: log only
    console.warn("[automation] post_treatment_instant failed", e);
  }
}
