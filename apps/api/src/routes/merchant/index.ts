import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { authMiddleware, resolveMerchant, requireMerchantAdmin } from '../../middleware/auth.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import * as merchantService from '../../services/merchant.js';
import * as orderService from '../../services/orders.js';
import * as aiContext from '../../services/ai-context.js';
import * as merchantDashboard from '../../services/merchant-dashboard.js';
import productsRoutes from './products.js';
import categoriesRoutes from './categories.js';
import knowledgeRoutes from './knowledge.js';
import promotionsRoutes from './promotions.js';
import paymentAccountsRoutes from './payment-accounts.js';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string };
}>();

app.use('/*', authMiddleware);
app.use('/*', resolveMerchant);
app.use('/*', requireMerchantAdmin);

app.get('/dashboard', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const [summary, readiness, settings] = await Promise.all([
    merchantDashboard.getMerchantDashboardSummary(supabase, merchantId),
    merchantDashboard.getMerchantReadiness(supabase, merchantId),
    merchantService.getMerchantSettings(supabase, merchantId),
  ]);
  return c.json({ merchantId, settings, summary, readiness });
});

app.get('/readiness', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const readiness = await merchantDashboard.getMerchantReadiness(supabase, merchantId);
  return c.json({ readiness });
});

app.get('/orders', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const status = c.req.query('status');
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit'), 10) : 50;
  const list = await orderService.listOrders(supabase, merchantId, { status, limit });
  return c.json({ orders: list });
});

app.get('/orders/:orderId', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const orderId = c.req.param('orderId');
  const order = await orderService.getOrder(supabase, merchantId, orderId);
  return c.json(order);
});

app.get('/bank-sync', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 100);
  const { data: transactions } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('transaction_at', { ascending: false })
    .limit(limit);
  const { data: matchings } = await supabase
    .from('matching_results')
    .select('*, orders(*), bank_transactions(*)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return c.json({ bankTransactions: transactions ?? [], matchingResults: matchings ?? [] });
});

app.route('/products', productsRoutes);
app.route('/categories', categoriesRoutes);
app.route('/knowledge', knowledgeRoutes);
app.route('/promotions', promotionsRoutes);
app.route('/payment-accounts', paymentAccountsRoutes);

app.post('/ai/context', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const merchantId = c.get('merchantId');
  const supabase = getSupabaseAdmin(c.env);
  const { data: settings } = await supabase.from('merchant_settings').select('ai_system_prompt').eq('merchant_id', merchantId).single();
  const context = await aiContext.buildAiContext(supabase, {
    merchantId,
    merchantPrompt: settings?.ai_system_prompt ?? null,
    conversationId: (body as { conversationId?: string }).conversationId ?? null,
    orderId: (body as { orderId?: string }).orderId ?? null,
  });
  return c.json(context);
});

export default app;
