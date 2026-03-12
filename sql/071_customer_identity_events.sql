-- ArmAI: Audit trail for customer identity linking and merges.

create table if not exists public.customer_identity_events (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  merchant_customer_id uuid references public.merchant_customers (id) on delete set null,
  channel_identity_id uuid references public.customer_channel_identities (id) on delete set null,
  event_type text not null check (event_type in (
    'identity_created',
    'auto_linked',
    'manually_linked',
    'manually_unlinked',
    'merge_rejected'
  )),
  previous_merchant_customer_id uuid references public.merchant_customers (id) on delete set null,
  new_merchant_customer_id uuid references public.merchant_customers (id) on delete set null,
  reason text,
  actor_type text not null check (actor_type in ('system', 'merchant_admin', 'support')),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.customer_identity_events is 'Audit log for identity creation, link, unlink, merge. Enterprise traceability.';

create index if not exists idx_customer_identity_events_merchant on public.customer_identity_events (merchant_id, created_at desc);
create index if not exists idx_customer_identity_events_merchant_customer on public.customer_identity_events (merchant_customer_id) where merchant_customer_id is not null;
create index if not exists idx_customer_identity_events_channel_identity on public.customer_identity_events (channel_identity_id) where channel_identity_id is not null;
