-- ArmAI: Indexes for bank sync setup lookups. Additive only.

create index if not exists idx_bank_configs_merchant_active
  on public.bank_configs (merchant_id, is_active)
  where is_active = true;
