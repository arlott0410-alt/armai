-- ArmAI: Merchant-level WhatsApp Business Platform (Cloud API) configuration.
-- Tokens stored by reference only; never exposed to frontend.

create table if not exists public.whatsapp_connections (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  waba_id text,
  phone_number_id text not null,
  business_account_name text,
  access_token_reference text,
  webhook_verify_token text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, phone_number_id)
);

comment on table public.whatsapp_connections is 'WhatsApp Business API connection per merchant. Token stored by reference only.';

create index if not exists idx_whatsapp_connections_merchant on public.whatsapp_connections (merchant_id);
create index if not exists idx_whatsapp_connections_phone_number_id on public.whatsapp_connections (phone_number_id);
