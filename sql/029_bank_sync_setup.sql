-- ArmAI: Additive bank sync setup fields on bank_configs.
-- Preserves existing schema; adds merchant-facing config only.

-- bank_code: business-friendly code (BCEL_ONE, LDB, JDB, GENERIC) for UI mapping to parser_id
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bank_configs' and column_name = 'bank_code'
  ) then
    alter table public.bank_configs add column bank_code text;
  end if;
end $$;

-- payment_account_id: link to merchant_payment_accounts for this connection
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bank_configs' and column_name = 'payment_account_id'
  ) then
    alter table public.bank_configs add column payment_account_id uuid
      references public.merchant_payment_accounts (id) on delete set null;
  end if;
end $$;

-- device_label: optional connection/device label for merchant reference
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bank_configs' and column_name = 'device_label'
  ) then
    alter table public.bank_configs add column device_label text;
  end if;
end $$;

-- last_tested_at: when test connection was last run from UI
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bank_configs' and column_name = 'last_tested_at'
  ) then
    alter table public.bank_configs add column last_tested_at timestamptz;
  end if;
end $$;

comment on column public.bank_configs.bank_code is 'Business-friendly bank code for UI (BCEL_ONE, LDB, JDB, GENERIC).';
comment on column public.bank_configs.payment_account_id is 'Linked merchant payment account for this bank sync connection.';
comment on column public.bank_configs.device_label is 'Optional label for this connection/device.';
comment on column public.bank_configs.last_tested_at is 'Last time test connection was run from merchant UI.';
