// Payment webhook — Razorpay & Stripe
// Set webhook URL: https://<project>.functions.supabase.co/payment-webhook?provider=razorpay
// Required secrets: RAZORPAY_WEBHOOK_SECRET (HMAC SHA256), STRIPE_WEBHOOK_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function verifyRazorpay(body: string, sig: string | null) {
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret || !sig) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return expected === sig;
}

function verifyStripeWebhook(body: string, sigHeader: string | null) {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret || !sigHeader) return false;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((part) => {
      const [key, value] = part.split("=", 2);
      return [key, value];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return expected === signature;
}

async function extendSubscription(clinicId: string, cycle: "monthly" | "yearly") {
  const next = new Date();
  next.setMonth(next.getMonth() + (cycle === "yearly" ? 12 : 1));
  await supabase
    .from("clinic_subscriptions")
    .update({
      status: "active",
      approved_at: new Date().toISOString(),
      next_billing_date: next.toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("clinic_id", clinicId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") || "razorpay";
    const body = await req.text();

    if (provider === "razorpay") {
      const sig = req.headers.get("x-razorpay-signature");
      if (!verifyRazorpay(body, sig)) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
      }
      const evt = JSON.parse(body);
      const payment = evt?.payload?.payment?.entity;
      if (evt.event === "payment.captured" && payment) {
        const clinicId = payment.notes?.clinic_id;
        const cycle = (payment.notes?.billing_cycle as "monthly" | "yearly") || "monthly";
        const invoiceId = payment.notes?.invoice_id;
        if (invoiceId) {
          await supabase.from("platform_invoices").update({
            status: "paid",
            paid_at: new Date().toISOString(),
            provider: "razorpay",
            provider_payment_id: payment.id,
            provider_order_id: payment.order_id,
            amount_inr: payment.amount / 100,
            updated_at: new Date().toISOString(),
          }).eq("id", invoiceId);
        } else if (clinicId) {
          await supabase.from("platform_invoices").insert({
            clinic_id: clinicId,
            amount_inr: payment.amount / 100,
            status: "paid",
            paid_at: new Date().toISOString(),
            provider: "razorpay",
            provider_payment_id: payment.id,
            provider_order_id: payment.order_id,
            billing_cycle: cycle,
            metadata: payment.notes || {},
          });
        }
        if (clinicId) await extendSubscription(clinicId, cycle);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    if (provider === "stripe") {
      const sig = req.headers.get("stripe-signature");
      if (!verifyStripeWebhook(body, sig)) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
      }
      const evt = JSON.parse(body);
      if (evt.type === "checkout.session.completed" || evt.type === "invoice.payment_succeeded") {
        const obj = evt.data?.object;
        const clinicId = obj?.metadata?.clinic_id;
        const cycle = (obj?.metadata?.billing_cycle as "monthly" | "yearly") || "monthly";
        if (clinicId) {
          await supabase.from("platform_invoices").insert({
            clinic_id: clinicId,
            amount_inr: (obj.amount_total || obj.amount_paid || 0) / 100,
            status: "paid",
            paid_at: new Date().toISOString(),
            provider: "stripe",
            provider_payment_id: obj.id,
            billing_cycle: cycle,
            receipt_url: obj.hosted_invoice_url || obj.receipt_url || null,
          });
          await extendSubscription(clinicId, cycle);
        }
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown provider" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("payment-webhook error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
