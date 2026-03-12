-- ArmAI: RLS for channel abstraction and WhatsApp. All policies use merchant_id.

alter table public.channels enable row level security;
alter table public.channel_connections enable row level security;
alter table public.channel_customers enable row level security;
alter table public.channel_messages enable row level security;
alter table public.whatsapp_connections enable row level security;

-- Channels: read-only lookup (all authenticated that can access any merchant can read).
create policy "channels_select_all" on public.channels for select using (true);

-- Channel connections: member or super.
create policy "channel_connections_select_member_or_super" on public.channel_connections for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "channel_connections_insert_member_or_super" on public.channel_connections for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "channel_connections_update_member_or_super" on public.channel_connections for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "channel_connections_delete_member_or_super" on public.channel_connections for delete
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

-- Channel customers: member or super.
create policy "channel_customers_select_member_or_super" on public.channel_customers for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "channel_customers_insert_member_or_super" on public.channel_customers for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "channel_customers_update_member_or_super" on public.channel_customers for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

-- Channel messages: member or super. Insert from webhooks uses service role.
create policy "channel_messages_select_member_or_super" on public.channel_messages for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "channel_messages_insert_member_or_super" on public.channel_messages for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

-- WhatsApp connections: member or super. No token in response from select (handled in API).
create policy "whatsapp_connections_select_member_or_super" on public.whatsapp_connections for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "whatsapp_connections_insert_member_or_super" on public.whatsapp_connections for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "whatsapp_connections_update_member_or_super" on public.whatsapp_connections for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "whatsapp_connections_delete_member_or_super" on public.whatsapp_connections for delete
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
