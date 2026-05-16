// Centralised billing/invoice math. ALL revenue-impacting calculations live here
// so a single, well-tested module governs tax, discount, total, and balance logic.
// Do NOT scatter these formulas into components — they belong here.

export interface InvoiceLike {
  // Either subtotal or amount may carry the pre-discount sum, depending on how
  // the row was written historically. We tolerate both.
  subtotal?: number | string | null;
  amount?: number | string | null;
  total?: number | string | null;

  discount?: number | string | null;          // flat ₹ discount (legacy)
  discount_amount?: number | string | null;   // flat ₹ discount (new)
  discount_percent?: number | string | null;  // % discount

  tax_rate?: number | string | null;          // % e.g. 18 for 18%
  tax_amount?: number | string | null;        // pre-computed tax (preferred when set)

  paid_amount?: number | string | null;
}

export interface InvoiceItemLike {
  quantity?: number | string | null;
  unit_price?: number | string | null;
}

const n = (v: unknown, fallback = 0): number => {
  if (v == null || v === "") return fallback;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : fallback;
};

/** Round to 2 decimals using banker-safe rounding for money. */
export const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

/** Compute one line item's amount = qty * unit_price (qty defaults to 1). */
export const lineAmount = (item: InvoiceItemLike): number =>
  round2(n(item.quantity, 1) * n(item.unit_price));

/** Sum of all line amounts. */
export const sumItems = (items: InvoiceItemLike[]): number =>
  round2(items.reduce((s, it) => s + lineAmount(it), 0));

/**
 * Combined discount = flat ₹ discount + (subtotal * pct / 100).
 * Capped to subtotal so a discount can never exceed the bill itself.
 */
export function computeDiscount(subtotal: number, flat: number, pct: number): number {
  const safeSubtotal = Math.max(0, subtotal);
  const safeFlat = Math.max(0, flat);
  const safePct = Math.max(0, Math.min(100, pct));
  const raw = safeFlat + (safeSubtotal * safePct) / 100;
  return round2(Math.min(safeSubtotal, raw));
}

/** Tax = (subtotal - discount) * rate / 100, never negative. */
export function computeTax(subtotal: number, discount: number, taxRate: number): number {
  const taxable = Math.max(0, subtotal - discount);
  const rate = Math.max(0, taxRate);
  return round2((taxable * rate) / 100);
}

/** Final total = subtotal − discount + tax, floored at 0. */
export function computeTotal(subtotal: number, discount: number, tax: number): number {
  return round2(Math.max(0, subtotal - discount + tax));
}

export interface InvoiceTotals {
  subtotal: number;
  discountFlat: number;
  discountPercent: number;
  discountTotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paid: number;
  balance: number;
  isPaid: boolean;
}

/**
 * Derive every billing figure from an invoice row.
 *
 * Behaviour preserved from the original InvoiceReceipt component:
 *   - `subtotal` falls back to `amount` if not present.
 *   - `total` falls back to `amount`. If neither is set we re-derive it from
 *     subtotal − discount + tax (forward-compatible default).
 *   - `tax_amount` is trusted when present, otherwise re-computed from the
 *     rate. This avoids silently rewriting historical rows.
 */
export function deriveInvoiceTotals(invoice: InvoiceLike): InvoiceTotals {
  const subtotal = n(invoice.subtotal ?? invoice.amount);
  const discountFlat = n(invoice.discount ?? invoice.discount_amount);
  const discountPercent = n(invoice.discount_percent);
  const discountTotal = computeDiscount(subtotal, discountFlat, discountPercent);

  const taxRate = n(invoice.tax_rate);
  const taxAmount =
    invoice.tax_amount != null && invoice.tax_amount !== ""
      ? n(invoice.tax_amount)
      : computeTax(subtotal, discountTotal, taxRate);

  const totalRaw = invoice.total != null && invoice.total !== "" ? n(invoice.total) : null;
  const amountRaw = invoice.amount != null && invoice.amount !== "" ? n(invoice.amount) : null;
  const total =
    totalRaw ?? amountRaw ?? computeTotal(subtotal, discountTotal, taxAmount);

  const paid = Math.max(0, n(invoice.paid_amount));
  const balance = round2(total - paid);

  return {
    subtotal: round2(subtotal),
    discountFlat: round2(discountFlat),
    discountPercent: round2(discountPercent),
    discountTotal,
    taxRate: round2(taxRate),
    taxAmount: round2(taxAmount),
    total: round2(total),
    paid: round2(paid),
    balance,
    isPaid: balance <= 0,
  };
}
