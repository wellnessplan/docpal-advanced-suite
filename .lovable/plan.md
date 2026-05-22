
# Super Admin Console — unified control plane

Today there are **two overlapping pages** (`/platform` and `/super-admin`) and no place to manage subscription **plans** as a catalog or to monitor **AI/API usage**. This plan merges them into one console at `/platform` with four clear tabs.

---

## Tabs & responsibilities

```text
/platform  (super_admin only — gated by is_super_admin())
├── 1. Overview      KPIs + alerts (MRR, trials ending, AI spend, failed jobs)
├── 2. Centers       All clinics + branches: approve, suspend, switch plan, impersonate
├── 3. Plans         Plan catalog (CRUD) + active subscriptions + change requests
└── 4. AI & API      Lovable AI usage, gateway health, secrets, integrations DLQ
```

Existing `/super-admin` route is deprecated and redirects to `/platform?tab=centers`.

---

## Tab 1 — Overview

Top strip of 6 KPI cards (clickable → deep-link into the right tab with filter applied):

- **Total clinics** (active / trial / suspended split)
- **MRR** (sum of `clinic_subscriptions.amount` where status=active) + MoM delta
- **Trials ending ≤7 days** → Centers tab filtered
- **Plan-change requests pending** → Plans tab
- **AI spend this month** (₹ + token count) → AI tab
- **Failed jobs / DLQ depth** (WhatsApp + automation) → AI tab

Below: 2 charts already in `Platform.tsx` (clinic growth, status mix) + new **"AI requests / day"** line chart.

---

## Tab 2 — Centers

Replaces today's clinic table in both pages. One table, more columns and actions:

Columns: Clinic · Group/Branches count · Owner · Plan · Status · Patients · Staff · MRR · Trial ends · Last active

Per-row actions (dropdown):
- **Approve** (pending_approval → active)
- **Suspend / Reactivate** (writes `clinic_subscriptions.status`)
- **Change plan** (opens dialog → picks from Plans catalog → updates subscription + logs to `platform_audit_log`)
- **Extend trial** (+7/+14/+30 days)
- **View branches** (expand row showing `clinics` rows sharing `group_id`)
- **Impersonate** (super-admin only — sets a session flag, shows red banner; logged)
- **Delete clinic** (soft delete + GDPR cascade — uses existing `gdpr_delete_patient` pattern at clinic scope)

Filters: status, plan, region (from address), search by name/phone/email/owner.

---

## Tab 3 — Plans

Two sections:

**A. Plan catalog (CRUD)** — currently hardcoded in `SubscriptionPlanTab.tsx`. Move to a new table `subscription_plans (id, code, name, price_inr, billing_cycle, features jsonb, max_patients, max_doctors, max_branches, is_active, sort_order)` so super admin edits without code deploys.

**B. Active subscriptions** — list of `clinic_subscriptions` joined with clinic + plan. Inline edit price / cycle / status. Bulk action: "Send renewal reminder."

**C. Change requests** — reads `audit_log` rows with `action='plan_change_requested'` (current flow already writes these from `SubscriptionPlanTab`). Approve/reject buttons that flip subscription + close the request.

---

## Tab 4 — AI & API

Three panels:

**A. Lovable AI usage**
- New table `ai_usage_log (clinic_id, function_name, model, prompt_tokens, completion_tokens, cost_inr, status, created_at)` written from every edge function that calls the gateway (`run-automation-rules`, `generate-daily-todos`, future ones).
- Charts: requests/day, tokens/day, top clinics by spend, model mix.
- Per-clinic monthly cap (column on `clinic_subscriptions.ai_monthly_cap_inr`). When exceeded → edge functions return a friendly error.

**B. Gateway & secrets**
- Status badge for `LOVABLE_API_KEY` (calls a tiny edge function `ai-ping` that does a 1-token completion).
- Read-only list of project secrets (names only, never values) — surfaces what `fetch_secrets` shows.
- Button: **Rotate Lovable API key** (calls `lovable_api_key--rotate` via an admin-only edge function).

**C. Integrations & DLQ**
- Counts from `whatsapp_logs` grouped by `delivery_status` (queued/sent/failed) for last 7 days.
- DLQ depth from `_shared/dlq.ts` table.
- Per-clinic webhook health (last delivery, last error) from `webhooks` table.
- "Retry failed jobs" button → invokes existing `retry-failed-jobs` edge function.

---

## Security model

- **All tabs gated** by `is_super_admin()` RPC (already exists). Non-super-admins get `<Navigate to="/dashboard" />`.
- **Every mutating action writes to `platform_audit_log`** (already exists, expand `action` enum).
- **Impersonation** uses a signed JWT claim `impersonated_clinic_id`; RLS policies remain unchanged because we never bypass auth — just switch the active clinic in the profile temporarily and record both `actor_user_id` and `impersonated_clinic_id`.

---

## Database changes (one migration)

```text
1. CREATE TABLE subscription_plans (...)              -- replaces hardcoded PLANS
2. ALTER TABLE clinic_subscriptions
     ADD COLUMN plan_id uuid REFERENCES subscription_plans(id),
     ADD COLUMN ai_monthly_cap_inr numeric DEFAULT 500;
3. CREATE TABLE ai_usage_log (...)                    -- + clinic_id index
4. Extend platform_audit_log.action enum:
     plan_changed, plan_request_approved, plan_request_rejected,
     trial_extended, impersonation_started, impersonation_ended,
     ai_cap_changed, api_key_rotated
5. RLS: all new tables — super_admin full access, clinic users see only their own ai_usage_log rows
6. Seed subscription_plans with current Basic/Pro/Enterprise values
```

---

## File plan

```text
NEW:
  src/pages/platform/Overview.tsx
  src/pages/platform/CentersTab.tsx        (merges /platform + /super-admin tables)
  src/pages/platform/PlansTab.tsx
  src/pages/platform/AiApiTab.tsx
  src/hooks/usePlatformStats.ts
  supabase/functions/ai-ping/index.ts      (gateway health check)
  supabase/functions/_shared/ai-usage.ts   (helper every AI edge fn imports to log usage)

EDIT:
  src/pages/Platform.tsx                   → becomes a thin shell hosting the 4 tabs
  src/App.tsx                              → /super-admin redirects to /platform
  src/components/settings/SubscriptionPlanTab.tsx
                                            → reads plans from new table instead of hardcoded
  supabase/functions/run-automation-rules/index.ts
  supabase/functions/generate-daily-todos/index.ts
                                            → call logAiUsage() after each gateway request

DELETE (after redirect verified):
  src/pages/SuperAdmin.tsx
```

---

## Phasing

- **Phase 1 (1 day)** — Migration + Overview + Centers tab (port existing tables, add impersonation & extend-trial).
- **Phase 2 (1 day)** — Plans tab + move hardcoded plans into DB + change-request approval flow.
- **Phase 3 (1 day)** — AI & API tab: usage logging, charts, cap enforcement, DLQ panel.

Total: **~3 focused days**. No Razorpay coupling — payment automation stays a separate workstream.

---

## Out of scope (explicitly)

- Razorpay auto-charge for SaaS subscriptions (separate plan; this console will *display* and *manage* subscription state but not process cards yet).
- Patient-facing invoice payments.
- Per-branch RBAC (still group-wide today).

Approve this and I'll start with Phase 1.
