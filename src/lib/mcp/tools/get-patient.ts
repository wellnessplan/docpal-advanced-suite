import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, requireClinic } from "../supabase";

export default defineTool({
  name: "get_patient",
  title: "Get patient record",
  description:
    "Fetch one patient's profile with their recent appointments, invoices and treatment plans.",
  inputSchema: {
    patient_id: z.string().describe("The patient UUID, from list_patients."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ patient_id }, ctx) => {
    const scope = await requireClinic(ctx);
    if ("error" in scope) return scope.error;

    const { data: patient, error } = await scope.supabase
      .from("patients")
      .select("*")
      .eq("id", patient_id)
      .eq("clinic_id", scope.clinicId)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!patient) return { content: [{ type: "text", text: "Patient not found in your clinic." }], isError: true };

    const [appointments, invoices, plans] = await Promise.all([
      scope.supabase
        .from("appointments")
        .select("id, appointment_date, appointment_time, type, status, notes")
        .eq("patient_id", patient_id)
        .order("appointment_date", { ascending: false })
        .limit(10),
      scope.supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, total, paid_amount, balance, status")
        .eq("patient_id", patient_id)
        .order("invoice_date", { ascending: false })
        .limit(10),
      scope.supabase
        .from("treatment_plans")
        .select("id, plan_name, status, total_estimated_cost, created_at")
        .eq("patient_id", patient_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return jsonResult({
      patient,
      recent_appointments: appointments.data ?? [],
      recent_invoices: invoices.data ?? [],
      treatment_plans: plans.data ?? [],
    });
  },
});
