-- ArmAI Enterprise: Admin-configurable subscription plans (LAK only).
-- Superadmin CRUD via /api/super/plans; public list via /api/plans.

create table if not exists public.subscription_plans (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null unique,
  price_lak bigint not null check (price_lak >= 0),
  features jsonb not null default '[]',
  max_users int,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscription_plans is 'Subscription plans (LAK). Managed by superadmin.';

create index if not exists idx_subscription_plans_active on public.subscription_plans (active) where active = true;
create index if not exists idx_subscription_plans_sort on public.subscription_plans (sort_order);

alter table public.subscription_plans enable row level security;

-- Public can read active plans only (API uses service role for /api/plans).
create policy "subscription_plans_select_active" on public.subscription_plans for select
  using (active = true);
-- Only super_admin can insert/update/delete (enforced in API; service role for writes).
create policy "subscription_plans_all_super" on public.subscription_plans for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Seed default plans (LAK): Basic 1,072,000 | Pro 6,432,000
insert into public.subscription_plans (name, code, price_lak, features, max_users, sort_order)
values
  (
    'Basic',
    'basic',
    1072000,
    '["Core AI features", "Limited users (3)", "Email support"]'::jsonb,
    3,
    0
  ),
  (
    'Pro',
    'pro',
    6432000,
    '["Advanced AI", "Unlimited users", "Analytics", "Priority support"]'::jsonb,
    null,
    1
  )
on conflict (code) do update set
  name = excluded.name,
  price_lak = excluded.price_lak,
  features = excluded.features,
  max_users = excluded.max_users,
  updated_at = now();
