-- ArmAI: Additional indexes and additive columns for customer identity.
-- Orders, channel_messages, conversations get optional merchant_customer_id (backward compatible).

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'merchant_customer_id'
  ) then
    alter table public.orders add column merchant_customer_id uuid references public.merchant_customers (id) on delete set null;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'channel_messages' and column_name = 'merchant_customer_id'
  ) then
    alter table public.channel_messages add column merchant_customer_id uuid references public.merchant_customers (id) on delete set null;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations' and column_name = 'merchant_customer_id'
  ) then
    alter table public.conversations add column merchant_customer_id uuid references public.merchant_customers (id) on delete set null;
  end if;
end $$;

create index if not exists idx_orders_merchant_customer on public.orders (merchant_customer_id) where merchant_customer_id is not null;
create index if not exists idx_channel_messages_merchant_customer on public.channel_messages (merchant_customer_id) where merchant_customer_id is not null;
create index if not exists idx_conversations_merchant_customer on public.conversations (merchant_customer_id) where merchant_customer_id is not null;
