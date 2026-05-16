import { describe, expect, it } from "vitest";
import {
  computeDiscount,
  computeTax,
  computeTotal,
  deriveInvoiceTotals,
  lineAmount,
  round2,
  sumItems,
} from "./billing-math";

describe("billing-math primitives", () => {
  it("round2 fixes float drift", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-0)).toBe(0);
  });

  it("lineAmount defaults qty to 1 and tolerates strings", () => {
    expect(lineAmount({ unit_price: 500 })).toBe(500);
    expect(lineAmount({ quantity: "2", unit_price: "150" })).toBe(300);
    expect(lineAmount({ quantity: 0, unit_price: 100 })).toBe(0);
  });

  it("sumItems totals correctly", () => {
    expect(sumItems([
      { quantity: 1, unit_price: 100 },
      { quantity: 2, unit_price: 250 },
    ])).toBe(600);
  });
});

describe("computeDiscount", () => {
  it("adds flat and percent", () => {
    expect(computeDiscount(1000, 100, 10)).toBe(200);
  });
  it("caps discount at subtotal", () => {
    expect(computeDiscount(500, 1000, 0)).toBe(500);
    expect(computeDiscount(500, 0, 200)).toBe(500);
  });
  it("clamps negatives", () => {
    expect(computeDiscount(1000, -50, -5)).toBe(0);
  });
});

describe("computeTax", () => {
  it("18% GST on net amount", () => {
    expect(computeTax(1000, 0, 18)).toBe(180);
  });
  it("applies to discounted amount, not subtotal", () => {
    expect(computeTax(1000, 200, 18)).toBe(144); // 800 * 0.18
  });
  it("zero rate -> zero tax", () => {
    expect(computeTax(1000, 0, 0)).toBe(0);
  });
  it("never returns negative", () => {
    expect(computeTax(100, 500, 18)).toBe(0);
  });
});

describe("computeTotal", () => {
  it("subtotal - discount + tax", () => {
    expect(computeTotal(1000, 100, 162)).toBe(1062);
  });
  it("floors at 0", () => {
    expect(computeTotal(100, 500, 0)).toBe(0);
  });
});

describe("deriveInvoiceTotals", () => {
  it("derives a typical GST invoice end-to-end", () => {
    const t = deriveInvoiceTotals({
      subtotal: 1000,
      discount: 0,
      discount_percent: 10,
      tax_rate: 18,
      paid_amount: 0,
    });
    expect(t.subtotal).toBe(1000);
    expect(t.discountTotal).toBe(100);
    expect(t.taxAmount).toBe(162); // (1000-100)*0.18
    expect(t.total).toBe(1062);
    expect(t.balance).toBe(1062);
    expect(t.isPaid).toBe(false);
  });

  it("trusts pre-computed tax_amount when present", () => {
    const t = deriveInvoiceTotals({
      subtotal: 1000,
      tax_rate: 18,
      tax_amount: 200, // intentionally wrong vs derivation
      total: 1200,
    });
    expect(t.taxAmount).toBe(200);
    expect(t.total).toBe(1200);
  });

  it("falls back amount→subtotal and amount→total (legacy rows)", () => {
    const t = deriveInvoiceTotals({ amount: 500 });
    expect(t.subtotal).toBe(500);
    expect(t.total).toBe(500);
    expect(t.balance).toBe(500);
  });

  it("re-derives total when neither total nor amount is set", () => {
    const t = deriveInvoiceTotals({ subtotal: 200, discount: 50, tax_rate: 10 });
    // discount 50, tax = (200-50)*0.1 = 15, total = 165
    expect(t.total).toBe(165);
  });

  it("marks fully paid", () => {
    const t = deriveInvoiceTotals({ amount: 500, paid_amount: 500 });
    expect(t.balance).toBe(0);
    expect(t.isPaid).toBe(true);
  });

  it("tolerates string numerics from the DB", () => {
    const t = deriveInvoiceTotals({
      subtotal: "1500" as any,
      discount_percent: "5" as any,
      tax_rate: "18" as any,
      paid_amount: "1000" as any,
    });
    expect(t.discountTotal).toBe(75);
    expect(t.taxAmount).toBe(256.5); // (1500-75)*0.18
    expect(t.total).toBe(1681.5);
    expect(t.balance).toBe(681.5);
  });

  it("never produces NaN for blank invoices", () => {
    const t = deriveInvoiceTotals({});
    for (const v of Object.values(t)) {
      if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
    }
  });
});
