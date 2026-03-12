/**
 * Load fresh-from-DB context for router and low-cost resolver. Never use cache for this.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import * as codSettings from './cod-settings.js';

export interface RouterEventContext {
  activeOrderId: string | null;
  activeOrderPaymentStatus: string | null;
  activeOrderFulfillmentStatus: string | null;
  hasShipmentWithTracking: boolean;
  codEnabled: boolean;
  trackingNumber: string | null;
}

export async function loadRouterEventContext(
  supabase: SupabaseClient,
  merchantId: string,
  conversationId: string | null,
  orderId: string | null
): Promise<RouterEventContext> {
  const resolveOrderId = orderId ?? (conversationId
    ? (await supabase
        .from('orders')
        .select('id')
        .eq('merchant_id', merchantId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      ).data?.id
    : null);

  let activeOrderId: string | null = null;
  let activeOrderPaymentStatus: string | null = null;
  let activeOrderFulfillmentStatus: string | null = null;
  let trackingNumber: string | null = null;

  if (resolveOrderId) {
    const { data: order } = await supabase
      .from('orders')
      .select('id, payment_status, fulfillment_status')
      .eq('id', resolveOrderId)
      .eq('merchant_id', merchantId)
      .single();
    if (order) {
      activeOrderId = order.id;
      activeOrderPaymentStatus = order.payment_status ?? null;
      activeOrderFulfillmentStatus = order.fulfillment_status ?? null;
    }
    const { data: ship } = await supabase
      .from('order_shipments')
      .select('tracking_number')
      .eq('order_id', resolveOrderId)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ship?.tracking_number) trackingNumber = ship.tracking_number;
  }

  const codRow = await codSettings.getMerchantCodSettings(supabase, merchantId);
  const codEnabled = codRow?.enable_cod ?? false;

  return {
    activeOrderId,
    activeOrderPaymentStatus,
    activeOrderFulfillmentStatus,
    hasShipmentWithTracking: !!trackingNumber,
    codEnabled,
    trackingNumber,
  };
}
