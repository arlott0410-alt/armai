-- Drop duplicate policy if re-run (merchant_plans_insert_super may already exist from 021).
-- Use DO block to create only if missing.

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'merchant_plans' and policyname = 'merchant_plans_insert_super'
  ) then
    create policy "merchant_plans_insert_super" on public.merchant_plans for insert with check (public.is_super_admin());
  end if;
end $$;
