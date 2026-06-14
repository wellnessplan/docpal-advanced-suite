import { supabase } from "@/integrations/supabase/client";

/**
 * Mark a patient as "arrived":
 *  - flips today's scheduled/confirmed appointment → checked_in
 *  - generates a queue token (if one doesn't already exist for today)
 * Safe to call repeatedly — won't duplicate tokens for the same patient/day.
 */
export async function arrivePatient(opts: {
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  priority?: "normal" | "urgent" | "emergency";
}): Promise<{ token_number: number | null; reused: boolean }> {
  const { clinicId, patientId, appointmentId, priority = "normal" } = opts;
  const today = new Date().toISOString().split("T")[0];

  // 1) Flip appointment → checked_in
  if (appointmentId) {
    await supabase.from("appointments")
      .update({ status: "checked_in" as any })
      .eq("id", appointmentId)
      .in("status", ["scheduled", "confirmed"] as any);
  } else {
    await supabase.from("appointments")
      .update({ status: "checked_in" as any })
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .eq("appointment_date", today)
      .in("status", ["scheduled", "confirmed"] as any);
  }

  // 2) Re-use existing queue token if present
  const { data: existing } = await supabase.from("queue_tokens")
    .select("token_number")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("queue_date", today)
    .maybeSingle();
  if (existing?.token_number) return { token_number: existing.token_number, reused: true };

  // 3) Generate token
  const { data: nextNum } = await supabase.rpc("get_next_token_number", {
    p_clinic_id: clinicId, p_date: today,
  });
  await supabase.from("queue_tokens").insert({
    clinic_id: clinicId,
    patient_id: patientId,
    token_number: nextNum ?? 1,
    queue_date: today,
    status: "waiting",
    priority,
  } as any);

  return { token_number: nextNum ?? 1, reused: false };
}

/**
 * When a treatment is completed, finalize the patient's open DRAFT invoice
 * if every accepted treatment item on it is now done.
 * Draft → 'unpaid' (ready to collect).
 */
export async function finalizeDraftInvoiceIfReady(opts: {
  clinicId: string;
  patientId: string;
}) {
  const { clinicId, patientId } = opts;

  const { data: draft } = await supabase.from("invoices")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draft?.id) return { finalized: false };

  // Check if any treatment_plan_items for this patient are still in_progress (accepted but not done)
  const { data: plans } = await supabase.from("treatment_plans")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .in("status", ["patient_accepted", "presented", "in_progress"] as any);
  const planIds = (plans ?? []).map((p: any) => p.id);
  if (planIds.length) {
    const { data: pending } = await supabase.from("treatment_plan_items")
      .select("id")
      .in("treatment_plan_id", planIds)
      .eq("status", "in_progress")
      .limit(1);
    if (pending && pending.length > 0) return { finalized: false };
  }


  await supabase.from("invoices")
    .update({ status: "unpaid" as any })
    .eq("id", draft.id);

  return { finalized: true, invoiceId: draft.id };
}

/**
 * One-click "mark treatment complete" + auto-invoice flow.
 * - Sets the tooth_treatment row to completed (+performed_at)
 * - Ensures the treatment appears on a draft invoice for the patient
 *   (creates one if no open draft exists, otherwise appends item)
 * - Returns { invoiceId, balance } so caller can launch Record Payment
 */
export async function completeTreatmentAndInvoice(opts: {
  clinicId: string;
  patientId: string;
  treatmentId: string;
  treatmentName: string;
  toothNumber?: number | null;
  cost: number;
}): Promise<{ invoiceId: string | null; balance: number; created: boolean }> {
  const { clinicId, patientId, treatmentId, treatmentName, toothNumber, cost } = opts;

  // 1) mark completed
  const { error: uErr } = await supabase.from("tooth_treatments")
    .update({ status: "completed" as any, performed_at: new Date().toISOString() })
    .eq("id", treatmentId);
  if (uErr) throw uErr;

  // 2) skip invoicing if already billed
  const { data: existingItem } = await supabase.from("invoice_items")
    .select("id, invoice_id")
    .eq("tooth_treatment_id", treatmentId)
    .maybeSingle();
  if (existingItem?.invoice_id) {
    const { data: inv } = await supabase.from("invoices")
      .select("id, amount, paid_amount")
      .eq("id", existingItem.invoice_id).maybeSingle();
    const balance = Number(inv?.amount || 0) - Number(inv?.paid_amount || 0);
    return { invoiceId: inv?.id ?? null, balance, created: false };
  }

  // 3) find an existing open draft, else create one
  const { data: draft } = await supabase.from("invoices")
    .select("id, amount, subtotal, paid_amount")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle();

  let invoiceId = draft?.id as string | undefined;
  let created = false;
  const unit = Math.max(0, Number(cost) || 0);

  if (!invoiceId) {
    const { data: inv, error } = await supabase.from("invoices").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      amount: unit,
      total: unit,
      subtotal: unit,
      status: "unpaid",
    } as any).select("id").single();
    if (error) throw error;
    invoiceId = inv.id;
    created = true;
  } else {
    // append cost to existing draft and flip to unpaid (ready to collect)
    const newSubtotal = Number(draft?.subtotal || draft?.amount || 0) + unit;
    await supabase.from("invoices").update({
      amount: newSubtotal,
      total: newSubtotal,
      subtotal: newSubtotal,
      status: "unpaid",
    } as any).eq("id", invoiceId);
  }

  await supabase.from("invoice_items").insert({
    invoice_id: invoiceId!,
    tooth_treatment_id: treatmentId,
    description: `${treatmentName}${toothNumber ? ` (Tooth #${toothNumber})` : ""}`,
    quantity: 1,
    unit_price: unit,
    total: unit,
  } as any);

  // recompute final balance
  const { data: finalInv } = await supabase.from("invoices")
    .select("amount, paid_amount").eq("id", invoiceId!).maybeSingle();
  const balance = Number(finalInv?.amount || 0) - Number(finalInv?.paid_amount || 0);
  return { invoiceId: invoiceId!, balance, created };
}
