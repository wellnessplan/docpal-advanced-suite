import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, requireClinic } from "../supabase";

export default defineTool({
  name: "book_appointment",
  title: "Book an appointment",
  description:
    "Create a new appointment for an existing patient in the signed-in user's clinic. Check list_appointments first to avoid double-booking.",
  inputSchema: {
    patient_id: z.string().describe("Patient UUID, from list_patients."),
    appointment_date: z.string().describe("Date in YYYY-MM-DD format."),
    appointment_time: z.string().describe("Start time in 24h HH:MM format."),
    duration_minutes: z.number().int().optional().describe("Slot length in minutes, default 30."),
    type: z.string().optional().describe("Appointment type, e.g. Consultation, Cleaning, Root Canal."),
    notes: z.string().optional().describe("Optional note for the front desk or doctor."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  
  handler: async (input, ctx) => {
    const scope = await requireClinic(ctx);
    if ("error" in scope) return scope.error;

    const { data: patient } = await scope.supabase
      .from("patients")
      .select("id, full_name")
      .eq("id", input.patient_id)
      .eq("clinic_id", scope.clinicId)
      .maybeSingle();

    if (!patient) return { content: [{ type: "text", text: "Patient not found in your clinic." }], isError: true };

    const { data, error } = await scope.supabase
      .from("appointments")
      .insert({
        clinic_id: scope.clinicId,
        patient_id: input.patient_id,
        appointment_date: input.appointment_date,
        appointment_time: input.appointment_time,
        duration_minutes: input.duration_minutes ?? 30,
        type: input.type ?? "Consultation",
        notes: input.notes ?? null,
        status: "scheduled",
      })
      .select("id, appointment_date, appointment_time, duration_minutes, type, status")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return jsonResult({ booked: true, patient: patient.full_name, appointment: data });
  },
});
