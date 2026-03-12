-- ArmAI: Additional indexes for router and summary lookups.

create index if not exists idx_conversation_summaries_active_order on public.conversation_summaries (active_order_id) where active_order_id is not null;
