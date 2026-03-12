import type { SupabaseClient } from '@supabase/supabase-js';

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

export type TelegramConnectionRow = {
  id: string;
  merchant_id: string;
  bot_token_encrypted_or_bound_reference: string | null;
  telegram_group_id: string;
  telegram_group_title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TelegramAdminRow = {
  id: string;
  merchant_id: string;
  telegram_user_id: string;
  telegram_username: string | null;
  telegram_display_name: string | null;
  role: string;
  is_active: boolean;
};

/** Get active Telegram connection for merchant. Token may be stored as-is or as reference; caller uses it for API calls. */
export async function getTelegramConnection(
  supabase: SupabaseClient,
  merchantId: string
): Promise<TelegramConnectionRow | null> {
  const { data, error } = await supabase
    .from('telegram_connections')
    .select('id, merchant_id, bot_token_encrypted_or_bound_reference, telegram_group_id, telegram_group_title, is_active, created_at, updated_at')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Check if Telegram user is authorized admin for merchant. */
export async function isAuthorizedTelegramAdmin(
  supabase: SupabaseClient,
  merchantId: string,
  telegramUserId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('telegram_admins')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('telegram_user_id', String(telegramUserId))
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/** Send text message to Telegram chat. Token is the bot token (from connection). */
export async function sendTelegramText(
  botToken: string,
  chatId: string,
  text: string,
  opts?: { disable_web_page_preview?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const url = `${TELEGRAM_API_BASE}${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: opts?.disable_web_page_preview ?? true,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.description ?? `HTTP ${res.status}` };
  }
  return { ok: true };
}

/** Send photo by URL to Telegram chat. */
export async function sendTelegramPhoto(
  botToken: string,
  chatId: string,
  photoUrl: string,
  caption?: string
): Promise<{ ok: boolean; error?: string }> {
  const url = `${TELEGRAM_API_BASE}${botToken}/sendPhoto`;
  const body = {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption ?? undefined,
    parse_mode: 'HTML',
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.description ?? `HTTP ${res.status}` };
  }
  return { ok: true };
}

/** Record a telegram operation event for audit. */
export async function recordTelegramOperationEvent(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    relatedOrderId?: string | null;
    relatedShipmentImageId?: string | null;
    eventType: string;
    eventNote?: string | null;
    actorType: 'system' | 'telegram_admin' | 'merchant_dashboard' | 'ai_agent';
    actorId?: string | null;
  }
) {
  const { error } = await supabase.from('telegram_operation_events').insert({
    merchant_id: p.merchantId,
    related_order_id: p.relatedOrderId ?? null,
    related_shipment_image_id: p.relatedShipmentImageId ?? null,
    event_type: p.eventType,
    event_note: p.eventNote ?? null,
    actor_type: p.actorType,
    actor_id: p.actorId ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Get merchant settings for Telegram (notify order paid, etc.). */
export async function getMerchantTelegramSettings(
  supabase: SupabaseClient,
  merchantId: string
): Promise<{
  telegram_notify_order_paid?: boolean;
  telegram_allow_shipment_confirmation?: boolean;
  telegram_allow_ai_escalation?: boolean;
  telegram_require_authorized_admins?: boolean;
  telegram_auto_send_shipment_confirmation?: boolean;
}> {
  const { data, error } = await supabase
    .from('merchant_settings')
    .select('telegram_notify_order_paid, telegram_allow_shipment_confirmation, telegram_allow_ai_escalation, telegram_require_authorized_admins, telegram_auto_send_shipment_confirmation')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? {};
}

/** Build and send order-paid notification to Telegram group. Returns true if sent. Skips if already notified for this order. */
export async function notifyOrderPaidToTelegram(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    orderId: string;
    orderReferenceCode: string | null;
    customerName: string | null;
    amount: number | null;
    paymentMethod: string | null;
    itemsSummary: string;
  }
): Promise<{ sent: boolean; error?: string }> {
  const [conn, settings, existing] = await Promise.all([
    getTelegramConnection(supabase, p.merchantId),
    getMerchantTelegramSettings(supabase, p.merchantId),
    supabase
      .from('telegram_operation_events')
      .select('id')
      .eq('merchant_id', p.merchantId)
      .eq('related_order_id', p.orderId)
      .eq('event_type', 'order_paid_notified')
      .limit(1),
  ]);
  if (existing.data?.length) return { sent: false };
  if (!conn?.bot_token_encrypted_or_bound_reference || !settings?.telegram_notify_order_paid) {
    return { sent: false };
  }
  const token = conn.bot_token_encrypted_or_bound_reference;
  const chatId = conn.telegram_group_id;
  const ref = p.orderReferenceCode ?? p.orderId.slice(0, 8);
  const lines = [
    '<b>Order paid</b>',
    `Order: ${ref}`,
    `Customer: ${p.customerName ?? '—'}`,
    `Amount: ${p.amount ?? '—'} | ${p.paymentMethod ?? '—'}`,
    p.itemsSummary ? `Items: ${p.itemsSummary}` : null,
    '',
    'Action: Prepare shipment / upload shipment slip in this group.',
  ].filter(Boolean);
  const text = lines.join('\n');
  const result = await sendTelegramText(token, chatId, text);
  if (!result.ok) {
    return { sent: false, error: result.error };
  }
  await recordTelegramOperationEvent(supabase, {
    merchantId: p.merchantId,
    relatedOrderId: p.orderId,
    eventType: 'order_paid_notified',
    eventNote: ref,
    actorType: 'system',
  });
  return { sent: true };
}

/** Send AI escalation message to Telegram group. Returns true if sent. */
export async function sendAiEscalationToTelegram(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    issueType: string;
    relatedOrderId?: string | null;
    customerSummary?: string | null;
    context?: string | null;
    actionRequested?: string | null;
  }
): Promise<{ sent: boolean; error?: string }> {
  const [conn, settings] = await Promise.all([
    getTelegramConnection(supabase, p.merchantId),
    getMerchantTelegramSettings(supabase, p.merchantId),
  ]);
  if (!conn?.bot_token_encrypted_or_bound_reference || settings?.telegram_allow_ai_escalation !== true) {
    return { sent: false };
  }
  const lines = [
    '<b>AI escalation</b>',
    `Issue: ${p.issueType}`,
    p.relatedOrderId ? `Order: ${p.relatedOrderId.slice(0, 8)}…` : null,
    p.customerSummary ? `Customer: ${p.customerSummary}` : null,
    p.context ? `Context: ${p.context}` : null,
    p.actionRequested ? `Action: ${p.actionRequested}` : null,
  ].filter(Boolean);
  const result = await sendTelegramText(conn.bot_token_encrypted_or_bound_reference, conn.telegram_group_id, lines.join('\n'));
  if (!result.ok) return { sent: false, error: result.error };
  await recordTelegramOperationEvent(supabase, {
    merchantId: p.merchantId,
    relatedOrderId: p.relatedOrderId ?? undefined,
    eventType: 'ai_escalation_sent',
    eventNote: p.issueType,
    actorType: 'ai_agent',
  });
  return { sent: true };
}
