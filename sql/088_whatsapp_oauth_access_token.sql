-- ArmAI: Store OAuth access token for WhatsApp Cloud API (one-click connect).
-- When present, channel-sender uses this instead of env WHATSAPP_ACCESS_TOKEN.

alter table public.whatsapp_connections
  add column if not exists access_token text;

comment on column public.whatsapp_connections.access_token is 'OAuth access token for WhatsApp Cloud API (one-click connect). Prefer over access_token_reference.';

-- Optional: display number for "Connected to +123..." in UI.
alter table public.whatsapp_connections
  add column if not exists display_phone_number text;

comment on column public.whatsapp_connections.display_phone_number is 'E.164 or display format for UI (e.g. +856 20 1234 5678).';
