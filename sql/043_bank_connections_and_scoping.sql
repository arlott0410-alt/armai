-- ArmAI: Raw notification intake, bank connections, payment account enhancements, scoping fields.
-- Additive only; preserves existing behavior.

-- Enums for processing and scoping
do $$ begin
  create type bank_notification_processing_status as enum (
    'received',
    'parsed',
    'scoped',
    'out_of_scope',
    'ambiguous',
    'manual_review',
    'failed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type bank_scope_status as enum (
    'scoped',
    'ambiguous',
    'out_of_scope',
    'manual_review'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type bank_connection_match_mode as enum ('strict', 'relaxed');
exception when duplicate_object then null;
end $$;

-- Bank connections: one notification source context tied to one payment account (create first for FK)
create table if not exists public.bank_connections (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  payment_account_id uuid not null references public.merchant_payment_accounts (id) on delete cascade,
  bank_code text not null,
  parser_profile_id uuid references public.bank_parser_profiles (id) on delete set null,
  match_mode bank_connection_match_mode not null default 'strict',
  device_id text,
  device_label text,
  webhook_token text,
  is_active boolean not null default true,
  last_received_at timestamptz,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.bank_connections is 'One connection = one notification source (e.g. device) scoped to one merchant payment account.';
create index if not exists idx_bank_connections_merchant_active
  on public.bank_connections (merchant_id, is_active) where is_active = true;
create index if not exists idx_bank_connections_payment_account
  on public.bank_connections (payment_account_id);

-- Raw bank notification events (intake with full metadata for parsing and debugging)
create table if not exists public.bank_raw_notification_events (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  bank_connection_id uuid references public.bank_connections (id) on delete set null,
  source_app_package text,
  source_app_label text,
  device_id text,
  device_label text,
  notification_title text,
  notification_subtitle text,
  raw_message text,
  raw_payload_json jsonb,
  locale text,
  received_at timestamptz not null default now(),
  processing_status bank_notification_processing_status not null default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.bank_raw_notification_events is 'Raw bank webhook events before parsing/scoping. Preserved for debugging and parser evolution.';
create index if not exists idx_bank_raw_events_merchant_received
  on public.bank_raw_notification_events (merchant_id, received_at desc);
create index if not exists idx_bank_raw_events_status
  on public.bank_raw_notification_events (merchant_id, processing_status);

-- Payment account: normalized account and suffix for scoping
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_payment_accounts' and column_name = 'account_number_normalized') then
    alter table public.merchant_payment_accounts add column account_number_normalized text;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_payment_accounts' and column_name = 'account_suffix') then
    alter table public.merchant_payment_accounts add column account_suffix text;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_payment_accounts' and column_name = 'account_aliases_json') then
    alter table public.merchant_payment_accounts add column account_aliases_json jsonb;
  end if;
end $$;
comment on column public.merchant_payment_accounts.account_number_normalized is 'Digits-only or canonical form for exact matching.';
comment on column public.merchant_payment_accounts.account_suffix is 'Last N digits for suffix/masked matching.';
comment on column public.merchant_payment_accounts.account_aliases_json is 'Optional array of alias strings or patterns for matching.';

-- bank_transactions: scoping outcome (nullable for backward compat)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bank_transactions' and column_name = 'payment_account_id') then
    alter table public.bank_transactions add column payment_account_id uuid references public.merchant_payment_accounts (id) on delete set null;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bank_transactions' and column_name = 'scope_status') then
    alter table public.bank_transactions add column scope_status bank_scope_status;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bank_transactions' and column_name = 'scope_confidence') then
    alter table public.bank_transactions add column scope_confidence numeric(5, 4);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bank_transactions' and column_name = 'ignored_reason') then
    alter table public.bank_transactions add column ignored_reason text;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bank_transactions' and column_name = 'parser_profile_id') then
    alter table public.bank_transactions add column parser_profile_id uuid references public.bank_parser_profiles (id) on delete set null;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bank_transactions' and column_name = 'raw_event_id') then
    alter table public.bank_transactions add column raw_event_id uuid references public.bank_raw_notification_events (id) on delete set null;
  end if;
end $$;
comment on column public.bank_transactions.payment_account_id is 'Set when notification is scoped to this payment account.';
comment on column public.bank_transactions.scope_status is 'scoped = eligible for matching; ambiguous/out_of_scope = do not auto-match.';
comment on column public.bank_transactions.ignored_reason is 'Reason when scope_status is out_of_scope or ambiguous.';

-- bank_configs: match_mode for scoping (default strict) when using single config per merchant
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bank_configs' and column_name = 'match_mode') then
    alter table public.bank_configs add column match_mode bank_connection_match_mode default 'strict';
  end if;
end $$;
