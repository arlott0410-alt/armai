-- ArmAI: Shipment images and Telegram operation events. Additive only.

do $$ begin
  create type shipment_image_source_enum as enum (
    'dashboard',
    'telegram'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type shipment_uploaded_by_type_enum as enum (
    'merchant_dashboard',
    'telegram_admin',
    'system'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type shipment_image_processing_status_enum as enum (
    'received',
    'linked',
    'ambiguous',
    'awaiting_order_reference',
    'sent_to_customer',
    'failed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.shipment_images (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  source shipment_image_source_enum not null,
  image_url text,
  image_object_key text,
  uploaded_by_type shipment_uploaded_by_type_enum not null default 'merchant_dashboard',
  uploaded_by_id text,
  telegram_message_id uuid references public.telegram_messages (id) on delete set null,
  extracted_reference text,
  processing_status shipment_image_processing_status_enum not null default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.shipment_images is 'Shipment slip/waybill images from dashboard or Telegram. Linked to order when confident.';
create index if not exists idx_shipment_images_merchant on public.shipment_images (merchant_id);
create index if not exists idx_shipment_images_order on public.shipment_images (order_id) where order_id is not null;
create index if not exists idx_shipment_images_status on public.shipment_images (merchant_id, processing_status);

do $$ begin
  create type telegram_operation_event_type_enum as enum (
    'telegram_connected',
    'telegram_admin_added',
    'order_paid_notified',
    'ai_escalation_sent',
    'shipment_image_received',
    'shipment_image_linked',
    'shipment_confirmation_sent',
    'escalation_resolved'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type telegram_actor_type_enum as enum (
    'system',
    'telegram_admin',
    'merchant_dashboard',
    'ai_agent'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.telegram_operation_events (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  related_order_id uuid references public.orders (id) on delete set null,
  related_shipment_image_id uuid references public.shipment_images (id) on delete set null,
  event_type text not null,
  event_note text,
  actor_type telegram_actor_type_enum not null default 'system',
  actor_id text,
  created_at timestamptz not null default now()
);

comment on table public.telegram_operation_events is 'Audit log for Telegram operations: notifications, escalations, shipment links.';
create index if not exists idx_telegram_operation_events_merchant_created on public.telegram_operation_events (merchant_id, created_at desc);
create index if not exists idx_telegram_operation_events_order on public.telegram_operation_events (related_order_id) where related_order_id is not null;

-- Extend order_shipments for image-first fulfillment (optional shipment_image_id, customer_notified_at)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_shipments' and column_name = 'shipment_proof_mode') then
    alter table public.order_shipments add column shipment_proof_mode text default 'structured';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_shipments' and column_name = 'shipment_image_id') then
    alter table public.order_shipments add column shipment_image_id uuid references public.shipment_images (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_shipments' and column_name = 'customer_notified_at') then
    alter table public.order_shipments add column customer_notified_at timestamptz;
  end if;
end $$;

comment on column public.order_shipments.shipment_proof_mode is 'structured = tracking fields; image = proof from shipment_images.';
comment on column public.order_shipments.shipment_image_id is 'When proof is image-first, link to shipment_images.';
comment on column public.order_shipments.customer_notified_at is 'When shipment confirmation (text or image) was sent to customer.';
