-- ArmAI: AI and router usage events for metrics and cost analysis.
-- Logs response mode and reason; no PII or full message content.

create table if not exists public.ai_usage_events (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  response_mode text not null check (response_mode in ('template', 'retrieval', 'ai', 'escalation')),
  ai_call_reason text,
  route_category text,
  created_at timestamptz not null default now()
);

comment on table public.ai_usage_events is 'Router and AI invocation events. Used for metrics and savings analysis.';

create index if not exists idx_ai_usage_events_merchant_created on public.ai_usage_events (merchant_id, created_at desc);
create index if not exists idx_ai_usage_events_response_mode on public.ai_usage_events (merchant_id, response_mode, created_at desc);
