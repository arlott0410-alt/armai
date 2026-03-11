# ArmAI Enterprise UX & Schema Additions

This document describes the additive enterprise SaaS upgrades to the ArmAI repository: UI/UX, billing data model, and API extensions. Core flows (auth, tenant isolation, support read-only, webhooks, slip/bank matching) are unchanged.

## Super Admin Operating Console

### Navigation (IA)
- **Overview** — Command center dashboard
- **Merchants** — Expanded merchant table and add merchant
- **Billing** — Billing events across merchants
- **Support** — Read-only support mode (unchanged)
- **Audit** — Activity log for super admin actions

### Overview Dashboard
- **KPI cards:** MRR this month, Active merchants, Trialing, Past due, Due in 7 days, New this month, Activation ready
- **Revenue:** Current month MRR, Expected next billing
- **Billing health:** Overdue, Due soon, Trial ending soon (with links to merchant detail)
- **Setup health:** Merchants with missing products, no payment account, or no AI prompt
- **Recent activity:** Merchant created, support access, audit entries

### Merchants Table (expanded)
Columns: Name (link to detail), Slug, Admin email, Plan code, Monthly fee, Billing status, Next billing date, Setup %, Product count, Payment account count, Quick actions (View, Support).

### Merchant Detail View
- Summary card (slug, status, product count, payment account count)
- Billing card (plan, monthly fee, next billing, last paid)
- Internal notes (add + list)
- Recent billing events
- Support access history
- Action: Open support (read-only)

### New/Extended APIs (Super)
- `GET /api/super/dashboard` — Returns KPIs, revenue, billingHealth, setupHealth, recentActivity (backward compatible: mrr, merchantCount, activeMerchants, systemHealth)
- `GET /api/super/merchants` — Returns expanded list (admin_email, plan_code, monthly_price_usd, next_billing_at, setup_percent, product_count, payment_account_count, etc.)
- `GET /api/super/merchants/:id` — Merchant detail (merchant, plan, settings, notes, billingEvents, orderSummary, productCount, paymentAccountCount, supportAccessHistory)
- `PATCH /api/super/merchants/:id` — Update billing_status (merchants + merchant_plans) and/or plan fields (via updateMerchantPlanBodySchema)
- `GET /api/super/merchants/:id/billing` — List billing events for merchant
- `POST /api/super/merchants/:id/billing` — Create billing event
- `GET /api/super/merchants/:id/notes` — List internal notes
- `POST /api/super/merchants/:id/notes` — Add internal note
- `GET /api/super/billing/events?merchantId=` — List billing events (all or by merchant)
- `GET /api/super/audit?limit=` — List audit logs

## Billing / Subscription Data Model

### merchant_plans (extended)
New columns (additive): `monthly_price_usd`, `currency`, `billing_cycle`, `started_at`, `trial_ends_at`, `current_period_start`, `next_billing_at`, `last_paid_at`, `grace_until`, `cancel_at_period_end`, `is_auto_renew`, `notes`.

### merchant_billing_events (new)
- `id`, `merchant_id`, `event_type`, `amount`, `currency`, `invoice_period_start`, `invoice_period_end`, `due_at`, `paid_at`, `status`, `reference_note`, `created_at`, `updated_at`
- Indexes and RLS: super or member (read); write super only.

### merchant_internal_notes (new)
- `id`, `merchant_id`, `actor_id`, `note`, `created_at`
- RLS: super only (read/write). Not visible to merchant.

### SQL migrations
- `sql/019_billing_expansion.sql` — Extend merchant_plans; create merchant_billing_events, merchant_internal_notes
- `sql/020_billing_indexes.sql` — Indexes for billing and notes
- `sql/021_billing_rls.sql` — RLS for new tables
- `sql/022_billing_policies.sql` — merchant_plans insert policy for super

## Merchant Operating Workspace

### Navigation (unchanged)
Overview, Orders, Bank Sync, Products, Categories, Knowledge, Promotions, Payment Accounts, Settings.

### Merchant Dashboard
- **Summary widgets:** Orders today, Pending payment, Paid today, Manual review count, Probable match count, Active products count, Active payment accounts count
- **Setup readiness panel:** Checklist (products, categories, payment account, primary payment, AI prompt, FAQ/knowledge, bank parser, connected page) with status: not started / in progress / ready and “Set up” links to the right page

### New/Extended APIs (Merchant)
- `GET /api/merchant/dashboard` — Returns merchantId, settings, **summary** (MerchantDashboardSummary), **readiness** (ReadinessItem[])
- `GET /api/merchant/readiness` — Returns readiness checklist only

## Design System (apps/web)

Reusable UI under `apps/web/src/components/ui/`:
- **Card**, **CardHeader**, **CardBody** — Container and sections
- **StatCard** — KPI label + value + optional sub
- **Badge** — Variants: default, success, warning, danger, info
- **Section**, **SectionHeader** — Page section with title, description, action
- **EmptyState** — Title, description, optional action
- **PageShell** — Page title, description, breadcrumb, actions, children

Style: neutral, enterprise SaaS; no consumer-app styling.

## Preserved Behavior

- Auth flow and tenant isolation unchanged
- Support read-only flow unchanged (support start + view merchant data)
- Order/slip/bank matching flow unchanged
- RLS and multi-tenant model unchanged
- Webhook routes and deployment model unchanged
- Creating a new merchant still: creates auth user, merchant row, merchant_members, merchant_settings; now also creates **merchant_plans** (starter, trialing, trial_ends_at and next_billing_at = now + 14 days)

## Running migrations

Apply in order: 019 → 020 → 021 → 022 (after existing migrations 001–018).
