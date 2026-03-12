import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import * as fulfillment from '../../services/fulfillment.js';
import { updateShipmentBodySchema } from '@armai/shared';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string };
}>();

app.patch('/:shipmentId', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const shipmentId = c.req.param('shipmentId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateShipmentBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const shipment = await fulfillment.updateShipment(supabase, { merchantId, shipmentId, body: parsed.data });
  return c.json({ shipment });
});

app.post('/:shipmentId/send-confirmation', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const shipmentId = c.req.param('shipmentId');
  const { data: ship } = await supabase
    .from('order_shipments')
    .select('order_id')
    .eq('id', shipmentId)
    .eq('merchant_id', merchantId)
    .single();
  if (!ship) return c.json({ error: 'Shipment not found' }, 404);
  const result = await fulfillment.sendShippingConfirmation(supabase, { merchantId, orderId: ship.order_id, shipmentId }, c.env);
  return c.json(result);
});

export default app;
