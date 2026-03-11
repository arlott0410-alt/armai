-- ArmAI Enterprise: Billing and internal notes schema (additive only).
-- Extends merchant_plans; adds merchant_billing_events and merchant_internal_notes.

-- ---------- Extend merchant_plans ----------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_plans' and column_name = 'monthly_price_usd') then
    alter table public.merchant_plans add column monthly_price_usd numeric(12, 2) default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_plans' and column_name = 'currency') then
    alter table public.merchant_plans add column currency text default 'THB';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_plans' and column_name = 'billing_cycle') then
    alter table public.merchant_plans add column billing_cycle text default 'monthly';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_plans' and column_name = 'started_at') then
    alter table public.merchant_plans add column started_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_plans' and column_name = 'trial_ends_at') then
    alter table public.merchant_plans add column trial_ends_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_plans' and column_name = 'current_period_start') then
    alter table public.merchant_plans add column current_period_start timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_plans' and column_name = 'next_billing_at') then
    alter table public.merchant_plans add column next_billing_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_plans' and column_name = 'last_paid_at') then
    alter table public.merchant_plans add column last_paid_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_plans' and column_name = 'grace_until') then
    alter table public.merchant_plans add column grace_until timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_plans' and column_name = 'cancel_at_period_end') then
    alter table public.merchant_plans add column cancel_at_period_end boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_plans' and column_name = 'is_auto_renew') then
    alter table public.merchant_plans add column is_auto_renew boolean default true;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_plans' and column_name = 'notes') then
    alter table public.merchant_plans add column notes text;
  end if;
end $$;

comment on table public.merchant_plans is 'Subscription/billing plan per merchant. Extended for enterprise SaaS.';

-- ---------- merchant_billing_events ----------
create table if not exists public.merchant_billing_events (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  event_type text not null,
  amount numeric(14, 2) not null default 0,
  currency text not null default 'THB',
  invoice_period_start timestamptz,
  invoice_period_end timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  status text not null default 'pending',
  reference_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.merchant_billing_events is 'Invoices and billing events per merchant.';

-- ---------- merchant_internal_notes ----------
create table if not exists public.merchant_internal_notes (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

comment on table public.merchant_internal_notes is 'Internal notes for super admin (not visible to merchant).';
