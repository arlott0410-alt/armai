-- ArmAI: Merchant-scoped unified customer profile.
-- One per real-world customer per merchant; links multiple channel identities.

create table if not exists public.merchant_customers (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  primary_display_name text,
  phone_number text,
  normalized_phone text,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.merchant_customers is 'Unified customer profile per merchant. One customer may have multiple channel identities.';
comment on column public.merchant_customers.normalized_phone is 'Canonical form for matching; e.g. digits only.';

create index if not exists idx_merchant_customers_merchant on public.merchant_customers (merchant_id);
create index if not exists idx_merchant_customers_merchant_status on public.merchant_customers (merchant_id, status);
create index if not exists idx_merchant_customers_normalized_phone on public.merchant_customers (merchant_id, normalized_phone) where normalized_phone is not null;
