-- ArmAI: Unified multi-channel inbox/chat.
-- Uses inbox_* names to avoid conflict with existing conversations / messages (004_tables_business).
-- RLS multi-tenant; merchant_id scoped. Realtime enabled.

-- 1. inbox_contacts
create table if not exists public.inbox_contacts (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  channel_type text not null check (channel_type in ('whatsapp', 'facebook', 'telegram')),
  contact_id text not null,
  name text,
  profile_pic_url text,
  last_seen_at timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.inbox_contacts is 'Per-channel contact (phone/PSID/telegram user_id) per merchant for unified inbox.';
comment on column public.inbox_contacts.contact_id is 'Phone for WhatsApp, PSID for Facebook, user_id for Telegram.';

create unique index if not exists idx_inbox_contacts_merchant_channel_contact
  on public.inbox_contacts (merchant_id, channel_type, contact_id);
create index if not exists idx_inbox_contacts_merchant on public.inbox_contacts (merchant_id);
create index if not exists idx_inbox_contacts_last_seen on public.inbox_contacts (merchant_id, last_seen_at desc nulls last);

-- 2. inbox_conversations
create table if not exists public.inbox_conversations (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  contact_id uuid not null references public.inbox_contacts (id) on delete cascade,
  channel_type text not null check (channel_type in ('whatsapp', 'facebook', 'telegram')),
  last_message_at timestamptz,
  unread_count int not null default 0 check (unread_count >= 0),
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.inbox_conversations is 'One conversation per inbox contact per merchant (unified inbox thread).';

create unique index if not exists idx_inbox_conversations_merchant_contact_channel
  on public.inbox_conversations (merchant_id, contact_id, channel_type);
create index if not exists idx_inbox_conversations_merchant_last_message
  on public.inbox_conversations (merchant_id, last_message_at desc nulls last);
create index if not exists idx_inbox_conversations_merchant_status on public.inbox_conversations (merchant_id, status);

-- 3. inbox_messages
create table if not exists public.inbox_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.inbox_conversations (id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'ai', 'human')),
  sender_id text,
  content jsonb not null default '{}',
  timestamp timestamptz not null default now(),
  status text not null default 'sent' check (status in ('sent', 'delivered', 'read', 'failed')),
  is_ai_generated boolean not null default false
);

comment on table public.inbox_messages is 'Unified inbox messages; content: { "text", "type", "media_url" }.';
comment on column public.inbox_messages.content is 'JSON: { "text": "...", "type": "text|image|file", "media_url": "..." }.';

create index if not exists idx_inbox_messages_conversation_timestamp
  on public.inbox_messages (conversation_id, timestamp);
create index if not exists idx_inbox_messages_conversation_id on public.inbox_messages (conversation_id);

-- updated_at triggers
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'inbox_contacts_updated_at') then
    create trigger inbox_contacts_updated_at
      before update on public.inbox_contacts
      for each row execute function public.trg_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'inbox_conversations_updated_at') then
    create trigger inbox_conversations_updated_at
      before update on public.inbox_conversations
      for each row execute function public.trg_set_updated_at();
  end if;
end $$;

-- On new inbox message: set conversation last_message_at and increment unread when sender is customer
create or replace function public.trg_inbox_messages_conversation_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inbox_conversations
  set
    last_message_at = new.timestamp,
    unread_count = case
      when new.sender_type = 'customer' then unread_count + 1
      else unread_count
    end,
    updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists inbox_messages_conversation_meta on public.inbox_messages;
create trigger inbox_messages_conversation_meta
  after insert on public.inbox_messages
  for each row execute function public.trg_inbox_messages_conversation_meta();

-- RLS
alter table public.inbox_contacts enable row level security;
alter table public.inbox_conversations enable row level security;
alter table public.inbox_messages enable row level security;

create policy "inbox_contacts_select_member_or_super" on public.inbox_contacts for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "inbox_contacts_insert_member_or_super" on public.inbox_contacts for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "inbox_contacts_update_member_or_super" on public.inbox_contacts for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

create policy "inbox_conversations_select_member_or_super" on public.inbox_conversations for select
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "inbox_conversations_insert_member_or_super" on public.inbox_conversations for insert
  with check (public.is_super_admin() or public.user_can_access_merchant(merchant_id));
create policy "inbox_conversations_update_member_or_super" on public.inbox_conversations for update
  using (public.is_super_admin() or public.user_can_access_merchant(merchant_id));

create policy "inbox_messages_select_member_or_super" on public.inbox_messages for select
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.inbox_conversations c
      where c.id = inbox_messages.conversation_id
        and public.user_can_access_merchant(c.merchant_id)
    )
  );
create policy "inbox_messages_insert_member_or_super" on public.inbox_messages for insert
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.inbox_conversations c
      where c.id = conversation_id
        and public.user_can_access_merchant(c.merchant_id)
    )
  );
create policy "inbox_messages_update_member_or_super" on public.inbox_messages for update
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.inbox_conversations c
      where c.id = inbox_messages.conversation_id
        and public.user_can_access_merchant(c.merchant_id)
    )
  );

-- Realtime (idempotent)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'inbox_contacts') then
    alter publication supabase_realtime add table public.inbox_contacts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'inbox_conversations') then
    alter publication supabase_realtime add table public.inbox_conversations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'inbox_messages') then
    alter publication supabase_realtime add table public.inbox_messages;
  end if;
end $$;
