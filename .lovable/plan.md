# Production Hardening Plan — 10 Critical Issues

Goal: ship a stable, leak-proof, test-covered build before launch. Sequenced so each step unblocks the next; total effort ~4–5 days.

---

## Phase 1 — Safety Rails (Day 1, blocks launch)

### 1. Kill `DEV_BYPASS_AUTH` leak risk
- Remove the constant from `src/contexts/AuthContext.tsx`; replace with `import.meta.env.DEV && import.meta.env.VITE_ALLOW_AUTH_BYPASS === "1"`.
- Add a build-time guard in `vite.config.ts` that throws if `VITE_ALLOW_AUTH_BYPASS` is set during `vite build`.
- Same treatment for `DEMO_MODE` — gate behind `VITE_DEMO_MODE` env, default off in prod.

### 2. Concurrent-booking race
- Migration: partial unique index
  `CREATE UNIQUE INDEX appointments_no_double_book ON appointments (clinic_id, doctor_id, appointment_date, appointment_time) WHERE status NOT IN ('cancelled','no_show');`
- Surface the `23505` error in `Appointments.tsx` / `AppointmentSlotPicker.tsx` as "Slot just got taken — pick another".

### 3. 1000-row truncation sweep (round 2)
Hot pages still using bare `.select()` without `fetchAllPaged`:
- `src/pages/AuditLog.tsx`
- `src/pages/Staff.tsx`, `Leads.tsx`, `Referrals.tsx`, `Memberships.tsx`
- `src/components/dashboard/SmartInsights.tsx`, `DailyActionCenter.tsx`
- Pure count queries → switch to `.select('id', { count: 'exact', head: true })`.

---

## Phase 2 — Reliability (Day 2)

### 4. Realtime subscription leaks
- Audit every `supabase.channel(...)` for a matching `removeChannel` in cleanup.
- Suspect files: `LiveQueueWidget.tsx` (OK), `Queue.tsx`, `TodaySchedule.tsx`, `DisplayScreen.tsx`, `FocusToday.tsx`, `Dashboard.tsx`.
- Add a tiny `useRealtimeChannel(name, handlers, deps)` hook that handles cleanup uniformly; migrate widgets to it.

### 5. Edge function retry + DLQ
- New table `edge_function_failures` (function_name, payload, error, attempts, next_retry_at, status).
- Wrap `send-whatsapp-automated`, `run-automation-rules`, `generate-daily-todos` with try/catch → on failure insert into table.
- New `retry-failed-jobs` edge function + pg_cron every 10 min: pick rows where `next_retry_at <= now()` and `attempts < 5`, exponential backoff.

### 6. WhatsApp delivery receipts
- New edge function `whatsapp-delivery-webhook` (no JWT) accepting Meta/Gupshup callbacks.
- New table `whatsapp_delivery_status` (message_id, status: sent/delivered/read/failed, ts).
- Update `whatsapp_messages` table with `provider_message_id` + `delivery_status` columns; UI badge in WhatsApp page.

---

## Phase 3 — Cost & Performance (Day 3)

### 7. Image/X-ray compression pipeline
- Client-side pre-upload: use `browser-image-compression` (target 1600px max, 80% quality, WebP if supported) in `XRayVault.tsx`, `IntraOralVault.tsx`, `MediaUploader.tsx`, `clinic-logos` upload.
- Keep original toggle ("preserve original") only for diagnostic X-rays where doctor opts in.
- Add storage quota meter on Settings → Billing tab.

### 8. PDF generation offload
- Move heavy PDFs (invoice receipts, treatment plans, claim forms) to a `generate-pdf` edge function using Puppeteer or pdf-lib server-side.
- Client gets a signed URL from `patient-files` bucket.
- Keep jsPDF as fallback for tiny prescriptions (<2 pages) so offline still works.

---

## Phase 4 — Theme Regressions (Day 3, parallel)

### 9. Theme audit
Sweep for hardcoded colors and replace with semantic tokens:
- Charts: `ClinicOverviewCharts.tsx`, `FinancialSummary.tsx`, `SocialAnalyticsDashboard.tsx` — use `hsl(var(--primary))` etc. instead of literals.
- Badges: grep `bg-(green|red|yellow|blue|purple)-` and migrate to `bg-success/bg-warning/bg-destructive`.
- `src/pages/Auth.tsx` — confirm dark-mode contrast.
- Focus Mode (`FocusLayout.tsx`, `FocusToday.tsx`, `FocusPatient.tsx`) — remove inline whites/blacks.
- PDF receipts (`InvoiceReceipt.tsx`, `VisitSummaryPDF.tsx`, `PrescriptionDownload.tsx`) — read clinic primary color from settings, fall back to `#5BADE6`.

---

## Phase 5 — Test Coverage (Day 4–5)

### 10. Automated tests
Target the highest-blast-radius logic first:
- **Billing math** (`src/lib/billing-math.ts` extracted from `Billing.tsx`): subtotal, tax, discount, EMI splits, partial-payment ledger.
- **Unbilled-treatment filter** (the recent fix).
- **`fetchAllPaged`**: pagination boundary, max-rows cap.
- **Automation rules** (Deno tests): post_treatment, birthday, follow-up triggers with mocked Supabase client.
- **Edge functions**: `generate-daily-todos`, `run-automation-rules` happy-path + failure-path → asserts row in `edge_function_failures`.
- **RLS smoke tests**: a Deno script that signs in as clinic-A user and asserts zero rows visible from clinic-B (run nightly).

Target: 60% coverage on `src/lib/**` and 100% on billing + RLS smoke.

---

## Technical Details

### Files created
- `src/hooks/useRealtimeChannel.ts`
- `src/lib/billing-math.ts` (extracted)
- `src/lib/image-compression.ts`
- `supabase/functions/retry-failed-jobs/index.ts`
- `supabase/functions/whatsapp-delivery-webhook/index.ts`
- `supabase/functions/generate-pdf/index.ts`
- `src/lib/__tests__/*.test.ts` (billing-math, supabase-paged)
- `supabase/functions/*/index.test.ts` (Deno)

### Migrations
1. Unique appointment slot index.
2. `edge_function_failures` table + RLS.
3. `whatsapp_delivery_status` table + columns on `whatsapp_messages`.
4. pg_cron schedule for `retry-failed-jobs` every 10 min.

### Env vars
- `VITE_ALLOW_AUTH_BYPASS` (dev only, throws at build if set)
- `VITE_DEMO_MODE` (default off)
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (secret)

---

## Sequencing & Risk

```text
Day 1: Phase 1 (auth guard, slot index, paged sweep)   ← prevents catastrophe
Day 2: Phase 2 (realtime, retries, delivery receipts)  ← prevents silent failure
Day 3: Phase 3 + 4 in parallel (perf + theme)          ← prevents user pain
Day 4-5: Phase 5 (tests)                               ← prevents regression
```

Out of scope (deferred): Sentry SDK (use existing `error_logs` table for now), backend rate limiting (per platform policy).

Reply **approve** to start Phase 1, or tell me which phase to prioritize / skip.
