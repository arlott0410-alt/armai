import { Hono } from 'hono';
import type { Env } from '../env.js';
import { authMiddleware, resolveMerchant, requireMerchantAdmin } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import * as merchantService from '../services/merchant.js';
import * as contextCache from '../services/ai-context-cache.js';
import { updateMerchantSettingsBodySchema } from '@armai/shared';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../middleware/auth.js').AuthContext; merchantId: string };
}>();

app.use('/*', authMiddleware);
app.use('/*', resolveMerchant);
app.use('/*', requireMerchantAdmin);

app.get('/', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const settings = await merchantService.getMerchantSettings(supabase, merchantId);
  return c.json(settings ?? { merchant_id: merchantId });
});

app.patch('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateMerchantSettingsBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.ai_system_prompt !== undefined) update.ai_system_prompt = parsed.data.ai_system_prompt;
  if (parsed.data.bank_parser_id !== undefined) update.bank_parser_id = parsed.data.bank_parser_id;
  if (parsed.data.webhook_verify_token !== undefined) update.webhook_verify_token = parsed.data.webhook_verify_token;
  if (parsed.data.auto_send_shipping_confirmation !== undefined) update.auto_send_shipping_confirmation = parsed.data.auto_send_shipping_confirmation;
  if (parsed.data.telegram_notify_order_paid !== undefined) update.telegram_notify_order_paid = parsed.data.telegram_notify_order_paid;
  if (parsed.data.telegram_allow_shipment_confirmation !== undefined) update.telegram_allow_shipment_confirmation = parsed.data.telegram_allow_shipment_confirmation;
  if (parsed.data.telegram_allow_ai_escalation !== undefined) update.telegram_allow_ai_escalation = parsed.data.telegram_allow_ai_escalation;
  if (parsed.data.telegram_require_authorized_admins !== undefined) update.telegram_require_authorized_admins = parsed.data.telegram_require_authorized_admins;
  if (parsed.data.telegram_auto_send_shipment_confirmation !== undefined) update.telegram_auto_send_shipment_confirmation = parsed.data.telegram_auto_send_shipment_confirmation;
  const { error } = await supabase.from('merchant_settings').upsert(
    { merchant_id: merchantId, ...update },
    { onConflict: 'merchant_id' }
  );
  if (error) return c.json({ error: error.message }, 400);
  contextCache.invalidateMerchant(merchantId);
  return c.json({ ok: true });
});

export default app;
