-- Indexes for billing and notes (query by merchant, date, status).

create index if not exists idx_merchant_billing_events_merchant_created
  on public.merchant_billing_events (merchant_id, created_at desc);

create index if not exists idx_merchant_billing_events_merchant_status
  on public.merchant_billing_events (merchant_id, status);

create index if not exists idx_merchant_billing_events_due_at
  on public.merchant_billing_events (due_at) where due_at is not null;

create index if not exists idx_merchant_internal_notes_merchant_created
  on public.merchant_internal_notes (merchant_id, created_at desc);

create index if not exists idx_merchant_plans_next_billing
  on public.merchant_plans (next_billing_at) where next_billing_at is not null;

create index if not exists idx_merchant_plans_billing_status
  on public.merchant_plans (billing_status);
