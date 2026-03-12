-- ArmAI: Processing decision log for bank notification parsing and scoping.
-- Additive; for support and debugging.

create table if not exists public.bank_transaction_processing_logs (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  raw_event_id uuid references public.bank_raw_notification_events (id) on delete set null,
  parser_profile_id uuid references public.bank_parser_profiles (id) on delete set null,
  payment_account_id uuid references public.merchant_payment_accounts (id) on delete set null,
  bank_transaction_id uuid references public.bank_transactions (id) on delete set null,
  parse_status text,
  scope_status text,
  matching_eligibility boolean not null default false,
  decision_reason text,
  detail_json jsonb,
  created_at timestamptz not null default now()
);

comment on table public.bank_transaction_processing_logs is 'Traceable log: parser chosen, scope outcome, why scoped/out_of_scope/ambiguous.';
create index if not exists idx_bank_processing_logs_merchant_created
  on public.bank_transaction_processing_logs (merchant_id, created_at desc);
create index if not exists idx_bank_processing_logs_raw_event
  on public.bank_transaction_processing_logs (raw_event_id) where raw_event_id is not null;
