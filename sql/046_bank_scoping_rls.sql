-- ArmAI: RLS for bank parser profiles, raw events, connections, processing logs.
-- Tenant-safe: merchant_id or FK to merchant-scoped tables.

alter table public.bank_parser_profiles enable row level security;
alter table public.bank_raw_notification_events enable row level security;
alter table public.bank_connections enable row level security;
alter table public.bank_transaction_processing_logs enable row level security;

-- Parser profiles: read-only for all authenticated (no merchant_id; global config).
create policy "bank_parser_profiles_select_authenticated" on public.bank_parser_profiles for select
  using (auth.uid() is not null);

-- Raw notification events: merchant members and super
create policy "bank_raw_events_select_member_or_super" on public.bank_raw_notification_events for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
-- Insert/update: service role only (webhook writes). No policy = only service role when RLS on.

-- Bank connections: full CRUD for member or super
create policy "bank_connections_select_member_or_super" on public.bank_connections for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "bank_connections_insert_member_or_super" on public.bank_connections for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "bank_connections_update_member_or_super" on public.bank_connections for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "bank_connections_delete_member_or_super" on public.bank_connections for delete
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

-- Processing logs: read-only for merchant and super
create policy "bank_processing_logs_select_member_or_super" on public.bank_transaction_processing_logs for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
-- Insert: service role only (backend writes).
