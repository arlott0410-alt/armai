import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { authMiddleware, resolveMerchant, requireMerchantAdmin } from '../../middleware/auth.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import * as merchantService from '../../services/merchant.js';
import * as aiContext from '../../services/ai-context.js';
import * as merchantDashboard from '../../services/merchant-dashboard.js';
import * as conversationRouter from '../../services/conversation-router.js';
import * as routerContextLoader from '../../services/router-context-loader.js';
import * as responseModeResolver from '../../services/response-mode-resolver.js';
import * as aiUsageLogging from '../../services/ai-usage-logging.js';
import * as contextCache from '../../services/ai-context-cache.js';
import * as routerMetrics from '../../services/router-metrics.js';
import productsRoutes from './products.js';
import categoriesRoutes from './categories.js';
import knowledgeRoutes from './knowledge.js';
import promotionsRoutes from './promotions.js';
import paymentAccountsRoutes from './payment-accounts.js';
import bankSyncRoutes from './bank-sync.js';
import paymentMethodSettingsRoutes from './payment-method-settings.js';
import ordersRoutes from './orders.js';
import shipmentsRoutes from './shipments.js';
import telegramRoutes from './telegram.js';
import whatsappRoutes from './whatsapp.js';
import customersRoutes from './customers.js';
import customerIdentitiesRoutes from './customer-identities.js';
import operationsFeedRoutes from './operations-feed.js';

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

app.get('/channels', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const [fbPages, waConnections] = await Promise.all([
    supabase.from('facebook_pages').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    supabase.from('whatsapp_connections').select('id, phone_number_id, business_account_name, is_active').eq('merchant_id', merchantId).order('created_at', { ascending: false }),
  ]);
  const facebookPageCount = fbPages.count ?? 0;
  const whatsappConnections = (waConnections.data ?? []).map((row) => ({
    id: row.id,
    phone_number_id: row.phone_number_id,
    business_account_name: row.business_account_name ?? null,
    is_active: row.is_active,
  }));
  return c.json({
    facebook: { pageCount: facebookPageCount },
    whatsapp: { connections: whatsappConnections },
  });
});

app.route('/orders', ordersRoutes);
app.route('/shipments', shipmentsRoutes);
app.route('/telegram', telegramRoutes);
app.route('/whatsapp', whatsappRoutes);
app.route('/customers', customersRoutes);
app.route('/customer-identities', customerIdentitiesRoutes);
app.route('/operations', operationsFeedRoutes);
app.route('/payment-method-settings', paymentMethodSettingsRoutes);

app.route('/bank-sync', bankSyncRoutes);

app.route('/products', productsRoutes);
app.route('/categories', categoriesRoutes);
app.route('/knowledge', knowledgeRoutes);
app.route('/promotions', promotionsRoutes);
app.route('/payment-accounts', paymentAccountsRoutes);

app.post('/ai/context', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    conversationId?: string;
    orderId?: string;
    lastMessageText?: string;
    channelType?: 'facebook' | 'whatsapp';
    messageType?: string;
  };
  const merchantId = c.get('merchantId');
  const supabase = getSupabaseAdmin(c.env);
  const conversationId = body.conversationId ?? null;
  const orderId = body.orderId ?? null;
  const lastMessageText = body.lastMessageText;
  const channelType = body.channelType ?? 'facebook';
  const messageType = body.messageType ?? 'text';

  const { data: settings } = await supabase.from('merchant_settings').select('ai_system_prompt').eq('merchant_id', merchantId).single();
  const merchantPrompt = settings?.ai_system_prompt ?? null;

  if (lastMessageText != null && lastMessageText !== '') {
    const routerCtx = await routerContextLoader.loadRouterEventContext(supabase, merchantId, conversationId, orderId);
    const event: conversationRouter.NormalizedIncomingEvent = {
      merchantId,
      channelType,
      conversationId,
      customerId: null,
      messageType,
      text: lastMessageText,
      mediaUrl: null,
      activeOrderId: routerCtx.activeOrderId,
      activeOrderPaymentStatus: routerCtx.activeOrderPaymentStatus,
      activeOrderFulfillmentStatus: routerCtx.activeOrderFulfillmentStatus,
      hasShipmentWithTracking: routerCtx.hasShipmentWithTracking,
      codEnabled: routerCtx.codEnabled,
    };
    const route = conversationRouter.routeIncomingConversationEvent(event);
    const faqs = (contextCache.get<Array<{ question: string; answer: string }>>(merchantId, 'faqs')) ?? [];
    const faqAnswer = responseModeResolver.getFaqAnswerForQuery(lastMessageText, faqs);
    const resolved = responseModeResolver.resolveLowCostResponse({
      routeCategory: route.routeCategory,
      responseMode: route.responseMode,
      templateHint: route.templateHint,
      builtContext: null,
      trackingNumber: routerCtx.trackingNumber,
      codEnabled: routerCtx.codEnabled,
      faqAnswer,
      greetingTemplate: null,
    });
    if (resolved.mode === 'template' && 'text' in resolved) {
      await aiUsageLogging.logAiUsage(supabase, {
        merchantId,
        conversationId,
        responseMode: 'template',
        routeCategory: route.routeCategory,
        aiCallReason: 'template',
      });
      return c.json({ responseMode: 'template' as const, text: resolved.text });
    }
    if (resolved.mode === 'escalation' && 'text' in resolved) {
      await aiUsageLogging.logAiUsage(supabase, {
        merchantId,
        conversationId,
        responseMode: 'escalation',
        routeCategory: route.routeCategory,
        aiCallReason: 'escalation',
      });
      return c.json({ responseMode: 'escalation' as const, text: resolved.text });
    }
    if (resolved.mode === 'retrieval' && resolved.text != null && !resolved.needAi) {
      await aiUsageLogging.logAiUsage(supabase, {
        merchantId,
        conversationId,
        responseMode: 'retrieval',
        routeCategory: route.routeCategory,
        aiCallReason: 'retrieval',
      });
      return c.json({ responseMode: 'retrieval' as const, text: resolved.text });
    }
    await aiUsageLogging.logAiUsage(supabase, {
      merchantId,
      conversationId,
      responseMode: 'ai',
      routeCategory: route.routeCategory,
      aiCallReason: 'selling_conversation',
    });
  }

  const context = await aiContext.buildAiContext(supabase, {
    merchantId,
    merchantPrompt,
    conversationId,
    orderId,
  });
  return c.json(context);
});

app.get('/ai/metrics', async (c) => {
  const merchantId = c.get('merchantId');
  const supabase = getSupabaseAdmin(c.env);
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const metrics = await routerMetrics.getRouterMetrics(supabase, merchantId, from, to);
  return c.json(metrics);
});

export default app;
