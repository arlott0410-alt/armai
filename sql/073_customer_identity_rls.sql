-- ArmAI: RLS for customer identity tables. All policies merchant-scoped.

alter table public.merchant_customers enable row level security;
alter table public.customer_channel_identities enable row level security;
alter table public.customer_identity_events enable row level security;

-- merchant_customers: member or super
create policy "merchant_customers_select_member_or_super" on public.merchant_customers for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "merchant_customers_insert_member_or_super" on public.merchant_customers for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "merchant_customers_update_member_or_super" on public.merchant_customers for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "merchant_customers_delete_member_or_super" on public.merchant_customers for delete
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

-- customer_channel_identities: member or super
create policy "customer_channel_identities_select_member_or_super" on public.customer_channel_identities for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "customer_channel_identities_insert_member_or_super" on public.customer_channel_identities for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "customer_channel_identities_update_member_or_super" on public.customer_channel_identities for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

-- customer_identity_events: member or super (read); insert from backend
create policy "customer_identity_events_select_member_or_super" on public.customer_identity_events for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "customer_identity_events_insert_member_or_super" on public.customer_identity_events for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
