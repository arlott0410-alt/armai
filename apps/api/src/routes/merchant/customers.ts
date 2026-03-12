import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import * as customerIdentity from '../../services/customer-identity.js';
import { updateMerchantCustomerBodySchema, createMerchantCustomerBodySchema } from '@armai/shared';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string };
}>();

/** POST /merchant/customers — create unified customer; optionally link a channel identity. */
app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createMerchantCustomerBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const auth = c.get('auth');
  const customerId = await customerIdentity.createMerchantCustomer(supabase, {
    merchantId,
    primaryDisplayName: parsed.data.primary_display_name ?? undefined,
    phoneNumber: parsed.data.phone_number ?? undefined,
    notes: parsed.data.notes ?? undefined,
  });
  if (parsed.data.link_channel_identity_id) {
    await customerIdentity.linkIdentityToCustomer(supabase, {
      merchantId,
      channelIdentityId: parsed.data.link_channel_identity_id,
      merchantCustomerId: customerId,
      actorId: auth?.userId ?? null,
    });
  }
  const { data: customer } = await supabase.from('merchant_customers').select('*').eq('id', customerId).single();
  return c.json({ customer: customer ?? {} }, 201);
});

/** GET /merchant/customers — list merchant customers (unified profiles). */
app.get('/', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 100);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const status = c.req.query('status') ?? 'active';
  const q = supabase
    .from('merchant_customers')
    .select('id, merchant_id, primary_display_name, phone_number, status, created_at, updated_at')
    .eq('merchant_id', merchantId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) q.eq('status', status);
  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ customers: data ?? [] });
});

/** GET /merchant/customers/:id — single customer with linked identities, order count, recent activity. */
app.get('/:id', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const id = c.req.param('id');
  const { data: customer, error: custErr } = await supabase
    .from('merchant_customers')
    .select('*')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single();
  if (custErr || !customer) return c.json({ error: 'Customer not found' }, 404);

  const [identities, orderCount, recentMessages, events] = await Promise.all([
    supabase
      .from('customer_channel_identities')
      .select('id, channel_type, external_user_id, channel_display_name, phone_number, first_seen_at, last_seen_at')
      .eq('merchant_customer_id', id)
      .eq('merchant_id', merchantId)
      .order('last_seen_at', { ascending: false }),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('merchant_customer_id', id),
    supabase
      .from('channel_messages')
      .select('id, channel_type, direction, message_type, text_content, created_at')
      .eq('merchant_id', merchantId)
      .eq('merchant_customer_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('customer_identity_events')
      .select('id, event_type, actor_type, created_at, reason')
      .eq('merchant_customer_id', id)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const orders = await supabase
    .from('orders')
    .select('id, status, amount, payment_status, fulfillment_status, created_at')
    .eq('merchant_id', merchantId)
    .eq('merchant_customer_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  return c.json({
    customer,
    identities: identities.data ?? [],
    orderCount: orderCount.count ?? 0,
    orders: orders.data ?? [],
    recentMessages: recentMessages.data ?? [],
    identityEvents: events.data ?? [],
  });
});

/** PATCH /merchant/customers/:id — update customer (name, phone, notes, status). */
app.patch('/:id', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateMerchantCustomerBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.primary_display_name !== undefined) update.primary_display_name = parsed.data.primary_display_name;
  if (parsed.data.phone_number !== undefined) {
    update.phone_number = parsed.data.phone_number;
    update.normalized_phone = customerIdentity.normalizePhone(parsed.data.phone_number);
  }
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;

  const { data, error } = await supabase
    .from('merchant_customers')
    .update(update)
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 400);
  if (!data) return c.json({ error: 'Customer not found' }, 404);
  return c.json({ customer: data });
});

export default app;
