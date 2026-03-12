-- ArmAI: Multi-channel messaging abstraction.
-- Channels lookup and channel_connections (Facebook page / WhatsApp phone per merchant).
-- Extends conversations for channel_type and external ids (backward compatible).

-- Enum value for webhook events (additive).
do $$ begin
  alter type public.webhook_event_kind add value 'whatsapp_incoming';
exception
  when duplicate_object then null;
end $$;

-- Channels: type registry (facebook, whatsapp).
create table if not exists public.channels (
  id uuid primary key default uuid_generate_v4(),
  channel_type text not null unique check (channel_type in ('facebook', 'whatsapp')),
  created_at timestamptz not null default now()
);

comment on table public.channels is 'Channel type registry for multi-channel messaging.';

insert into public.channels (channel_type) values ('facebook'), ('whatsapp')
  on conflict (channel_type) do nothing;

-- Channel connections: one per merchant per external account (e.g. one Facebook page, one WhatsApp phone).
create table if not exists public.channel_connections (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  channel_type text not null check (channel_type in ('facebook', 'whatsapp')),
  external_account_id text not null,
  access_token_reference text,
  webhook_verify_token text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, channel_type, external_account_id)
);

comment on table public.channel_connections is 'Per-merchant channel connection (Facebook page or WhatsApp phone). Tokens stored by reference only.';

-- Channel customers: merchant + channel + external user id (PSID or wa_id).
create table if not exists public.channel_customers (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  channel_type text not null check (channel_type in ('facebook', 'whatsapp')),
  external_user_id text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, channel_type, external_user_id)
);

comment on table public.channel_customers is 'Customer identity per channel (external_user_id = PSID or wa_id).';

-- Extend conversations for multi-channel: add channel_type and external ids.
-- Keep page_id and customer_psid for backward compatibility (Facebook and display).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations' and column_name = 'channel_type'
  ) then
    alter table public.conversations add column channel_type text not null default 'facebook'
      check (channel_type in ('facebook', 'whatsapp'));
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations' and column_name = 'external_account_id'
  ) then
    alter table public.conversations add column external_account_id text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations' and column_name = 'external_customer_id'
  ) then
    alter table public.conversations add column external_customer_id text;
  end if;
end $$;

-- Backfill existing conversations: external_account_id=page_id, external_customer_id=customer_psid.
update public.conversations
set
  external_account_id = page_id,
  external_customer_id = customer_psid
where channel_type = 'facebook' and (external_account_id is null or external_customer_id is null);

-- Keep existing unique (merchant_id, page_id, customer_psid). For WhatsApp we use page_id=phone_number_id, customer_psid=wa_id.
comment on column public.conversations.channel_type is 'facebook or whatsapp.';
comment on column public.conversations.external_account_id is 'Page ID (Facebook) or phone_number_id (WhatsApp).';
comment on column public.conversations.external_customer_id is 'PSID (Facebook) or wa_id (WhatsApp).';
