import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import * as customerIdentity from '../../services/customer-identity.js';
import { linkIdentitiesBodySchema, unlinkIdentityBodySchema } from '@armai/shared';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string };
}>();

/** GET /merchant/customer-identities — list channel identities (optionally unlinked or by customer). */
app.get('/', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const merchantCustomerId = c.req.query('merchant_customer_id');
  const unlinkedOnly = c.req.query('unlinked') === 'true';
  let q = supabase
    .from('customer_channel_identities')
    .select('id, merchant_id, merchant_customer_id, channel_type, external_user_id, channel_display_name, phone_number, last_seen_at, created_at')
    .eq('merchant_id', merchantId)
    .order('last_seen_at', { ascending: false })
    .limit(100);
  if (merchantCustomerId) q = q.eq('merchant_customer_id', merchantCustomerId);
  if (unlinkedOnly) q = q.is('merchant_customer_id', null);
  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ identities: data ?? [] });
});

/** POST /merchant/customer-identities/link — manually link identity to customer. */
app.post('/link', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = linkIdentitiesBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const auth = c.get('auth');
  try {
    await customerIdentity.linkIdentityToCustomer(supabase, {
      merchantId,
      channelIdentityId: parsed.data.channel_identity_id,
      merchantCustomerId: parsed.data.merchant_customer_id,
      actorId: auth?.userId ?? null,
    });
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Link failed' }, 400);
  }
});

/** POST /merchant/customer-identities/unlink — remove link from identity. */
app.post('/unlink', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = unlinkIdentityBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const auth = c.get('auth');
  try {
    await customerIdentity.unlinkIdentity(supabase, {
      merchantId,
      channelIdentityId: parsed.data.channel_identity_id,
      actorId: auth?.userId ?? null,
    });
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Unlink failed' }, 400);
  }
});

/** GET /merchant/customer-identities/suggestions — unlinked identities with same normalized_phone as customer. */
app.get('/suggestions', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const merchantCustomerId = c.req.query('merchant_customer_id');
  if (!merchantCustomerId) return c.json({ suggestions: [] });
  const { data: customer } = await supabase
    .from('merchant_customers')
    .select('normalized_phone')
    .eq('id', merchantCustomerId)
    .eq('merchant_id', merchantId)
    .single();
  if (!customer?.normalized_phone) return c.json({ suggestions: [] });
  const { data: identities } = await supabase
    .from('customer_channel_identities')
    .select('id, channel_type, external_user_id, channel_display_name, normalized_phone, last_seen_at')
    .eq('merchant_id', merchantId)
    .is('merchant_customer_id', null)
    .eq('normalized_phone', customer.normalized_phone);
  return c.json({ suggestions: identities ?? [] });
});

export default app;
