-- ArmAI: Channel identity per merchant (Facebook/WhatsApp) with optional link to unified customer.
-- Every inbound channel user maps to one row; may be unlinked until safe merge.

create table if not exists public.customer_channel_identities (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  merchant_customer_id uuid references public.merchant_customers (id) on delete set null,
  channel_type text not null check (channel_type in ('facebook', 'whatsapp')),
  external_user_id text not null,
  channel_display_name text,
  phone_number text,
  normalized_phone text,
  profile_image_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, channel_type, external_user_id)
);

comment on table public.customer_channel_identities is 'Per-channel identity; optional link to merchant_customer. Always merchant-scoped.';
comment on column public.customer_channel_identities.normalized_phone is 'Canonical form for auto-link matching.';

create index if not exists idx_customer_channel_identities_merchant on public.customer_channel_identities (merchant_id);
create index if not exists idx_customer_channel_identities_merchant_customer on public.customer_channel_identities (merchant_customer_id) where merchant_customer_id is not null;
create index if not exists idx_customer_channel_identities_normalized_phone on public.customer_channel_identities (merchant_id, normalized_phone) where normalized_phone is not null;
