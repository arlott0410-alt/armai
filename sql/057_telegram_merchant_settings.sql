-- ArmAI: Merchant settings columns for Telegram operations. Additive only.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_settings' and column_name = 'telegram_notify_order_paid') then
    alter table public.merchant_settings add column telegram_notify_order_paid boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_settings' and column_name = 'telegram_allow_shipment_confirmation') then
    alter table public.merchant_settings add column telegram_allow_shipment_confirmation boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_settings' and column_name = 'telegram_allow_ai_escalation') then
    alter table public.merchant_settings add column telegram_allow_ai_escalation boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_settings' and column_name = 'telegram_require_authorized_admins') then
    alter table public.merchant_settings add column telegram_require_authorized_admins boolean not null default true;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_settings' and column_name = 'telegram_auto_send_shipment_confirmation') then
    alter table public.merchant_settings add column telegram_auto_send_shipment_confirmation boolean not null default true;
  end if;
end $$;

comment on column public.merchant_settings.telegram_notify_order_paid is 'When true, send order-paid notification to merchant Telegram group.';
comment on column public.merchant_settings.telegram_allow_shipment_confirmation is 'When true, accept shipment slip images from Telegram group.';
comment on column public.merchant_settings.telegram_allow_ai_escalation is 'When true, send AI escalation messages to Telegram.';
comment on column public.merchant_settings.telegram_require_authorized_admins is 'When true, only telegram_admins can trigger actions in the group.';
comment on column public.merchant_settings.telegram_auto_send_shipment_confirmation is 'When true, send shipment image to customer automatically after linking; else require manual approval.';
