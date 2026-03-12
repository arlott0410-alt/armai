-- ArmAI: Telegram integration — connection per merchant. Additive only.

create table if not exists public.telegram_connections (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  bot_token_encrypted_or_bound_reference text,
  telegram_group_id text not null,
  telegram_group_title text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id)
);

comment on table public.telegram_connections is 'Per-merchant Telegram bot/group link. Bot token stored via bound reference or encrypted; never plain in logs.';
create index if not exists idx_telegram_connections_merchant on public.telegram_connections (merchant_id);
create index if not exists idx_telegram_connections_group on public.telegram_connections (telegram_group_id) where is_active = true;
