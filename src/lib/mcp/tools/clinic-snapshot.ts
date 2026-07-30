import { defineTool } from "@lovable.dev/mcp-js";
import { jsonResult, requireClinic } from "../supabase";

export default defineTool({
  name: "clinic_snapshot",
  title: "Clinic snapshot",
  description:
    "Today's operating snapshot for the signed-in user's clinic: appointment counts, live queue, patients added and revenue collected.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const scope = await requireClinic(ctx);
    if ("error" in scope) return scope.error;

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + "01";

    const [clinic, appts, queue, newPatients, invoices] = await Promise.all([
      scope.supabase.from("clinics").select("name, phone, email").eq("id", scope.clinicId).maybeSingle(),
      scope.supabase
        .from("appointments")
        .select("status")
        .eq("clinic_id", scope.clinicId)
        .eq("appointment_date", today),
      scope.supabase
        .from("queue_tokens")
        .select("status")
        .eq("clinic_id", scope.clinicId)
        .eq("queue_date", today),
      scope.supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", scope.clinicId)
        .gte("created_at", `${monthStart}T00:00:00Z`),
      scope.supabase
        .from("invoices")
        .select("total, paid_amount, balance, invoice_date")
        .eq("clinic_id", scope.clinicId)
        .gte("invoice_date", monthStart),
    ]);

    const byStatus = (rows: { status: string | null }[] | null) =>
      (rows ?? []).reduce<Record<string, number>>((acc, r) => {
        const key = r.status ?? "unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});

    const rows = invoices.data ?? [];
    return jsonResult({
      clinic: clinic.data?.name ?? "Clinic",
      date: today,
      appointments_today: { total: appts.data?.length ?? 0, by_status: byStatus(appts.data) },
      queue_today: { total: queue.data?.length ?? 0, by_status: byStatus(queue.data) },
      new_patients_this_month: newPatients.count ?? 0,
      billing_this_month: {
        invoiced: rows.reduce((s, r) => s + Number(r.total ?? 0), 0),
        collected: rows.reduce((s, r) => s + Number(r.paid_amount ?? 0), 0),
        outstanding: rows.reduce((s, r) => s + Number(r.balance ?? 0), 0),
      },
    });
  },
});
