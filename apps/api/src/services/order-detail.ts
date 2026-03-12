import type { SupabaseClient } from '@supabase/supabase-js';
import * as orderService from './orders.js';
import * as orderDraft from './order-draft.js';
import * as codSettings from './cod-settings.js';
import * as paymentMethodSwitch from './payment-method-switch.js';
import { PAYMENT_METHOD, PAYMENT_STATUS } from '@armai/shared';

export async function getOrderDetail(supabase: SupabaseClient, merchantId: string, orderId: string) {
  const order = await orderService.getOrder(supabase, merchantId, orderId);
  const [shipping, codDetails, paymentTarget, paymentMethodEvents, shipments, fulfillmentEvents, telegramEvents, shipmentImages] = await Promise.all([
    supabase.from('order_shipping_details').select('*').eq('order_id', orderId).eq('merchant_id', merchantId).maybeSingle(),
    supabase.from('order_cod_details').select('*').eq('order_id', orderId).eq('merchant_id', merchantId).eq('is_active', true).maybeSingle(),
    orderDraft.getOrderPaymentTarget(supabase, merchantId, orderId),
    supabase.from('order_payment_method_events').select('*').eq('order_id', orderId).eq('merchant_id', merchantId).order('created_at', { ascending: false }),
    supabase.from('order_shipments').select('*').eq('order_id', orderId).eq('merchant_id', merchantId).order('created_at', { ascending: false }),
    supabase.from('order_fulfillment_events').select('*').eq('order_id', orderId).eq('merchant_id', merchantId).order('created_at', { ascending: false }),
    supabase.from('telegram_operation_events').select('*').eq('related_order_id', orderId).eq('merchant_id', merchantId).order('created_at', { ascending: false }),
    supabase.from('shipment_images').select('*').eq('order_id', orderId).eq('merchant_id', merchantId).order('created_at', { ascending: false }),
  ]);
  const items = await supabase.from('order_items').select('*').eq('order_id', orderId);
  return {
    ...order,
    order_items: items.data ?? [],
    shipping_details: shipping.data ?? null,
    cod_details: codDetails.data ?? null,
    payment_target: paymentTarget,
    payment_method_events: paymentMethodEvents.data ?? [],
    shipments: shipments.data ?? [],
    fulfillment_events: fulfillmentEvents.data ?? [],
    telegram_operation_events: telegramEvents.data ?? [],
    shipment_images: shipmentImages.data ?? [],
  };
}

export async function recordPaymentMethodSwitch(
  supabase: SupabaseClient,
  params: {
    merchantId: string;
    orderId: string;
    fromMethod: string;
    toMethod: string;
    result: string;
    reason: string | null;
    requestedBy: string;
    requestedById?: string | null;
  }
) {
  const { error } = await supabase.from('order_payment_method_events').insert({
    merchant_id: params.merchantId,
    order_id: params.orderId,
    from_method: params.fromMethod,
    to_method: params.toMethod,
    switch_result: params.result,
    reason: params.reason ?? null,
    requested_by_type: params.requestedBy,
    requested_by_id: params.requestedById ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Execute switch to COD: invalidate prepaid target, create COD details, update order. */
export async function switchOrderToCod(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  codSettings: codSettings.MerchantCodSettingsRow,
  orderAmount: number
) {
  const now = new Date().toISOString();
  const { data: targets } = await supabase
    .from('order_payment_targets')
    .select('id')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId)
    .eq('is_active', true);
  for (const t of targets ?? []) {
    await supabase
      .from('order_payment_targets')
      .update({ is_active: false, invalidated_at: now, invalidation_reason: 'switched_to_cod', updated_at: now })
      .eq('id', t.id);
  }
  const codFee = codSettings.cod_fee_amount ?? 0;
  await supabase.from('order_cod_details').insert({
    merchant_id: merchantId,
    order_id: orderId,
    is_active: true,
    cod_amount: orderAmount,
    cod_fee: codFee,
    cod_status: 'pending_customer_details',
    requires_manual_confirmation: codSettings.cod_requires_manual_confirmation ?? false,
  });
  const { data: order } = await supabase.from('orders').select('payment_switch_count').eq('id', orderId).eq('merchant_id', merchantId).single();
  const paymentStatus = codSettings.cod_requires_manual_confirmation ? PAYMENT_STATUS.COD_PENDING_CONFIRMATION : PAYMENT_STATUS.COD_READY_TO_SHIP;
  await supabase
    .from('orders')
    .update({
      payment_method: PAYMENT_METHOD.COD,
      payment_status: paymentStatus,
      payment_switch_count: (order?.payment_switch_count ?? 0) + 1,
      updated_at: now,
    })
    .eq('id', orderId)
    .eq('merchant_id', merchantId);
}

/** Execute switch to prepaid: supersede COD details, create new active payment target. */
export async function switchOrderToPrepaid(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  paymentAccountId: string,
  expectedAmount: number,
  method: 'prepaid_bank_transfer' | 'prepaid_qr'
) {
  const now = new Date().toISOString();
  const { data: codRows } = await supabase
    .from('order_cod_details')
    .select('id')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId)
    .eq('is_active', true);
  for (const row of codRows ?? []) {
    await supabase
      .from('order_cod_details')
      .update({ is_active: false, superseded_at: now, superseded_reason: 'switched_to_prepaid', updated_at: now })
      .eq('id', row.id);
  }
  await supabase.from('order_payment_targets').insert({
    merchant_id: merchantId,
    order_id: orderId,
    payment_account_id: paymentAccountId,
    expected_amount: expectedAmount,
    expected_currency: 'THB',
    assignment_reason: 'payment_method_switch_to_prepaid',
    is_active: true,
  });
  const { data: order } = await supabase.from('orders').select('payment_switch_count').eq('id', orderId).eq('merchant_id', merchantId).single();
  await supabase
    .from('orders')
    .update({
      payment_method: method,
      payment_status: PAYMENT_STATUS.PENDING_TRANSFER,
      payment_switch_count: (order?.payment_switch_count ?? 0) + 1,
      updated_at: now,
    })
    .eq('id', orderId)
    .eq('merchant_id', merchantId);
}
