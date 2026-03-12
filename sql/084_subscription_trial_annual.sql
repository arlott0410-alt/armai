-- Trial 7 days + Monthly/Annual subscription options.
-- subscription_payments: add payment_type ('monthly' | 'annual').
-- merchant_plans: trial_ends_at already exists (019); ensure used for trial display.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscription_payments' and column_name = 'payment_type'
  ) then
    alter table public.subscription_payments
      add column payment_type text check (payment_type is null or payment_type in ('monthly', 'annual'));
    comment on column public.subscription_payments.payment_type is 'Subscription interval: monthly 1,999,000 LAK or annual 19,999,000 LAK.';
  end if;
end $$;

create index if not exists idx_subscription_payments_payment_type
  on public.subscription_payments (payment_type) where payment_type is not null;
