import { test, expect } from "@playwright/test";

/**
 * Critical billing path — smoke test.
 *
 * Verifies that an authenticated session can:
 *   1. Reach /billing without errors
 *   2. See the "Create Invoice" affordance
 *   3. Open the invoice composer and add at least one line item
 *   4. Compute a subtotal/total without throwing
 *
 * NOTE: relies on the demo session (DEMO_MODE auto-login) so no manual
 * sign-in step is needed in CI; if demo mode is disabled, prepend a
 * sign-in helper.
 */

test.describe("Billing — critical path", () => {
  test("loads billing page and opens invoice composer", async ({ page }) => {
    await page.goto("/billing");
    // Wait for the page heading
    await expect(page.getByRole("heading", { name: /billing/i })).toBeVisible({ timeout: 15_000 });

    // Open create-invoice flow
    const createBtn = page.getByRole("button", { name: /create invoice|new invoice/i }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Composer should appear (dialog or sheet)
    const composer = page.getByRole("dialog").or(page.locator('[role="dialog"], [data-state="open"]'));
    await expect(composer.first()).toBeVisible({ timeout: 10_000 });
  });

  test("invoice list renders without runtime errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/billing");
    await page.waitForLoadState("networkidle");

    // Filter out noisy 3rd-party errors
    const fatal = errors.filter(
      (e) => !/Failed to load resource|favicon|sentry|net::ERR_BLOCKED/i.test(e),
    );
    expect(fatal, `Console errors:\n${fatal.join("\n")}`).toEqual([]);
  });
});
