/**
 * System Email helper.
 *
 * Until a sender domain is configured, emails are queued in the
 * `outgoing_emails` table with status='pending'. Once a domain is added,
 * a backend worker (or the Lovable Emails infra) can pick these up and
 * deliver them.
 *
 * All templates render branded HTML using the clinic's name + theme colors.
 */
import { supabase } from "@/integrations/supabase/client";

export type SystemEmailTemplate =
  | "welcome"
  | "password_reset"
  | "trial_expiring"
  | "trial_expired"
  | "invoice_created"
  | "invoice_payment_received"
  | "appointment_reminder";

export interface QueueEmailParams {
  templateKey: SystemEmailTemplate;
  recipientEmail: string;
  recipientName?: string;
  clinicId?: string | null;
  templateData?: Record<string, any>;
}

const BRAND = {
  name: "DoctorsBuddy",
  primary: "#0ea5e9",
  bgAccent: "#f0f9ff",
  textBody: "#334155",
  textMuted: "#64748b",
};

function wrap(title: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${BRAND.textBody};">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);border:1px solid #e2e8f0;">
      <div style="background:${BRAND.bgAccent};padding:24px 32px;border-bottom:1px solid #e2e8f0;">
        <h1 style="margin:0;font-size:18px;font-weight:600;color:${BRAND.primary};">${BRAND.name}</h1>
      </div>
      <div style="padding:32px;">
        <h2 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#0f172a;line-height:1.3;">${title}</h2>
        <div style="font-size:15px;line-height:1.6;color:${BRAND.textBody};">${bodyHtml}</div>
        ${ctaLabel && ctaUrl ? `<div style="margin-top:28px;"><a href="${ctaUrl}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:14px;">${ctaLabel}</a></div>` : ""}
      </div>
      <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:${BRAND.textMuted};">
        Sent by ${BRAND.name} · A complete dental clinic management platform
      </div>
    </div>
  </div>
</body></html>`;
}

function templateize(template: SystemEmailTemplate, data: Record<string, any> = {}) {
  const name = data.recipient_name || data.full_name || "there";
  const clinicName = data.clinic_name || "your clinic";
  const appUrl = window.location.origin;

  switch (template) {
    case "welcome":
      return {
        subject: `Welcome to ${BRAND.name}, ${clinicName}!`,
        html: wrap(
          `Welcome aboard, ${name} 👋`,
          `<p>Thanks for signing up for <strong>${BRAND.name}</strong>! Your clinic <strong>${clinicName}</strong> is now ready.</p>
           <p>Here's what to do next:</p>
           <ul style="padding-left:20px;line-height:1.8;">
             <li>Complete your clinic profile</li>
             <li>Add your first patient</li>
             <li>Book an appointment to test the workflow</li>
             <li>Try the chair-side quick mode for faster charting</li>
           </ul>
           <p>You're on a <strong>30-day free trial</strong> — no credit card required.</p>`,
          "Open Dashboard",
          `${appUrl}/dashboard`,
        ),
      };
    case "password_reset":
      return {
        subject: `Reset your ${BRAND.name} password`,
        html: wrap(
          "Reset your password",
          `<p>Hi ${name},</p>
           <p>We received a request to reset your password. Click the button below to choose a new one. This link will expire in 1 hour.</p>
           <p style="font-size:13px;color:${BRAND.textMuted};">If you didn't request this, you can safely ignore this email.</p>`,
          "Reset Password",
          data.reset_url || `${appUrl}/reset-password`,
        ),
      };
    case "trial_expiring":
      return {
        subject: `Your trial ends in ${data.days_left || 3} days`,
        html: wrap(
          `Your trial ends in ${data.days_left || 3} days`,
          `<p>Hi ${name},</p>
           <p>Your free trial of ${BRAND.name} for <strong>${clinicName}</strong> ends in <strong>${data.days_left || 3} days</strong>.</p>
           <p>Upgrade now to keep access to all your patient records, appointments, and clinical data.</p>`,
          "Choose a Plan",
          `${appUrl}/settings?tab=subscription`,
        ),
      };
    case "trial_expired":
      return {
        subject: `Your ${BRAND.name} trial has expired`,
        html: wrap(
          "Your trial has expired",
          `<p>Hi ${name},</p>
           <p>Your free trial has ended. To continue using ${BRAND.name} for <strong>${clinicName}</strong>, please choose a subscription plan.</p>
           <p>Don't worry — your data is safe and waiting for you.</p>`,
          "Reactivate Account",
          `${appUrl}/settings?tab=subscription`,
        ),
      };
    case "invoice_created":
      return {
        subject: `Invoice ${data.invoice_number || ""} from ${clinicName}`,
        html: wrap(
          `New Invoice: ${data.invoice_number || ""}`,
          `<p>Hi ${name},</p>
           <p>A new invoice has been generated for your visit to <strong>${clinicName}</strong>.</p>
           <table style="width:100%;border-collapse:collapse;margin:20px 0;">
             <tr><td style="padding:8px 0;color:${BRAND.textMuted};">Invoice #</td><td style="padding:8px 0;text-align:right;font-weight:500;">${data.invoice_number || "-"}</td></tr>
             <tr><td style="padding:8px 0;color:${BRAND.textMuted};">Amount Due</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a;">₹ ${Number(data.total || 0).toLocaleString("en-IN")}</td></tr>
             ${data.due_date ? `<tr><td style="padding:8px 0;color:${BRAND.textMuted};">Due Date</td><td style="padding:8px 0;text-align:right;">${data.due_date}</td></tr>` : ""}
           </table>`,
        ),
      };
    case "invoice_payment_received":
      return {
        subject: `Payment received — ${data.invoice_number || ""}`,
        html: wrap(
          "Thank you for your payment!",
          `<p>Hi ${name},</p>
           <p>We've received your payment for invoice <strong>${data.invoice_number || ""}</strong>.</p>
           <p>Amount paid: <strong>₹ ${Number(data.amount || 0).toLocaleString("en-IN")}</strong></p>
           <p>Thanks for choosing <strong>${clinicName}</strong>.</p>`,
        ),
      };
    case "appointment_reminder":
      return {
        subject: `Reminder: Your appointment at ${clinicName}`,
        html: wrap(
          "Appointment reminder",
          `<p>Hi ${name},</p>
           <p>This is a friendly reminder of your upcoming appointment at <strong>${clinicName}</strong>:</p>
           <p style="font-size:18px;font-weight:600;color:${BRAND.primary};">${data.appointment_date || ""} at ${data.appointment_time || ""}</p>
           <p>Please arrive 5–10 minutes early.</p>`,
        ),
      };
    default:
      return { subject: "Notification", html: wrap("Notification", "<p>You have a new notification.</p>") };
  }
}

export async function queueSystemEmail(params: QueueEmailParams): Promise<{ ok: boolean; error?: string }> {
  try {
    const { subject, html } = templateize(params.templateKey, params.templateData || {});
    const { error } = await (supabase.from("outgoing_emails") as any).insert({
      clinic_id: params.clinicId ?? null,
      recipient_email: params.recipientEmail,
      recipient_name: params.recipientName ?? null,
      template_key: params.templateKey,
      subject,
      body_html: html,
      template_data: params.templateData ?? {},
      status: "pending",
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Unknown error" };
  }
}

export function previewSystemEmail(template: SystemEmailTemplate, data: Record<string, any> = {}) {
  return templateize(template, data);
}
