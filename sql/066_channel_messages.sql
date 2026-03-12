-- ArmAI: Normalized channel messages (all channels: facebook, whatsapp).
-- Single store for inbound/outbound with channel_type and external ids.

create table if not exists public.channel_messages (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  channel_type text not null check (channel_type in ('facebook', 'whatsapp')),
  external_message_id text,
  sender_external_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text' check (message_type in ('text', 'image', 'file', 'interactive', 'system')),
  text_content text,
  media_url text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

comment on table public.channel_messages is 'Normalized messages from all channels. AI pipeline consumes this.';

create index if not exists idx_channel_messages_merchant_created on public.channel_messages (merchant_id, created_at desc);
create index if not exists idx_channel_messages_channel_created on public.channel_messages (merchant_id, channel_type, created_at desc);
create index if not exists idx_channel_messages_external_id on public.channel_messages (external_message_id) where external_message_id is not null;
create index if not exists idx_channel_messages_sender on public.channel_messages (merchant_id, channel_type, sender_external_id, created_at desc);
