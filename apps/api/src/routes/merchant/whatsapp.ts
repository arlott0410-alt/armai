import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { whatsappConnectionUpsertSchema } from '@armai/shared';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string };
}>();

/** GET — list WhatsApp connections for merchant (no token values). */
app.get('/', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const { data: connections, error } = await supabase
    .from('whatsapp_connections')
    .select('id, merchant_id, phone_number_id, waba_id, business_account_name, is_active, webhook_verify_token, created_at, updated_at')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 400);
  const list = (connections ?? []).map((row) => ({
    id: row.id,
    merchant_id: row.merchant_id,
    phone_number_id: row.phone_number_id,
    waba_id: row.waba_id ?? null,
    business_account_name: row.business_account_name ?? null,
    is_active: row.is_active,
    has_webhook_verify_token: !!row.webhook_verify_token,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
  return c.json({ connections: list });
});

/** POST — create WhatsApp connection. */
app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = whatsappConnectionUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('whatsapp_connections')
    .insert({
      merchant_id: merchantId,
      phone_number_id: parsed.data.phone_number_id,
      waba_id: parsed.data.waba_id ?? null,
      business_account_name: parsed.data.business_account_name ?? null,
      access_token_reference: parsed.data.access_token_reference ?? null,
      webhook_verify_token: parsed.data.webhook_verify_token ?? null,
      is_active: parsed.data.is_active ?? true,
      updated_at: now,
    })
    .select('id, phone_number_id, is_active, created_at')
    .single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ connection: data }, 201);
});

/** PATCH /:id — update WhatsApp connection. */
app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = whatsappConnectionUpsertSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.phone_number_id !== undefined) update.phone_number_id = parsed.data.phone_number_id;
  if (parsed.data.waba_id !== undefined) update.waba_id = parsed.data.waba_id;
  if (parsed.data.business_account_name !== undefined) update.business_account_name = parsed.data.business_account_name;
  if (parsed.data.access_token_reference !== undefined) update.access_token_reference = parsed.data.access_token_reference;
  if (parsed.data.webhook_verify_token !== undefined) update.webhook_verify_token = parsed.data.webhook_verify_token;
  if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active;

  const { data, error } = await supabase
    .from('whatsapp_connections')
    .update(update)
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .select('id, phone_number_id, is_active, updated_at')
    .single();
  if (error) return c.json({ error: error.message }, 400);
  if (!data) return c.json({ error: 'Connection not found' }, 404);
  return c.json({ connection: data });
});

/** POST /test — verify connection (no outbound message; checks config). */
app.post('/test', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const { data: conn } = await supabase
    .from('whatsapp_connections')
    .select('id, phone_number_id, is_active')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!conn?.phone_number_id) {
    return c.json({ error: 'No active WhatsApp connection. Add a connection and set access token.' }, 400);
  }
  return c.json({
    ok: true,
    message: 'WhatsApp connection is configured. Send a message to your business number from WhatsApp to start a session; replies will be delivered via the webhook.',
  });
});

export default app;
