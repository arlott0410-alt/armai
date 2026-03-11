import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { authMiddleware, requireSuperAdmin } from '../../middleware/auth.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import * as merchantService from '../../services/merchant.js';
import * as supportService from '../../services/support.js';
import * as superDashboard from '../../services/super-dashboard.js';
import * as billingService from '../../services/billing.js';
import { createMerchantBodySchema, updateMerchantPlanBodySchema, createBillingEventBodySchema, createInternalNoteBodySchema } from '@armai/shared';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../../middleware/auth.js').AuthContext };
}>();

app.use('/*', authMiddleware);
app.use('/*', requireSuperAdmin);

app.get('/dashboard', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const summary = await superDashboard.getSuperDashboardSummary(supabase);
  const merchantCount = summary.setupHealth.length;
  return c.json({
    mrr: summary.kpis.mrrThisMonth,
    merchantCount,
    activeMerchants: summary.kpis.activeMerchants,
    systemHealth: 'ok',
    kpis: summary.kpis,
    revenue: summary.revenue,
    billingHealth: summary.billingHealth,
    setupHealth: summary.setupHealth,
    recentActivity: summary.recentActivity,
  });
});

app.get('/merchants', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const list = await superDashboard.getMerchantsExpandedList(supabase);
  return c.json({ merchants: list });
});

app.post('/merchants', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createMerchantBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }
  const supabase = getSupabaseAdmin(c.env);
  const auth = c.get('auth');
  try {
    const { merchantId } = await merchantService.createMerchant(supabase, parsed.data);
    const userId = await createAuthUserAndMembership(c.env, parsed.data);
    await supabase.from('merchant_members').insert({
      merchant_id: merchantId,
      user_id: userId,
      role: 'merchant_admin',
    });
    await supabase.from('merchant_settings').insert({ merchant_id: merchantId });
    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('merchant_plans').insert({
      merchant_id: merchantId,
      plan_code: 'starter',
      billing_status: 'trialing',
      monthly_price_usd: 0,
      currency: 'THB',
      trial_ends_at: trialEnds,
      current_period_end: trialEnds,
      next_billing_at: trialEnds,
      is_auto_renew: true,
    });
    await supportService.logAudit(supabase, {
      actorId: auth.userId,
      action: 'merchant_created',
      resourceType: 'merchant',
      resourceId: merchantId,
      details: { slug: parsed.data.slug },
    });
    return c.json({ merchantId, userId }, 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Failed' }, 400);
  }
});

app.get('/merchants/:id', async (c) => {
  const merchantId = c.req.param('id');
  const supabase = getSupabaseAdmin(c.env);
  try {
    const [merchant, plan, settings, notes, billingEvents, orderSummary, supportHistory] = await Promise.all([
      merchantService.getMerchantById(supabase, merchantId),
      billingService.getMerchantPlan(supabase, merchantId),
      merchantService.getMerchantSettings(supabase, merchantId),
      billingService.listInternalNotes(supabase, merchantId, { limit: 20 }),
      billingService.listBillingEvents(supabase, merchantId, { limit: 20 }),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('merchant_id', merchantId).then((r) => ({ count: r.count ?? 0 })),
      supabase.from('support_access_logs').select('id, actor_id, started_at, ended_at').eq('merchant_id', merchantId).order('started_at', { ascending: false }).limit(10),
    ]);
    const productCount = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId);
    const paymentCount = await supabase.from('merchant_payment_accounts').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId);
    return c.json({
      merchant,
      plan,
      settings,
      notes: notes ?? [],
      billingEvents: billingEvents ?? [],
      orderSummary: { total: (orderSummary as { count: number }).count ?? 0 },
      productCount: (productCount.count as number) ?? 0,
      paymentAccountCount: (paymentCount.count as number) ?? 0,
      supportAccessHistory: supportHistory.data ?? [],
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Not found' }, 404);
  }
});

app.patch('/merchants/:id', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const supabase = getSupabaseAdmin(c.env);
  const auth = c.get('auth');
  const planUpdate = updateMerchantPlanBodySchema.safeParse(body);
  if (planUpdate.success) {
    await billingService.upsertMerchantPlan(supabase, merchantId, planUpdate.data);
    await supportService.logAudit(supabase, { actorId: auth.userId, action: 'merchant_updated', resourceType: 'merchant', resourceId: merchantId, details: { plan: planUpdate.data } });
  }
  if (typeof body.billing_status === 'string' && ['active', 'past_due', 'trialing', 'cancelled'].includes(body.billing_status)) {
    await supabase.from('merchants').update({ billing_status: body.billing_status, updated_at: new Date().toISOString() }).eq('id', merchantId);
    await supabase.from('merchant_plans').update({ billing_status: body.billing_status, updated_at: new Date().toISOString() }).eq('merchant_id', merchantId);
  }
  return c.json({ ok: true });
});

app.get('/merchants/:id/billing', async (c) => {
  const merchantId = c.req.param('id');
  const supabase = getSupabaseAdmin(c.env);
  const events = await billingService.listBillingEvents(supabase, merchantId, { limit: 50 });
  return c.json({ events });
});

app.post('/merchants/:id/billing', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = createBillingEventBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const supabase = getSupabaseAdmin(c.env);
  const event = await billingService.createBillingEvent(supabase, merchantId, parsed.data);
  return c.json(event, 201);
});

app.get('/merchants/:id/notes', async (c) => {
  const merchantId = c.req.param('id');
  const supabase = getSupabaseAdmin(c.env);
  const notes = await billingService.listInternalNotes(supabase, merchantId, { limit: 50 });
  return c.json({ notes });
});

app.post('/merchants/:id/notes', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = createInternalNoteBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed' }, 400);
  const supabase = getSupabaseAdmin(c.env);
  const auth = c.get('auth');
  const note = await billingService.addInternalNote(supabase, merchantId, auth.userId, parsed.data.note);
  return c.json(note, 201);
});

app.get('/billing/events', async (c) => {
  const merchantId = c.req.query('merchantId');
  const supabase = getSupabaseAdmin(c.env);
  if (merchantId) {
    const events = await billingService.listBillingEvents(supabase, merchantId, { limit: 100 });
    return c.json({ events });
  }
  const { data } = await supabase.from('merchant_billing_events').select('*').order('created_at', { ascending: false }).limit(100);
  return c.json({ events: data ?? [] });
});

app.get('/audit', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 100);
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ logs: data ?? [] });
});

async function createAuthUserAndMembership(
  env: Env,
  input: { admin_email: string; admin_password: string; admin_full_name?: string }
): Promise<string> {
  const supabase = getSupabaseAdmin(env);
  const { data: authData, error } = await supabase.auth.admin.createUser({
    email: input.admin_email,
    password: input.admin_password,
    email_confirm: true,
    user_metadata: { full_name: input.admin_full_name },
  });
  if (error || !authData?.user) {
    throw new Error(error?.message ?? 'Failed to create auth user');
  }
  const userId = authData.user.id;
  await supabase.from('profiles').upsert({
    id: userId,
    email: input.admin_email,
    full_name: input.admin_full_name ?? null,
    role: 'merchant_admin',
    updated_at: new Date().toISOString(),
  });
  return userId;
}

export default app;
