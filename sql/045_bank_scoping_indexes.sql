-- ArmAI: Indexes for bank scoping and processing. Additive only.

create index if not exists idx_bank_transactions_scope_status
  on public.bank_transactions (merchant_id, scope_status);
create index if not exists idx_bank_transactions_payment_account
  on public.bank_transactions (payment_account_id) where payment_account_id is not null;
create index if not exists idx_bank_transactions_raw_event
  on public.bank_transactions (raw_event_id) where raw_event_id is not null;
