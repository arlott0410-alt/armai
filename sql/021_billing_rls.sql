-- RLS for new billing tables (super only for write; member can read own plan only).

alter table public.merchant_billing_events enable row level security;
alter table public.merchant_internal_notes enable row level security;

-- merchant_billing_events: super sees all; merchant sees own only (read).
create policy "merchant_billing_events_select_member_or_super" on public.merchant_billing_events for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "merchant_billing_events_insert_super" on public.merchant_billing_events for insert with check (public.is_super_admin());
create policy "merchant_billing_events_update_super" on public.merchant_billing_events for update using (public.is_super_admin());
create policy "merchant_billing_events_delete_super" on public.merchant_billing_events for delete using (public.is_super_admin());

-- merchant_internal_notes: super only (internal notes never visible to merchant).
create policy "merchant_internal_notes_select_super" on public.merchant_internal_notes for select using (public.is_super_admin());
create policy "merchant_internal_notes_insert_super" on public.merchant_internal_notes for insert with check (public.is_super_admin());
create policy "merchant_internal_notes_delete_super" on public.merchant_internal_notes for delete using (public.is_super_admin());
