import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, requireClinic } from "../supabase";

export default defineTool({
  name: "list_invoices",
  title: "List invoices",
  description:
    "List clinic invoices, optionally only those with an outstanding balance or within a date range.",
  inputSchema: {
    outstanding_only: z.boolean().optional().describe("Only return invoices with a balance greater than zero."),
    from_date: z.string().optional().describe("Earliest invoice date, YYYY-MM-DD."),
    to_date: z.string().optional().describe("Latest invoice date, YYYY-MM-DD."),
    limit: z.number().int().optional().describe("Maximum invoices to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ outstanding_only, from_date, to_date, limit }, ctx) => {
    const scope = await requireClinic(ctx);
    if ("error" in scope) return scope.error;

    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    let query = scope.supabase
      .from("invoices")
      .select(
        "id, invoice_number, invoice_date, total, paid_amount, balance, status, patient_id, patients(full_name, phone)",
      )
      .eq("clinic_id", scope.clinicId)
      .order("invoice_date", { ascending: false })
      .limit(take);

    if (outstanding_only) query = query.gt("balance", 0);
    if (from_date?.trim()) query = query.gte("invoice_date", from_date.trim());
    if (to_date?.trim()) query = query.lte("invoice_date", to_date.trim());

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const outstanding = (data ?? []).reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
    return jsonResult({ count: data?.length ?? 0, total_outstanding: outstanding, invoices: data ?? [] });
  },
});
