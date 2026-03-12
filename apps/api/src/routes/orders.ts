import { Hono } from 'hono';
import type { Env } from '../env.js';
import { authMiddleware, resolveMerchant, requireMerchantAdmin } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import * as orderService from '../services/orders.js';
import * as orderDraft from '../services/order-draft.js';
import * as telegram from '../services/telegram.js';
import { z } from 'zod';
import { confirmMatchBodySchema } from '@armai/shared';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../middleware/auth.js').AuthContext; merchantId: string };
}>();

app.use('/*', authMiddleware);
app.use('/*', resolveMerchant);
app.use('/*', requireMerchantAdmin);

app.post('/confirm-match', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = confirmMatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const result = await orderService.confirmMatch(supabase, merchantId, parsed.data.matching_result_id, parsed.data.confirm);
  if (parsed.data.confirm && result.orderId) {
    const order = await orderService.getOrder(supabase, merchantId, result.orderId);
    const { data: items } = await supabase.from('order_items').select('product_name_snapshot, quantity').eq('order_id', result.orderId);
    const itemsSummary = (items ?? []).map((i: { product_name_snapshot: string; quantity: number }) => `${i.product_name_snapshot} x${i.quantity}`).join(', ').slice(0, 200);
    telegram.notifyOrderPaidToTelegram(supabase, {
      merchantId,
      orderId: result.orderId,
      orderReferenceCode: order.reference_code ?? null,
      customerName: order.customer_name ?? null,
      amount: order.amount ?? null,
      paymentMethod: order.payment_method ?? null,
      itemsSummary,
    }).catch(() => {});
  }
  return c.json({ ok: true });
});

const draftOrderBodySchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  customerPsid: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      product_variant_id: z.string().uuid().nullable().optional(),
      product_name: z.string().min(1),
      quantity: z.number().int().min(1),
      unit_price: z.number().min(0),
    })
  ).min(1),
});

app.post('/draft', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = draftOrderBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const items = parsed.data.items.map((i) => ({
    product_id: i.product_id,
    product_variant_id: i.product_variant_id ?? null,
    product_name: i.product_name,
    quantity: i.quantity,
    unit_price: i.unit_price,
  }));
  const result = await orderDraft.createDraftOrder(supabase, {
    merchantId,
    conversationId: parsed.data.conversationId ?? null,
    customerPsid: parsed.data.customerPsid ?? null,
    customerName: parsed.data.customerName ?? null,
    items,
  });
  return c.json(result, 201);
});

export default app;
