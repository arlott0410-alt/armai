import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { authMiddleware, resolveMerchant, requireMerchantAdmin } from '../../middleware/auth.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import * as knowledgeService from '../../services/knowledge.js';
import { merchantPromotionSchema } from '@armai/shared';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string };
}>();

app.use('/*', authMiddleware);
app.use('/*', resolveMerchant);
app.use('/*', requireMerchantAdmin);

app.get('/', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const activeOnly = c.req.query('activeOnly') !== 'false';
  const list = await knowledgeService.listPromotions(supabase, merchantId, activeOnly);
  return c.json({ promotions: list });
});

app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = merchantPromotionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const promotion = await knowledgeService.createPromotion(supabase, merchantId, parsed.data);
  return c.json(promotion, 201);
});

app.patch('/:promotionId', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = merchantPromotionSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const promotion = await knowledgeService.updatePromotion(supabase, merchantId, c.req.param('promotionId'), parsed.data);
  return c.json(promotion);
});

export default app;
