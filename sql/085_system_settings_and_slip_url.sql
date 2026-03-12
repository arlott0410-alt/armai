-- System settings (key-value) for superadmin: bank details, etc.
-- subscription_payments: slip_url for mandatory transfer slip (R2 key or URL).

-- system_settings: key-value store (super_admin editable)
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

comment on table public.system_settings is 'Global system config (e.g. subscription bank account) editable by super_admin.';

-- RLS: only service role / super use; no anon access for write. Read can be public for bank display.
alter table public.system_settings enable row level security;

create policy "system_settings_select_all" on public.system_settings for select using (true);
create policy "system_settings_update_super" on public.system_settings for update
  using (public.is_super_admin());
create policy "system_settings_insert_super" on public.system_settings for insert
  with check (public.is_super_admin());

-- subscription_payments: slip_url (required for manual_slip before approve)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscription_payments' and column_name = 'slip_url'
  ) then
    alter table public.subscription_payments
      add column slip_url text;
    comment on column public.subscription_payments.slip_url is 'R2 key or URL of uploaded transfer slip image (required for approval).';
  end if;
end $$;
