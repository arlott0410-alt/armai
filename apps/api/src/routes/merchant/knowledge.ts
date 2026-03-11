import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { authMiddleware, resolveMerchant, requireMerchantAdmin } from '../../middleware/auth.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import * as knowledgeService from '../../services/knowledge.js';
import { merchantFaqSchema, merchantKnowledgeEntrySchema } from '@armai/shared';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string };
}>();

app.use('/*', authMiddleware);
app.use('/*', resolveMerchant);
app.use('/*', requireMerchantAdmin);

app.get('/faqs', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const activeOnly = c.req.query('activeOnly') !== 'false';
  const list = await knowledgeService.listFaqs(supabase, merchantId, activeOnly);
  return c.json({ faqs: list });
});

app.post('/faqs', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = merchantFaqSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const faq = await knowledgeService.createFaq(supabase, merchantId, parsed.data);
  return c.json(faq, 201);
});

app.patch('/faqs/:faqId', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = merchantFaqSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const faq = await knowledgeService.updateFaq(supabase, merchantId, c.req.param('faqId'), parsed.data);
  return c.json(faq);
});

app.get('/entries', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const type = c.req.query('type');
  const activeOnly = c.req.query('activeOnly') !== 'false';
  const list = await knowledgeService.listKnowledgeEntries(supabase, merchantId, { type, activeOnly });
  return c.json({ entries: list });
});

app.post('/entries', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = merchantKnowledgeEntrySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const entry = await knowledgeService.createKnowledgeEntry(supabase, merchantId, parsed.data);
  return c.json(entry, 201);
});

app.patch('/entries/:entryId', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = merchantKnowledgeEntrySchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const entry = await knowledgeService.updateKnowledgeEntry(supabase, merchantId, c.req.param('entryId'), parsed.data);
  return c.json(entry);
});

export default app;
