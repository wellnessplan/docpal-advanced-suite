# Multi-Branch + Insurance/TPA + Auto-PO — Phased Plan

You picked the heaviest scope in every category. Shipping all of it in one go would mean a 3-4 week patch with high regression risk on existing clinics. I'm proposing **3 phases**, each independently shippable and testable.

---

## Phase 1 — Multi-Branch (Full Shared Catalog)  *~Week 1*

This is the riskiest piece because it touches RLS on **every table**. Doing it first unblocks the other two (auto-PO needs to know "which branch", claims need to know "which branch billed").

### Schema changes
- New table `clinic_groups` (id, owner_user_id, name, subscription_id) — one group per owner.
- Add `group_id uuid` to `clinics` (nullable; backfill = self-group for existing single-clinic owners).
- Add `group_id uuid` to: `patients`, `treatment_catalog`, `staff/profiles`, `inventory_items`, `lab_directory`, `suppliers`.
  - Patient/catalog/staff/inventory become **group-scoped** (visible across all branches in the group).
  - Appointments, invoices, treatments, queue tokens, audit_log stay **clinic-scoped** (per-branch).
- New SECURITY DEFINER function `get_user_group_id()` mirroring `get_user_clinic_id()`.
- Move `clinic_subscriptions` → `group_subscriptions` (one sub covers all branches).

### RLS rewrite (per-table)
Two patterns:
- Group-scoped tables: `using (group_id = get_user_group_id())`
- Branch-scoped tables: keep `clinic_id = get_user_clinic_id()` BUT also allow if `clinic_id IN (select id from clinics where group_id = get_user_group_id())` for owner role.

### UI changes
- **Branch switcher** in header (next to user menu) — sets active `clinic_id` in `AuthContext`, persists to localStorage.
- **Branches settings tab** (Settings → Branches) — add/rename/archive branches. Owner-only.
- **Cross-branch dashboard toggle** ("This branch" / "All branches") on Dashboard, Revenue, Reports, Patients.
- Patient profile shows `Visited at: Branch A, Branch B` chips.

### Migration safety
- Backfill script: every existing clinic becomes its own group (`group_id = clinic.id`), zero behaviour change for current users.
- Existing RLS continues working because `get_user_clinic_id()` still returns the active branch.

---

## Phase 2 — Insurance/TPA Workflow + PDF + Email Submit  *~Week 2*

### Schema
- New table `insurance_claims`:
  - `clinic_id`, `patient_id`, `tpa_id`, `policy_number`, `claim_amount`, `pre_auth_required`, `pre_auth_status`, `pre_auth_amount`, `status` (draft / pre_auth_pending / pre_auth_approved / submitted / under_review / approved / partially_approved / rejected / paid / appealed), `submitted_at`, `approved_amount`, `paid_amount`, `rejection_reason`, `notes`.
- New table `insurance_claim_documents` (claim_id, file_url, doc_type, uploaded_at).
- New table `insurance_claim_history` (claim_id, action, actor_user_id, from_status, to_status, note, created_at) — audit trail.
- New table `tpa_providers` (clinic_id/group_id, name, email, phone, contact_person, claim_form_template, payment_terms_days).

### UI — `/insurance`
- **Claims pipeline board** (Kanban: Draft → Pre-Auth → Submitted → Under Review → Approved → Paid + Rejected lane).
- **Claim detail drawer**:
  - Patient info (auto-pulled), linked treatments + invoice (pulls cost), TPA dropdown, policy info.
  - Document attachments (X-rays, treatment notes, consent forms, prescription).
  - Status timeline.
  - Actions: "Generate Claim PDF", "Submit to TPA", "Mark Approved/Rejected", "Record Payment".
- **TPA Directory tab** in Settings — manage TPA list, claim form templates, payment terms.
- **Reports tab**: aging report, approval rate by TPA, average days-to-payment.

### Generated PDF claim form (jsPDF)
- A4: clinic header + logo, patient block, treatment + costs table, TPA block, declarations, doctor signature line.
- Configurable per-TPA template (uses `tpa_providers.claim_form_template`).

### Email submission
- New edge function `submit-insurance-claim` — generates PDF, attaches all documents, sends via Lovable Email to `tpa.email`, logs to `insurance_claim_history`, updates status → `submitted`.
- Requires email infrastructure (will check + scaffold if not set up).

---

## Phase 3 — Inventory Auto-PO  *~Week 3*

### Schema
- New table `purchase_orders`:
  - `clinic_id`, `supplier_id`, `po_number` (auto via sequence), `status` (draft / sent / partially_received / received / cancelled), `total_amount`, `created_by`, `sent_at`, `received_at`, `auto_generated` (bool), `notes`.
- New table `purchase_order_items` (po_id, inventory_item_id, quantity, unit_cost, line_total).
- New table `suppliers` (or extend existing — name, email, phone, whatsapp_number, address, payment_terms, lead_time_days).
- Add `preferred_supplier_id`, `reorder_quantity` to `inventory_items`.

### Logic — both modes
- **Mode A (default): Draft PO + notify**
  - Cron creates draft POs grouped by supplier, posts a Task ("3 POs awaiting review") to owner.
  - Owner reviews on `/purchase-orders`, edits qty/cost, clicks "Send" → WhatsApp/email to supplier.
- **Mode B (per-supplier setting): Auto-send**
  - Supplier has `auto_send_enabled = true` → cron creates PO and immediately sends, logs to audit. Owner can still cancel within X hours.

### Trigger — both
- **Daily cron at 7:00 AM IST** (catches everything overnight) — primary mechanism.
- **Real-time on deduction** — only fires if item crosses threshold AND no draft PO exists for that item in last 24h (prevents duplicates). Useful for fast-moving consumables.
- **Manual button** "Generate POs from low stock" on Inventory page — for on-demand.

### UI — `/purchase-orders`
- Table view with status filter, supplier filter.
- PO detail drawer: line items (editable in draft), cost calculation, "Send via WhatsApp" / "Send via Email" / "Mark Received" actions.
- Receive flow: tick items received, qty received, auto-restocks inventory + creates `inventory_transactions` rows.
- Suppliers tab in Settings.

### Edge functions
- `auto-generate-purchase-orders` (cron) — scans low-stock items across all clinics, groups by supplier, creates draft POs, sends if auto-mode enabled.
- `send-purchase-order` — invoked when owner clicks Send; posts to WhatsApp API + email.

---

## Recommendation

**Ship Phase 1 first, validate, then Phase 2, then Phase 3.** Each phase is ~5-7 days of work with proper testing.

If you want to compress: I can skip the "All branches" cross-aggregation view in Phase 1 (just ship branch switcher + shared catalog) — saves ~2 days but you lose the consolidated revenue view until later.

### Technical notes
- All new tables get RLS scoped to either `group_id` or `clinic_id` per the rules above.
- Invoice numbers, PO numbers, claim numbers all use per-clinic sequences (already pattern in `generate_op_number`).
- Realtime channels for PO board and Claims board so multi-user clinics stay in sync.
- All edge functions get retry/DLQ via the same pattern as `send-whatsapp-automated`.

---

**Question before I start:** Confirm "ship Phase 1 first" or tell me to do all three in one giant push (will take longer and be harder to debug). Also confirm: should branch switching be **owner-only**, or should branch staff also be able to switch (e.g. a hygienist who works across 2 branches)?
