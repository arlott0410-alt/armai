-- ArmAI: RLS for conversation summaries and AI usage events.

alter table public.conversation_summaries enable row level security;
alter table public.ai_usage_events enable row level security;

create policy "conversation_summaries_select_member_or_super" on public.conversation_summaries for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "conversation_summaries_insert_member_or_super" on public.conversation_summaries for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "conversation_summaries_update_member_or_super" on public.conversation_summaries for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

create policy "ai_usage_events_select_member_or_super" on public.ai_usage_events for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "ai_usage_events_insert_member_or_super" on public.ai_usage_events for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
