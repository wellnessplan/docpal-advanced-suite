import { z } from "zod";

/**
 * Centralized client-side validation schemas.
 * All forms should import from here so rules stay consistent app-wide.
 */

// ---------- Primitives ----------
export const phoneIN = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");

export const emailField = z
  .string()
  .trim()
  .email("Enter a valid email")
  .max(255, "Email too long")
  .or(z.literal(""))
  .optional();

export const nameField = z
  .string()
  .trim()
  .min(2, "Must be at least 2 characters")
  .max(100, "Must be under 100 characters");

export const moneyField = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "string" ? Number(v) : v))
  .refine((n) => !Number.isNaN(n) && n >= 0, "Enter a valid amount")
  .refine((n) => n < 1e9, "Amount too large");

export const dateNotFuture = z
  .string()
  .refine((s) => !s || new Date(s).getTime() <= Date.now(), "Date cannot be in the future");

export const dateNotPast = z
  .string()
  .refine((s) => !s || new Date(s).getTime() >= new Date().setHours(0, 0, 0, 0), "Date cannot be in the past");

// ---------- Entities ----------
export const patientSchema = z.object({
  full_name: nameField,
  phone: phoneIN,
  email: emailField,
  date_of_birth: dateNotFuture.optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type PatientInput = z.infer<typeof patientSchema>;

export const appointmentSchema = z.object({
  patient_id: z.string().uuid("Select a patient"),
  appointment_date: z.string().min(1, "Pick a date"),
  appointment_time: z.string().min(1, "Pick a time"),
  duration_minutes: z.coerce.number().int().min(5).max(480).default(30),
  treatment_type: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type AppointmentInput = z.infer<typeof appointmentSchema>;

export const invoiceSchema = z.object({
  patient_id: z.string().uuid("Select a patient"),
  amount: moneyField,
  paid_amount: moneyField.optional(),
  discount: moneyField.optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const expenseSchema = z.object({
  category: z.string().trim().min(1, "Pick a category").max(100),
  description: z.string().trim().min(2, "Add a short description").max(500),
  amount: moneyField,
  expense_date: dateNotFuture,
  payment_method: z.string().trim().max(50).optional(),
  vendor_name: z.string().trim().max(200).optional(),
  gst_rate: z.coerce.number().min(0).max(100).optional(),
  reference_number: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

// ---------- Server error mapping ----------
/**
 * Map a Supabase / PostgREST / generic error into:
 *  - fieldErrors: { fieldName: message } — feed into setError(name, { message })
 *  - formErrors: string[] — render via <FormErrorSummary />
 */
export interface MappedServerError {
  fieldErrors: Record<string, string>;
  formErrors: string[];
}

const PG_FIELD_HINTS: Array<{ test: RegExp; field: string; message: string }> = [
  { test: /duplicate key.*phone/i, field: "phone", message: "A record with this phone already exists" },
  { test: /duplicate key.*email/i, field: "email", message: "A record with this email already exists" },
  { test: /violates foreign key.*patient/i, field: "patient_id", message: "Selected patient is invalid" },
  { test: /check constraint.*amount/i, field: "amount", message: "Invalid amount" },
];

export function mapServerError(
  err: unknown,
  knownFields: string[] = [],
): MappedServerError {
  const fieldErrors: Record<string, string> = {};
  const formErrors: string[] = [];
  const e = err as any;
  const msg: string = e?.message || e?.error_description || (typeof err === "string" ? err : "") || "Something went wrong";

  // Supabase / Postgrest sometimes return structured details
  if (e?.details && typeof e.details === "object") {
    for (const [k, v] of Object.entries(e.details)) {
      if (knownFields.includes(k)) fieldErrors[k] = String(v);
    }
  }

  // Match known patterns
  for (const hint of PG_FIELD_HINTS) {
    if (hint.test.test(msg) && (knownFields.length === 0 || knownFields.includes(hint.field))) {
      fieldErrors[hint.field] = hint.message;
    }
  }

  if (Object.keys(fieldErrors).length === 0) formErrors.push(msg);
  return { fieldErrors, formErrors };
}

/**
 * Apply mapped errors to a react-hook-form instance.
 * Returns the form-level errors so caller can render <FormErrorSummary />.
 */
export function applyServerErrorsToForm<T extends { setError: (name: any, err: { message: string }) => void }>(
  form: T,
  err: unknown,
  knownFields: string[] = [],
): string[] {
  const { fieldErrors, formErrors } = mapServerError(err, knownFields);
  for (const [name, message] of Object.entries(fieldErrors)) {
    form.setError(name, { message });
  }
  return formErrors;
}
