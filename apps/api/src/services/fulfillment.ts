import type { SupabaseClient } from '@supabase/supabase-js';
import { FULFILLMENT_STATUS, SHIPMENT_STATUS } from '@armai/shared';
import type { CreateShipmentBody, UpdateShipmentBody } from '@armai/shared';
import type { Env } from '../env.js';
import * as channelSender from './channel-sender.js';

const FULFILLMENT_EVENT_TYPES = {
  PAYMENT_CONFIRMED: 'payment_confirmed',
  SHIPMENT_CREATED: 'shipment_created',
  TRACKING_SENT_TO_CUSTOMER: 'tracking_sent_to_customer',
  SHIPMENT_MARKED_SHIPPED: 'shipment_marked_shipped',
  SHIPMENT_MARKED_DELIVERED: 'shipment_marked_delivered',
  SHIPMENT_FAILED: 'shipment_failed',
} as const;

const ACTOR_TYPES = { system: 'system', merchant_admin: 'merchant_admin', ai_agent: 'ai_agent' } as const;

export async function recordFulfillmentEvent(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    orderId: string;
    shipmentId?: string | null;
    eventType: string;
    eventNote?: string | null;
    actorType: keyof typeof ACTOR_TYPES;
    actorId?: string | null;
  }
) {
  const { error } = await supabase.from('order_fulfillment_events').insert({
    merchant_id: p.merchantId,
    order_id: p.orderId,
    shipment_id: p.shipmentId ?? null,
    event_type: p.eventType,
    event_note: p.eventNote ?? null,
    actor_type: p.actorType,
    actor_id: p.actorId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function createShipment(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    orderId: string;
    body: CreateShipmentBody;
    createdBy?: string | null;
  }
) {
  const now = new Date().toISOString();
  const shippedAt = p.body.shipped_at ?? (p.body.tracking_number || p.body.courier_name ? now : null);
  const { data: row, error } = await supabase
    .from('order_shipments')
    .insert({
      merchant_id: p.merchantId,
      order_id: p.orderId,
      courier_name: p.body.courier_name ?? null,
      shipment_method: p.body.shipment_method ?? 'courier_tracking',
      tracking_number: p.body.tracking_number ?? null,
      tracking_url: p.body.tracking_url ?? null,
      shipping_note: p.body.shipping_note ?? null,
      shipment_status: shippedAt ? SHIPMENT_STATUS.SHIPPED : SHIPMENT_STATUS.PENDING,
      shipped_at: shippedAt,
      created_by: p.createdBy ?? null,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from('orders')
    .update({
      fulfillment_status: FULFILLMENT_STATUS.SHIPPED,
      updated_at: now,
    })
    .eq('id', p.orderId)
    .eq('merchant_id', p.merchantId);

  await recordFulfillmentEvent(supabase, {
    merchantId: p.merchantId,
    orderId: p.orderId,
    shipmentId: row.id,
    eventType: FULFILLMENT_EVENT_TYPES.SHIPMENT_CREATED,
    eventNote: null,
    actorType: 'merchant_admin',
    actorId: p.createdBy,
  });

  return row;
}

export async function updateShipment(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    shipmentId: string;
    body: UpdateShipmentBody;
  }
) {
  const now = new Date().toISOString();
  const { data: shipment, error: fetchErr } = await supabase
    .from('order_shipments')
    .select('id, order_id')
    .eq('id', p.shipmentId)
    .eq('merchant_id', p.merchantId)
    .single();
  if (fetchErr || !shipment) throw new Error('Shipment not found');

  const update: Record<string, unknown> = { updated_at: now };
  if (p.body.courier_name !== undefined) update.courier_name = p.body.courier_name;
  if (p.body.shipment_method !== undefined) update.shipment_method = p.body.shipment_method;
  if (p.body.tracking_number !== undefined) update.tracking_number = p.body.tracking_number;
  if (p.body.tracking_url !== undefined) update.tracking_url = p.body.tracking_url;
  if (p.body.shipping_note !== undefined) update.shipping_note = p.body.shipping_note;
  if (p.body.shipment_status !== undefined) update.shipment_status = p.body.shipment_status;
  if (p.body.shipped_at !== undefined) update.shipped_at = p.body.shipped_at;
  if (p.body.delivered_at !== undefined) update.delivered_at = p.body.delivered_at;

  const { data: updated, error: updateErr } = await supabase
    .from('order_shipments')
    .update(update)
    .eq('id', p.shipmentId)
    .eq('merchant_id', p.merchantId)
    .select()
    .single();
  if (updateErr) throw new Error(updateErr.message);

  if (p.body.shipment_status === SHIPMENT_STATUS.DELIVERED || p.body.delivered_at) {
    await supabase
      .from('orders')
      .update({ fulfillment_status: FULFILLMENT_STATUS.DELIVERED, updated_at: now })
      .eq('id', shipment.order_id)
      .eq('merchant_id', p.merchantId);
    await recordFulfillmentEvent(supabase, {
      merchantId: p.merchantId,
      orderId: shipment.order_id,
      shipmentId: p.shipmentId,
      eventType: FULFILLMENT_EVENT_TYPES.SHIPMENT_MARKED_DELIVERED,
      actorType: 'merchant_admin',
    });
  } else if (p.body.shipment_status === SHIPMENT_STATUS.FAILED) {
    await supabase
      .from('orders')
      .update({ fulfillment_status: FULFILLMENT_STATUS.DELIVERY_FAILED, updated_at: now })
      .eq('id', shipment.order_id)
      .eq('merchant_id', p.merchantId);
    await recordFulfillmentEvent(supabase, {
      merchantId: p.merchantId,
      orderId: shipment.order_id,
      shipmentId: p.shipmentId,
      eventType: FULFILLMENT_EVENT_TYPES.SHIPMENT_FAILED,
      actorType: 'merchant_admin',
    });
  } else if (p.body.shipped_at !== undefined || p.body.shipment_status === SHIPMENT_STATUS.SHIPPED) {
    await recordFulfillmentEvent(supabase, {
      merchantId: p.merchantId,
      orderId: shipment.order_id,
      shipmentId: p.shipmentId,
      eventType: FULFILLMENT_EVENT_TYPES.SHIPMENT_MARKED_SHIPPED,
      actorType: 'merchant_admin',
    });
  }

  return updated;
}

function formatShippingConfirmationMessage(shipment: {
  courier_name?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  shipping_note?: string | null;
}): string {
  if (shipment.tracking_number || shipment.tracking_url) {
    const lines = [
      'Order confirmed and shipped.',
      shipment.courier_name ? `Courier: ${shipment.courier_name}` : null,
      shipment.tracking_number ? `Tracking Number: ${shipment.tracking_number}` : null,
      shipment.tracking_url ? `Track here: ${shipment.tracking_url}` : null,
    ].filter(Boolean);
    return lines.join('\n');
  }
  return shipment.shipping_note
    ? `Your order has been shipped.\nDelivery details: ${shipment.shipping_note}`
    : 'Your order has been shipped.';
}

export async function sendShippingConfirmation(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    orderId: string;
    shipmentId: string;
  },
  env?: Env
): Promise<{ sent: boolean; message?: string }> {
  const { data: order } = await supabase
    .from('orders')
    .select('conversation_id')
    .eq('id', p.orderId)
    .eq('merchant_id', p.merchantId)
    .single();
  if (!order?.conversation_id) return { sent: false };

  const { data: shipment } = await supabase
    .from('order_shipments')
    .select('courier_name, tracking_number, tracking_url, shipping_note')
    .eq('id', p.shipmentId)
    .eq('merchant_id', p.merchantId)
    .single();
  if (!shipment) return { sent: false };

  const contentText = formatShippingConfirmationMessage(shipment);

  if (env) {
    const result = await channelSender.sendChannelMessage({
      supabase,
      env,
      conversationId: order.conversation_id,
      payload: { text: contentText, message_type: 'text' },
    });
    await recordFulfillmentEvent(supabase, {
      merchantId: p.merchantId,
      orderId: p.orderId,
      shipmentId: p.shipmentId,
      eventType: FULFILLMENT_EVENT_TYPES.TRACKING_SENT_TO_CUSTOMER,
      actorType: 'system',
    });
    return { sent: result.sent, message: contentText };
  }

  const { error } = await supabase.from('messages').insert({
    merchant_id: p.merchantId,
    conversation_id: order.conversation_id,
    direction: 'outbound',
    content_type: 'text',
    content_text: contentText,
  });
  if (error) throw new Error(error.message);

  await recordFulfillmentEvent(supabase, {
    merchantId: p.merchantId,
    orderId: p.orderId,
    shipmentId: p.shipmentId,
    eventType: FULFILLMENT_EVENT_TYPES.TRACKING_SENT_TO_CUSTOMER,
    actorType: 'system',
  });

  return { sent: true, message: contentText };
}
