-- ArmAI: RLS for Telegram and shipment_images tables. Tenant-safe.

alter table public.telegram_connections enable row level security;
alter table public.telegram_admins enable row level security;
alter table public.telegram_messages enable row level security;
alter table public.shipment_images enable row level security;
alter table public.telegram_operation_events enable row level security;

create policy "telegram_connections_select_member_or_super" on public.telegram_connections for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "telegram_connections_insert_member_or_super" on public.telegram_connections for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "telegram_connections_update_member_or_super" on public.telegram_connections for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

create policy "telegram_admins_select_member_or_super" on public.telegram_admins for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "telegram_admins_insert_member_or_super" on public.telegram_admins for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "telegram_admins_update_member_or_super" on public.telegram_admins for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "telegram_admins_delete_member_or_super" on public.telegram_admins for delete
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

create policy "telegram_messages_select_member_or_super" on public.telegram_messages for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "telegram_messages_insert_member_or_super" on public.telegram_messages for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "telegram_messages_update_member_or_super" on public.telegram_messages for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

create policy "shipment_images_select_member_or_super" on public.shipment_images for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "shipment_images_insert_member_or_super" on public.shipment_images for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "shipment_images_update_member_or_super" on public.shipment_images for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

create policy "telegram_operation_events_select_member_or_super" on public.telegram_operation_events for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "telegram_operation_events_insert_member_or_super" on public.telegram_operation_events for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
