import type { SupabaseClient } from '@supabase/supabase-js';
import { ORDER_STATUS } from '@armai/shared';
import * as paymentAccounts from './payment-accounts.js';

export interface DraftOrderItem {
  product_id: string;
  product_variant_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
}

/**
 * Create a draft order with line items and assign payment target. Does not mark paid.
 * Conversation ID optional (for chat-origin drafts).
 */
export async function createDraftOrder(
  supabase: SupabaseClient,
  payload: {
    merchantId: string;
    conversationId?: string | null;
    customerPsid?: string | null;
    customerName?: string | null;
    items: DraftOrderItem[];
  }
) {
  const { merchantId, conversationId, customerPsid, customerName, items } = payload;
  if (!items.length) throw new Error('At least one item required');
  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const account = await paymentAccounts.selectAccountForOrder(supabase, merchantId, { totalAmount: total });
  if (!account) throw new Error('No payment account configured for merchant');
  let merchantCustomerId: string | null = null;
  if (conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('merchant_customer_id')
      .eq('id', conversationId)
      .eq('merchant_id', merchantId)
      .single();
    merchantCustomerId = conv?.merchant_customer_id ?? null;
  }
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      merchant_id: merchantId,
      conversation_id: conversationId ?? null,
      merchant_customer_id: merchantCustomerId,
      customer_psid: customerPsid ?? null,
      customer_name: customerName ?? null,
      status: ORDER_STATUS.PENDING,
      amount: total,
      reference_code: null,
    })
    .select()
    .single();
  if (orderErr || !order) throw new Error(orderErr?.message ?? 'Failed to create order');
  for (const item of items) {
    const totalPrice = item.unit_price * item.quantity;
    await supabase.from('order_items').insert({
      merchant_id: merchantId,
      order_id: order.id,
      product_id: item.product_id,
      product_variant_id: item.product_variant_id ?? null,
      product_name_snapshot: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: totalPrice,
    });
  }
  const { error: targetErr } = await supabase.from('order_payment_targets').insert({
    merchant_id: merchantId,
    order_id: order.id,
    payment_account_id: account.id,
    expected_amount: total,
    expected_currency: account.currency,
    assignment_reason: 'draft_order_created',
  });
  if (targetErr) throw new Error(targetErr.message);
  return { order, paymentAccount: account };
}

/** Get active payment target for an order (for AI to send correct account to customer). Only returns if order is prepaid and target is active. */
export async function getOrderPaymentTarget(supabase: SupabaseClient, merchantId: string, orderId: string) {
  const { data: order } = await supabase
    .from('orders')
    .select('payment_method')
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .single();
  if (!order || order.payment_method === 'cod') return null;
  const { data, error } = await supabase
    .from('order_payment_targets')
    .select('*, merchant_payment_accounts(*)')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
