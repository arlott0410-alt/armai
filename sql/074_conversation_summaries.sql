-- ArmAI: Compact conversation summary per conversation for router and AI context reuse.
-- Reduces repeated token usage; source of truth remains raw messages.

create table if not exists public.conversation_summaries (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  recent_intent text,
  recent_product_focus text,
  active_order_id uuid references public.orders (id) on delete set null,
  active_payment_method text,
  unresolved_questions text,
  customer_profile_hints text,
  latest_fulfillment_state text,
  latest_payment_state text,
  summary_version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id)
);

comment on table public.conversation_summaries is 'Best-effort compact summary per conversation. Safe to rebuild from messages.';

create index if not exists idx_conversation_summaries_merchant on public.conversation_summaries (merchant_id);
create index if not exists idx_conversation_summaries_conversation on public.conversation_summaries (conversation_id);
