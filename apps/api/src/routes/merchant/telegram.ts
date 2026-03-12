import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import * as telegram from '../../services/telegram.js';
import {
  telegramConnectionPatchSchema,
  telegramAdminCreateSchema,
  telegramAdminPatchSchema,
} from '@armai/shared';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string };
}>();

/** GET /merchant/telegram — connection and settings summary (no token value). */
app.get('/', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const [conn, settings] = await Promise.all([
    telegram.getTelegramConnection(supabase, merchantId),
    telegram.getMerchantTelegramSettings(supabase, merchantId),
  ]);
  const connection = conn
    ? {
        id: conn.id,
        merchant_id: conn.merchant_id,
        telegram_group_id: conn.telegram_group_id,
        telegram_group_title: conn.telegram_group_title,
        is_active: conn.is_active,
        has_bot_token: !!conn.bot_token_encrypted_or_bound_reference,
        created_at: conn.created_at,
        updated_at: conn.updated_at,
      }
    : null;
  return c.json({ merchantId, connection, settings });
});

/** PATCH /merchant/telegram — update connection (group id, title, active; token optional). */
app.patch('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = telegramConnectionPatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.telegram_group_id !== undefined) update.telegram_group_id = parsed.data.telegram_group_id;
  if (parsed.data.telegram_group_title !== undefined) update.telegram_group_title = parsed.data.telegram_group_title;
  if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active;
  if (parsed.data.bot_token_encrypted_or_bound_reference !== undefined) {
    update.bot_token_encrypted_or_bound_reference = parsed.data.bot_token_encrypted_or_bound_reference;
  }

  const { data: existing } = await supabase
    .from('telegram_connections')
    .select('id')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('telegram_connections')
      .update(update)
      .eq('id', existing.id)
      .eq('merchant_id', merchantId);
    if (error) return c.json({ error: error.message }, 400);
  } else {
    if (!parsed.data.telegram_group_id) {
      return c.json({ error: 'telegram_group_id required to create connection' }, 400);
    }
    const { error } = await supabase.from('telegram_connections').insert({
      merchant_id: merchantId,
      telegram_group_id: parsed.data.telegram_group_id,
      telegram_group_title: parsed.data.telegram_group_title ?? null,
      is_active: parsed.data.is_active ?? true,
      bot_token_encrypted_or_bound_reference: parsed.data.bot_token_encrypted_or_bound_reference ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) return c.json({ error: error.message }, 400);
  }

  return c.json({ ok: true });
});

/** GET /merchant/telegram/admins */
app.get('/admins', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const { data, error } = await supabase
    .from('telegram_admins')
    .select('id, merchant_id, telegram_user_id, telegram_username, telegram_display_name, role, is_active, created_at, updated_at')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ admins: data ?? [] });
});

/** POST /merchant/telegram/admins */
app.post('/admins', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = telegramAdminCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const { data, error } = await supabase
    .from('telegram_admins')
    .insert({
      merchant_id: merchantId,
      telegram_user_id: parsed.data.telegram_user_id,
      telegram_username: parsed.data.telegram_username ?? null,
      telegram_display_name: parsed.data.telegram_display_name ?? null,
      role: parsed.data.role ?? 'operator',
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ admin: data }, 201);
});

/** PATCH /merchant/telegram/admins/:id */
app.patch('/admins/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = telegramAdminPatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.telegram_username !== undefined) update.telegram_username = parsed.data.telegram_username;
  if (parsed.data.telegram_display_name !== undefined) update.telegram_display_name = parsed.data.telegram_display_name;
  if (parsed.data.role !== undefined) update.role = parsed.data.role;
  if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active;

  const { data, error } = await supabase
    .from('telegram_admins')
    .update(update)
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 400);
  if (!data) return c.json({ error: 'Admin not found' }, 404);
  return c.json({ admin: data });
});

/** POST /merchant/telegram/test — send test message to group. */
app.post('/test', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const conn = await telegram.getTelegramConnection(supabase, merchantId);
  if (!conn?.bot_token_encrypted_or_bound_reference || !conn.is_active) {
    return c.json({ error: 'Telegram not configured or inactive' }, 400);
  }
  const result = await telegram.sendTelegramText(
    conn.bot_token_encrypted_or_bound_reference,
    conn.telegram_group_id,
    '<b>ArmAI</b> — Telegram connection test successful. You can use this group for order notifications and shipment slips.'
  );
  if (!result.ok) {
    return c.json({ error: result.error ?? 'Send failed' }, 400);
  }
  await telegram.recordTelegramOperationEvent(supabase, {
    merchantId,
    eventType: 'telegram_connected',
    eventNote: 'Test message sent',
    actorType: 'merchant_dashboard',
    actorId: c.get('auth')?.userId,
  });
  return c.json({ ok: true, sent: true });
});

export default app;
