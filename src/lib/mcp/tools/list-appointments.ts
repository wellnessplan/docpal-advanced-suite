import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, requireClinic } from "../supabase";

export default defineTool({
  name: "list_appointments",
  title: "List appointments",
  description:
    "List appointments for the clinic within a date range, optionally filtered by status. Defaults to today.",
  inputSchema: {
    from_date: z.string().optional().describe("Start date, YYYY-MM-DD. Defaults to today."),
    to_date: z.string().optional().describe("End date, YYYY-MM-DD. Defaults to from_date."),
    status: z.string().optional().describe("Filter by status, e.g. scheduled, completed, cancelled."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from_date, to_date, status }, ctx) => {
    const scope = await requireClinic(ctx);
    if ("error" in scope) return scope.error;

    const start = from_date?.trim() || new Date().toISOString().slice(0, 10);
    const end = to_date?.trim() || start;

    let query = scope.supabase
      .from("appointments")
      .select(
        "id, appointment_date, appointment_time, duration_minutes, type, status, notes, patient_id, patients(full_name, phone, op_number)",
      )
      .eq("clinic_id", scope.clinicId)
      .gte("appointment_date", start)
      .lte("appointment_date", end)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true })
      .limit(200);

    if (status?.trim()) query = query.eq("status", status.trim());

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return jsonResult({ from: start, to: end, count: data?.length ?? 0, appointments: data ?? [] });
  },
});
