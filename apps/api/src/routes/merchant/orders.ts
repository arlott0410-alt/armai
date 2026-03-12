import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import * as orderService from '../../services/orders.js';
import * as orderDetail from '../../services/order-detail.js';
import * as codSettings from '../../services/cod-settings.js';
import * as paymentMethodSwitch from '../../services/payment-method-switch.js';
import * as paymentAccounts from '../../services/payment-accounts.js';
import * as fulfillment from '../../services/fulfillment.js';
import * as telegram from '../../services/telegram.js';
import * as summaryUpdate from '../../services/summary-update.js';
import { PAYMENT_METHOD, PAYMENT_SWITCH_RESULT, ORDER_COD_STATUS, PAYMENT_STATUS, ORDER_STATUS } from '@armai/shared';
import { createShipmentBodySchema } from '@armai/shared';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string };
}>();

app.get('/', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const status = c.req.query('status');
  const fulfillment_status = c.req.query('fulfillment_status');
  const payment_method = c.req.query('payment_method');
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit'), 10) : undefined;
  const offset = c.req.query('offset') ? parseInt(c.req.query('offset'), 10) : undefined;
  let list = await orderService.listOrders(supabase, merchantId, { status, fulfillment_status, limit, offset });
  if (payment_method) {
    list = list.filter((o: { payment_method?: string }) => o.payment_method === payment_method);
  }
  return c.json({ orders: list });
});

app.get('/:orderId', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const orderId = c.req.param('orderId');
  const detail = await orderDetail.getOrderDetail(supabase, merchantId, orderId);
  return c.json(detail);
});

app.post('/:orderId/payment-method/switch', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const orderId = c.req.param('orderId');
  const body = (await c.req.json().catch(() => ({}))) as { desired_method?: string; requested_by?: string };
  const desiredMethod = (body.desired_method ?? 'prepaid_bank_transfer') as 'prepaid_bank_transfer' | 'prepaid_qr' | 'cod';
  const requestedBy = (body.requested_by ?? 'merchant_admin') as 'customer' | 'ai' | 'merchant_admin' | 'system';

  const order = await orderService.getOrder(supabase, merchantId, orderId);
  const cod = await codSettings.getMerchantCodSettings(supabase, merchantId);
  const { allCodAllowed, anyRequiresManualCod } = await paymentMethodSwitch.getOrderProductsCodEligibility(supabase, merchantId, orderId);
  const can = await paymentMethodSwitch.canSwitchPaymentMethod(supabase, {
    order: order as paymentMethodSwitch.OrderForSwitch,
    desiredMethod,
    codSettings: cod,
    orderAmount: Number(order.amount ?? 0),
    allProductsCodAllowed: allCodAllowed,
    anyProductRequiresManualCod: anyRequiresManualCod,
  });

  if (can.result === PAYMENT_SWITCH_RESULT.DENIED) {
    await orderDetail.recordPaymentMethodSwitch(supabase, {
      merchantId,
      orderId,
      fromMethod: order.payment_method,
      toMethod: desiredMethod,
      result: 'denied',
      reason: can.reason,
      requestedBy,
      requestedById: c.get('auth')?.userId,
    });
    return c.json({ ok: false, result: 'denied', reason: can.reason }, 400);
  }

  if (can.result === PAYMENT_SWITCH_RESULT.REQUIRES_MANUAL_CONFIRMATION && body.requested_by !== 'merchant_admin') {
    await orderDetail.recordPaymentMethodSwitch(supabase, {
      merchantId,
      orderId,
      fromMethod: order.payment_method,
      toMethod: desiredMethod,
      result: 'requires_manual_confirmation',
      reason: can.reason,
      requestedBy,
      requestedById: c.get('auth')?.userId,
    });
    return c.json({ ok: false, result: 'requires_manual_confirmation', reason: can.reason }, 202);
  }

  await orderDetail.recordPaymentMethodSwitch(supabase, {
    merchantId,
    orderId,
    fromMethod: order.payment_method,
    toMethod: desiredMethod,
    result: 'allowed',
    reason: null,
    requestedBy,
    requestedById: c.get('auth')?.userId,
  });

  if (desiredMethod === PAYMENT_METHOD.COD && cod) {
    await orderDetail.switchOrderToCod(supabase, merchantId, orderId, cod, Number(order.amount ?? 0));
  } else if (desiredMethod === PAYMENT_METHOD.PREPAID_BANK_TRANSFER || desiredMethod === PAYMENT_METHOD.PREPAID_QR) {
    const account = await paymentAccounts.selectAccountForOrder(supabase, merchantId, { totalAmount: Number(order.amount ?? 0) });
    if (!account) return c.json({ error: 'No payment account available' }, 400);
    await orderDetail.switchOrderToPrepaid(supabase, merchantId, orderId, account.id, Number(order.amount ?? 0), desiredMethod);
  }

  const updated = await orderDetail.getOrderDetail(supabase, merchantId, orderId);
  return c.json({ ok: true, order: updated });
});

app.patch('/:orderId/shipping-details', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const orderId = c.req.param('orderId');
  await orderService.getOrder(supabase, merchantId, orderId);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = {
    merchant_id: merchantId,
    order_id: orderId,
    recipient_name: body.recipient_name as string | undefined,
    phone_number: body.phone_number as string | undefined,
    province_or_prefecture: body.province_or_prefecture as string | undefined,
    district: body.district as string | undefined,
    village_or_area: body.village_or_area as string | undefined,
    street_address: body.street_address as string | undefined,
    landmark: body.landmark as string | undefined,
    address_text: body.address_text as string | undefined,
    delivery_notes: body.delivery_notes as string | undefined,
    shipping_method: body.shipping_method as string | undefined,
    shipping_fee: body.shipping_fee as number | undefined,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('order_shipping_details').upsert(payload, { onConflict: 'order_id' });
  if (error) return c.json({ error: error.message }, 400);
  const { data } = await supabase.from('order_shipping_details').select('*').eq('order_id', orderId).single();
  return c.json(data);
});

app.post('/:orderId/cod/confirm', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const orderId = c.req.param('orderId');
  const now = new Date().toISOString();
  const { data: cod } = await supabase
    .from('order_cod_details')
    .select('id')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .maybeSingle();
  if (!cod) return c.json({ error: 'No active COD details' }, 400);
  await supabase
    .from('order_cod_details')
    .update({ cod_status: ORDER_COD_STATUS.READY_TO_SHIP, cod_confirmed_at: now, ready_to_ship_at: now, updated_at: now })
    .eq('id', cod.id);
  await supabase
    .from('orders')
    .update({ payment_status: PAYMENT_STATUS.COD_READY_TO_SHIP, updated_at: now })
    .eq('id', orderId)
    .eq('merchant_id', merchantId);
  const detail = await orderDetail.getOrderDetail(supabase, merchantId, orderId);
  return c.json({ ok: true, order: detail });
});

app.post('/:orderId/cod/mark-shipped', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const orderId = c.req.param('orderId');
  const now = new Date().toISOString();
  const { data: cod } = await supabase
    .from('order_cod_details')
    .select('id')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .maybeSingle();
  if (!cod) return c.json({ error: 'No active COD details' }, 400);
  await supabase
    .from('order_cod_details')
    .update({ cod_status: ORDER_COD_STATUS.SHIPPED, shipped_at: now, updated_at: now })
    .eq('id', cod.id);
  await supabase
    .from('orders')
    .update({ payment_status: PAYMENT_STATUS.COD_SHIPPED, updated_at: now })
    .eq('id', orderId)
    .eq('merchant_id', merchantId);
  const detail = await orderDetail.getOrderDetail(supabase, merchantId, orderId);
  return c.json({ ok: true, order: detail });
});

app.post('/:orderId/cod/mark-collected', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const orderId = c.req.param('orderId');
  const body = (await c.req.json().catch(() => ({}))) as { collection_note?: string };
  const now = new Date().toISOString();
  const { data: cod } = await supabase
    .from('order_cod_details')
    .select('id')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .maybeSingle();
  if (!cod) return c.json({ error: 'No active COD details' }, 400);
  await supabase
    .from('order_cod_details')
    .update({
      cod_status: ORDER_COD_STATUS.COLLECTED,
      collected_at: now,
      collection_note: (body.collection_note as string) ?? null,
      updated_at: now,
    })
    .eq('id', cod.id);
  const { data: orderRow } = await supabase.from('orders').select('fulfillment_status').eq('id', orderId).eq('merchant_id', merchantId).single();
  const fulfillmentStatus = orderRow?.fulfillment_status == null ? 'pending_fulfillment' : undefined;
  await supabase
    .from('orders')
    .update({
      status: ORDER_STATUS.PAID,
      payment_status: PAYMENT_STATUS.COD_COLLECTED,
      ...(fulfillmentStatus && { fulfillment_status: fulfillmentStatus }),
      updated_at: now,
    })
    .eq('id', orderId)
    .eq('merchant_id', merchantId);
  const order = await orderService.getOrder(supabase, merchantId, orderId);
  const { data: items } = await supabase.from('order_items').select('product_name_snapshot, quantity').eq('order_id', orderId);
  const itemsSummary = (items ?? []).map((i: { product_name_snapshot: string; quantity: number }) => `${i.product_name_snapshot} x${i.quantity}`).join(', ').slice(0, 200);
  telegram.notifyOrderPaidToTelegram(supabase, {
    merchantId,
    orderId,
    orderReferenceCode: order.reference_code ?? null,
    customerName: order.customer_name ?? null,
    amount: order.amount ?? null,
    paymentMethod: order.payment_method ?? null,
    itemsSummary,
  }).catch(() => {});
  const summaryUpdate = await import('../../services/summary-update.js');
  summaryUpdate.refreshMerchantSummary(supabase, merchantId).catch(() => {});
  const detail = await orderDetail.getOrderDetail(supabase, merchantId, orderId);
  return c.json({ ok: true, order: detail });
});

app.post('/:orderId/cod/mark-failed', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const orderId = c.req.param('orderId');
  const now = new Date().toISOString();
  const { data: cod } = await supabase
    .from('order_cod_details')
    .select('id')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .maybeSingle();
  if (!cod) return c.json({ error: 'No active COD details' }, 400);
  await supabase
    .from('order_cod_details')
    .update({ cod_status: ORDER_COD_STATUS.DELIVERY_FAILED, updated_at: now })
    .eq('id', cod.id);
  await supabase
    .from('orders')
    .update({ payment_status: PAYMENT_STATUS.COD_FAILED, updated_at: now })
    .eq('id', orderId)
    .eq('merchant_id', merchantId);
  const detail = await orderDetail.getOrderDetail(supabase, merchantId, orderId);
  return c.json({ ok: true, order: detail });
});

app.get('/:orderId/shipments', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const orderId = c.req.param('orderId');
  await orderService.getOrder(supabase, merchantId, orderId);
  const { data } = await supabase
    .from('order_shipments')
    .select('*')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  return c.json({ shipments: data ?? [] });
});

app.post('/:orderId/shipments', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const orderId = c.req.param('orderId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = createShipmentBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  await orderService.getOrder(supabase, merchantId, orderId);
  const shipment = await fulfillment.createShipment(supabase, {
    merchantId,
    orderId,
    body: parsed.data,
    createdBy: c.get('auth')?.userId ?? null,
  });
  const { data: settings } = await supabase.from('merchant_settings').select('auto_send_shipping_confirmation').eq('merchant_id', merchantId).single();
  if (settings?.auto_send_shipping_confirmation) {
    try {
      await fulfillment.sendShippingConfirmation(supabase, { merchantId, orderId, shipmentId: shipment.id }, c.env);
    } catch {
      // non-fatal
    }
  }
  summaryUpdate.refreshMerchantSummary(supabase, merchantId).catch(() => {});
  const detail = await orderDetail.getOrderDetail(supabase, merchantId, orderId);
  return c.json({ shipment, order: detail }, 201);
});

export default app;
