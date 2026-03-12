-- ArmAI: Additional indexes for channel and WhatsApp tables (if not already in 064-066).

create index if not exists idx_channel_connections_merchant_active on public.channel_connections (merchant_id, is_active) where is_active = true;
create index if not exists idx_channel_customers_merchant_channel on public.channel_customers (merchant_id, channel_type);
create index if not exists idx_channel_customers_external_user on public.channel_customers (merchant_id, channel_type, external_user_id);
