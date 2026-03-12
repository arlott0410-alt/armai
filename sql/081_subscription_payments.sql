-- ArmAI Enterprise: Payment gateway transactions for subscriptions (BCEL OnePay, Stripe).
-- Links to merchant_plans and merchant_billing_events for audit and reconciliation.

create table if not exists public.subscription_payments (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  billing_event_id uuid references public.merchant_billing_events (id) on delete set null,
  provider text not null, -- 'bcel_onepay' | 'stripe'
  external_id text, -- gateway transaction/session id
  amount numeric(14, 2) not null,
  currency text not null default 'USD',
  status text not null default 'pending', -- pending | succeeded | failed | refunded
  payment_method text, -- card | qr | alipay | wechat | etc.
  customer_email text,
  customer_phone text,
  billing_address jsonb, -- { name, address_line1, city, country, postal_code } for Laos
  metadata jsonb, -- provider-specific payload
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscription_payments is 'Payment gateway records for subscription billing (BCEL OnePay, Stripe).';

create index if not exists idx_subscription_payments_merchant
  on public.subscription_payments (merchant_id);
create index if not exists idx_subscription_payments_provider_external
  on public.subscription_payments (provider, external_id) where external_id is not null;
create index if not exists idx_subscription_payments_status
  on public.subscription_payments (status);
create index if not exists idx_subscription_payments_created
  on public.subscription_payments (created_at desc);

alter table public.subscription_payments enable row level security;

-- Super: full access. Merchant: read own only. Insert/update only via service role (no policy = denied for anon).
create policy "subscription_payments_select_member_or_super" on public.subscription_payments for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "subscription_payments_update_super_or_member" on public.subscription_payments for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
