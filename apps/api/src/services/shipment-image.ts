import type { SupabaseClient } from '@supabase/supabase-js';
import * as telegram from './telegram.js';
import * as fulfillment from './fulfillment.js';
import * as channelSender from './channel-sender.js';
import { FULFILLMENT_STATUS } from '@armai/shared';
import type { Env } from '../env.js';

/** Normalize order reference from text: allow short code or full UUID. */
function normalizeOrderReference(text: string): string | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return null;
  const uuidMatch = t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) return uuidMatch[0];
  if (/^[a-z0-9-]{4,64}$/i.test(t)) return t;
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(0, 32);
  return t.length >= 4 ? t : null;
}

/** Find order by reference (reference_code or id prefix). */
async function findOrderByReference(
  supabase: SupabaseClient,
  merchantId: string,
  ref: string
): Promise<{ id: string } | null> {
  if (ref.length >= 32 && /^[0-9a-f-]{36}$/i.test(ref)) {
    const { data } = await supabase.from('orders').select('id').eq('merchant_id', merchantId).eq('id', ref).maybeSingle();
    return data;
  }
  const { data } = await supabase
    .from('orders')
    .select('id')
    .eq('merchant_id', merchantId)
    .ilike('reference_code', `${ref}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) return data;
  const { data: byId } = await supabase
    .from('orders')
    .select('id')
    .eq('merchant_id', merchantId)
    .like('id', `${ref}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return byId;
}

/**
 * Create shipment_image from Telegram photo. Attempts to link by caption or recent paid orders.
 * Returns status: linked | ambiguous | awaiting_order_reference | failed.
 */
export async function createFromTelegram(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    telegramMessageId: string;
    imageUrl?: string;
    fileId?: string;
    caption?: string;
    telegramUserId?: string;
  }
): Promise<{ status: 'linked' | 'ambiguous' | 'awaiting_order_reference' | 'failed'; shipmentImageId?: string; orderId?: string }> {
  const refFromCaption = p.caption ? normalizeOrderReference(p.caption) : null;
  let orderId: string | null = null;

  if (refFromCaption) {
    const order = await findOrderByReference(supabase, p.merchantId, refFromCaption);
    if (order) orderId = order.id;
  }

  if (!orderId && refFromCaption) {
    const { data: img } = await supabase
      .from('shipment_images')
      .insert({
        merchant_id: p.merchantId,
        source: 'telegram',
        image_url: p.imageUrl ?? null,
        image_object_key: p.fileId ?? null,
        uploaded_by_type: 'telegram_admin',
        uploaded_by_id: p.telegramUserId ?? null,
        telegram_message_id: p.telegramMessageId,
        extracted_reference: refFromCaption,
        processing_status: 'ambiguous',
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    await telegram.recordTelegramOperationEvent(supabase, {
      merchantId: p.merchantId,
      relatedShipmentImageId: img?.id,
      eventType: 'shipment_image_received',
      eventNote: 'Caption had reference but order not found',
      actorType: 'telegram_admin',
      actorId: p.telegramUserId,
    });
    return { status: 'ambiguous', shipmentImageId: img?.id };
  }

  if (!orderId) {
    const { data: recent } = await supabase
      .from('orders')
      .select('id')
      .eq('merchant_id', p.merchantId)
      .eq('status', 'paid')
      .in('fulfillment_status', ['pending_fulfillment', null])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) orderId = recent.id;
  }

  const processingStatus = orderId ? 'linked' : 'awaiting_order_reference';
  const { data: img, error } = await supabase
    .from('shipment_images')
    .insert({
      merchant_id: p.merchantId,
      order_id: orderId,
      source: 'telegram',
      image_url: p.imageUrl ?? null,
      image_object_key: p.fileId ?? null,
      uploaded_by_type: 'telegram_admin',
      uploaded_by_id: p.telegramUserId ?? null,
      telegram_message_id: p.telegramMessageId,
      extracted_reference: refFromCaption,
      processing_status: processingStatus,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !img) {
    return { status: 'failed' };
  }

  await telegram.recordTelegramOperationEvent(supabase, {
    merchantId: p.merchantId,
    relatedOrderId: orderId,
    relatedShipmentImageId: img.id,
    eventType: 'shipment_image_received',
    eventNote: orderId ? 'Auto-linked' : 'Awaiting order reference',
    actorType: 'telegram_admin',
    actorId: p.telegramUserId,
  });

  if (orderId) {
    await linkShipmentImageToOrder(supabase, p.merchantId, img.id, orderId, p.telegramUserId);
    return { status: 'linked', shipmentImageId: img.id, orderId };
  }

  return { status: 'awaiting_order_reference', shipmentImageId: img.id };
}

/**
 * Link shipment image to order: create order_shipment (image-first), update fulfillment, optionally send to customer.
 */
async function linkShipmentImageToOrder(
  supabase: SupabaseClient,
  merchantId: string,
  shipmentImageId: string,
  orderId: string,
  telegramUserId?: string | null
) {
  const now = new Date().toISOString();
  const { data: img } = await supabase
    .from('shipment_images')
    .select('image_url')
    .eq('id', shipmentImageId)
    .eq('merchant_id', merchantId)
    .single();
  if (!img) return;

  const { data: ship, error: shipErr } = await supabase
    .from('order_shipments')
    .insert({
      merchant_id: merchantId,
      order_id: orderId,
      shipment_method: 'manual_dispatch',
      shipment_status: 'shipped',
      shipped_at: now,
      shipment_proof_mode: 'image',
      shipment_image_id: shipmentImageId,
      created_by: null,
      updated_at: now,
    })
    .select('id')
    .single();

  if (shipErr || !ship) return;

  await supabase
    .from('orders')
    .update({ fulfillment_status: FULFILLMENT_STATUS.SHIPPED, updated_at: now })
    .eq('id', orderId)
    .eq('merchant_id', merchantId);

  await supabase
    .from('shipment_images')
    .update({ processing_status: 'linked', order_id: orderId, updated_at: now })
    .eq('id', shipmentImageId)
    .eq('merchant_id', merchantId);

  await supabase.from('order_fulfillment_events').insert({
    merchant_id: merchantId,
    order_id: orderId,
    shipment_id: ship.id,
    event_type: 'shipment_created',
    event_note: 'From Telegram shipment image',
    actor_type: 'merchant_admin',
    actor_id: null,
  });

  await telegram.recordTelegramOperationEvent(supabase, {
    merchantId,
    relatedOrderId: orderId,
    relatedShipmentImageId: shipmentImageId,
    eventType: 'shipment_image_linked',
    actorType: 'telegram_admin',
    actorId: telegramUserId,
  });

  const settings = await telegram.getMerchantTelegramSettings(supabase, merchantId);
  if (settings.telegram_auto_send_shipment_confirmation !== false) {
    await sendShipmentImageToCustomer(supabase, merchantId, orderId, ship.id, shipmentImageId, img.image_url);
  }
}

/** Send shipment confirmation (with image if available) to customer via channel (messages + API when env provided). */
export async function sendShipmentImageToCustomer(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  shipmentId: string,
  shipmentImageId: string,
  imageUrl: string | null,
  env?: Env
): Promise<{ sent: boolean }> {
  const { data: order } = await supabase
    .from('orders')
    .select('conversation_id')
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .single();
  if (!order?.conversation_id) return { sent: false };

  const text = 'Your order has been shipped. See the shipment slip below.';
  const bodyText = imageUrl ? text : 'Your order has been shipped.';

  if (env) {
    const result = await channelSender.sendChannelMessage({
      supabase,
      env,
      conversationId: order.conversation_id,
      payload: imageUrl
        ? { text: bodyText, media_url: imageUrl, message_type: 'image' }
        : { text: bodyText, message_type: 'text' },
    });
    const now = new Date().toISOString();
    await supabase
      .from('order_shipments')
      .update({ customer_notified_at: now, updated_at: now })
      .eq('id', shipmentId)
      .eq('merchant_id', merchantId);
    await supabase
      .from('shipment_images')
      .update({ processing_status: 'sent_to_customer', updated_at: now })
      .eq('id', shipmentImageId)
      .eq('merchant_id', merchantId);
    await supabase.from('order_fulfillment_events').insert({
      merchant_id: merchantId,
      order_id: orderId,
      shipment_id: shipmentId,
      event_type: 'tracking_sent_to_customer',
      event_note: 'Shipment image sent',
      actor_type: 'system',
      actor_id: null,
    });
    await telegram.recordTelegramOperationEvent(supabase, {
      merchantId,
      relatedOrderId: orderId,
      relatedShipmentImageId: shipmentImageId,
      eventType: 'shipment_confirmation_sent',
      actorType: 'system',
    });
    return { sent: result.sent };
  }

  const { error } = await supabase.from('messages').insert({
    merchant_id: merchantId,
    conversation_id: order.conversation_id,
    direction: 'outbound',
    content_type: imageUrl ? 'image' : 'text',
    content_text: bodyText,
    content_metadata: imageUrl ? { url: imageUrl } : undefined,
  });
  if (error) return { sent: false };

  const now = new Date().toISOString();
  await supabase
    .from('order_shipments')
    .update({ customer_notified_at: now, updated_at: now })
    .eq('id', shipmentId)
    .eq('merchant_id', merchantId);

  await supabase
    .from('shipment_images')
    .update({ processing_status: 'sent_to_customer', updated_at: now })
    .eq('id', shipmentImageId)
    .eq('merchant_id', merchantId);

  await supabase.from('order_fulfillment_events').insert({
    merchant_id: merchantId,
    order_id: orderId,
    shipment_id: shipmentId,
    event_type: 'tracking_sent_to_customer',
    event_note: 'Shipment image sent',
    actor_type: 'system',
    actor_id: null,
  });

  await telegram.recordTelegramOperationEvent(supabase, {
    merchantId,
    relatedOrderId: orderId,
    relatedShipmentImageId: shipmentImageId,
    eventType: 'shipment_confirmation_sent',
    actorType: 'system',
  });

  return { sent: true };
}

/**
 * Try to link a pending shipment image from a Telegram reply (order number).
 * Finds the most recent unlinked shipment image and links if order matches.
 */
export async function tryLinkFromTelegramReply(
  supabase: SupabaseClient,
  connection: telegram.TelegramConnectionRow,
  chatId: string,
  replyText: string
): Promise<boolean> {
  const ref = normalizeOrderReference(replyText);
  if (!ref) return false;

  const order = await findOrderByReference(supabase, connection.merchant_id, ref);
  if (!order) return false;

  const { data: pending } = await supabase
    .from('shipment_images')
    .select('id')
    .eq('merchant_id', connection.merchant_id)
    .eq('processing_status', 'awaiting_order_reference')
    .is('order_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pending) return false;

  await supabase
    .from('shipment_images')
    .update({ order_id: order.id, processing_status: 'linked', updated_at: new Date().toISOString() })
    .eq('id', pending.id)
    .eq('merchant_id', connection.merchant_id);

  await linkShipmentImageToOrder(supabase, connection.merchant_id, pending.id, order.id, null);
  return true;
}
