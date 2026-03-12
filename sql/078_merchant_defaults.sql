-- Merchant-level default country and currency for Laos/Thailand and multi-country support.
-- Backward compatible: existing rows get TH/THB.

alter table public.merchants
  add column if not exists default_country text,
  add column if not exists default_currency text;

comment on column public.merchants.default_country is 'ISO 3166-1 alpha-2 (e.g. LA, TH). Used for phone normalization and default currency.';
comment on column public.merchants.default_currency is 'ISO 4217 (e.g. LAK, THB). Overrides country-derived default when set.';

-- Backfill: existing merchants default to Thailand/THB for backward compatibility.
update public.merchants
set default_country = 'TH', default_currency = 'THB'
where default_country is null and default_currency is null;

-- Default for new rows (same as backfill).
alter table public.merchants
  alter column default_country set default 'TH',
  alter column default_currency set default 'THB';
