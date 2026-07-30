import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, requireClinic } from "../supabase";

export default defineTool({
  name: "list_patients",
  title: "List patients",
  description:
    "Search or list patients in the signed-in user's clinic. Optionally filter by name, phone or OP number.",
  inputSchema: {
    search: z.string().optional().describe("Name, phone or OP number fragment to search for."),
    limit: z.number().int().optional().describe("Maximum patients to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    const scope = await requireClinic(ctx);
    if ("error" in scope) return scope.error;

    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    let query = scope.supabase
      .from("patients")
      .select("id, op_number, full_name, phone, email, gender, age, date_of_birth, allergies, created_at")
      .eq("clinic_id", scope.clinicId)
      .order("created_at", { ascending: false })
      .limit(take);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`full_name.ilike.${term},phone.ilike.${term},op_number.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return jsonResult({ count: data?.length ?? 0, patients: data ?? [] });
  },
});
