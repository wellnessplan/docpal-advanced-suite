
# DoctorsBuddy — Launch Readiness for Dental Friends

The product is feature-complete on the clinical side. What separates "demo" from "real clinic in production" is a short list of go-live items grouped below. Most are configuration, not new features.

---

## 1. Must-do before first real patient (Blockers)

| # | Item | Why it matters |
|---|------|----------------|
| 1 | **Disable `DEV_BYPASS_AUTH`** and verify every page enforces real login | Today dev shortcut lets anyone in. Production cannot ship with this on. |
| 2 | **RLS audit pass** on all 90+ tables | Confirm every table is `clinic_id`-scoped and policies tested with 2 clinics side-by-side. |
| 3 | **Onboarding self-sign-up flow** — Google + Email/password, then `create_clinic_for_user` RPC | Friends need to register themselves without you provisioning manually. |
| 4 | **Payment / subscription activation** (Razorpay or Stripe India) | Trial → paid conversion. Plans catalog exists; charging does not. |
| 5 | **Backups + restore drill** on Lovable Cloud + storage bucket | Patient data = legal liability. One restore test before launch. |
| 6 | **Privacy Policy + ToS** pages with real clinic-data language (DPDP Act 2023 India) | Required to take patient PII. Pages exist but need legal-reviewed copy. |
| 7 | **WhatsApp Business API credentials** per clinic (or shared Twilio/Meta number) | All automation depends on this. Today it logs but won't actually send without keys. |

---

## 2. Polish before friends use it (High value, low effort)

- **First-run wizard** — clinic name → working hours → 1 doctor → 1 treatment → "you're ready" (most fields already exist in Onboarding, just stitch the order).
- **Sample data toggle** — one click to load 10 demo patients/appointments so they can explore; one click to wipe.
- **In-app help tooltips** on Dental Chart, Treatment Plan, Billing (the 3 screens dentists fear).
- **Error boundary + Sentry** wired to a real DSN (file exists, key missing).
- **Mobile PWA install prompt** verified on Android Chrome + iOS Safari.
- **Email delivery** — set up custom domain in Lovable Email so OTP/invoices don't land in spam.

---

## 3. Commercial readiness

- **Pricing page** publicly visible (Basic / Pro / Multi-branch) with feature matrix.
- **Trial logic enforcement** — `clinic_subscriptions.trial_ends_at` actually gates write access after expiry (today it's display-only).
- **Invoice for the SaaS itself** — clinics need a GST invoice from you. `platform_invoices` table exists; PDF generation not wired.
- **Support channel** — a simple WhatsApp/email link in the top bar plus a `/support` page.
- **Onboarding video** (2-min Loom) embedded in dashboard for new clinics.

---

## 4. Nice-to-have (post-launch v1.1)

- Two-factor auth for doctor accounts.
- Native Android/iOS shells (PWA → Capacitor wrap).
- Bulk patient import from Excel (component exists, wire to UI).
- Practo / Google review auto-import.
- DICOM viewer for full intra-oral X-ray sets.

---

## 5. Suggested 7-day sprint to launch

```text
Day 1   Disable DEV_BYPASS, RLS audit with 2 test clinics
Day 2   Self-sign-up + first-run wizard + sample data toggle
Day 3   Razorpay subscription charge + trial gating
Day 4   WhatsApp credentials flow + custom email domain
Day 5   Privacy/ToS legal copy + Sentry + backup drill
Day 6   Pricing page + support link + onboarding video embed
Day 7   Closed beta — invite 3 dental friends, watch session replays
```

---

## What I recommend we tackle first

If you approve, I'll start with **Day 1 + Day 2** in one batch: turn off the dev auth bypass, run an RLS audit script that flags any table missing `clinic_id` policy, build the self-sign-up + first-run wizard, and add the sample-data toggle. That gives you something a friend can actually sign up to by tomorrow.

Tell me **"go day 1-2"** to start, or pick a different item from the list.
