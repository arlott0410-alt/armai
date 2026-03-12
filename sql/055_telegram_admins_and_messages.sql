-- ArmAI: Telegram admins and message log. Additive only.

do $$ begin
  create type telegram_admin_role_enum as enum (
    'owner',
    'admin',
    'operator'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.telegram_admins (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  telegram_user_id text not null,
  telegram_username text,
  telegram_display_name text,
  role telegram_admin_role_enum not null default 'operator',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, telegram_user_id)
);

comment on table public.telegram_admins is 'Authorized Telegram users per merchant. Only these can trigger operational actions.';
create index if not exists idx_telegram_admins_merchant on public.telegram_admins (merchant_id);
create index if not exists idx_telegram_admins_telegram_user on public.telegram_admins (telegram_user_id, merchant_id) where is_active = true;

do $$ begin
  create type telegram_message_type_enum as enum (
    'text',
    'photo',
    'command',
    'reply'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type telegram_processed_status_enum as enum (
    'received',
    'processed',
    'ignored',
    'failed',
    'needs_manual_link'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.telegram_messages (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  telegram_chat_id text not null,
  telegram_message_id text not null,
  telegram_user_id text,
  message_type telegram_message_type_enum not null default 'text',
  raw_payload_json jsonb,
  processed_status telegram_processed_status_enum not null default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.telegram_messages is 'Raw Telegram updates for audit and processing.';
create index if not exists idx_telegram_messages_merchant_created on public.telegram_messages (merchant_id, created_at desc);
create index if not exists idx_telegram_messages_chat_message on public.telegram_messages (telegram_chat_id, telegram_message_id);
