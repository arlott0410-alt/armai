import type { SupabaseClient } from '@supabase/supabase-js';

export interface SuperDashboardKPIs {
  mrrThisMonth: number;
  activeMerchants: number;
  trialingMerchants: number;
  pastDueMerchants: number;
  dueInNext7Days: number;
  newMerchantsThisMonth: number;
  activationReadyCount: number;
}

export interface MerchantBillingHealth {
  dueSoon: { merchantId: string; name: string; nextBillingAt: string | null }[];
  overdue: { merchantId: string; name: string; nextBillingAt: string | null }[];
  trialEndingSoon: { merchantId: string; name: string; trialEndsAt: string | null }[];
}

export interface SetupHealthItem {
  merchantId: string;
  name: string;
  slug: string;
  missingProducts: boolean;
  noPaymentAccount: boolean;
  noAiPrompt: boolean;
  incompleteSetup: boolean;
}

export interface RecentActivityItem {
  type: 'merchant_created' | 'support_access' | 'billing_updated' | 'audit';
  id: string;
  at: string;
  merchantId?: string;
  merchantName?: string;
  details?: Record<string, unknown>;
}

const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

export async function getSuperDashboardSummary(supabase: SupabaseClient): Promise<{
  kpis: SuperDashboardKPIs;
  revenue: { currentMonthMRR: number; expectedNextBilling: number };
  billingHealth: MerchantBillingHealth;
  setupHealth: SetupHealthItem[];
  recentActivity: RecentActivityItem[];
}> {
  const [merchants, plans, productCounts, paymentCounts, settings, auditRows, supportRows] = await Promise.all([
    supabase.from('merchants').select('id, name, slug, billing_status, created_at').order('created_at', { ascending: false }),
    supabase.from('merchant_plans').select('merchant_id, billing_status, monthly_price_usd, trial_ends_at, next_billing_at'),
    supabase.from('products').select('merchant_id').then((r) => (r.data ?? []).reduce((acc: Record<string, number>, row: { merchant_id: string }) => {
      acc[row.merchant_id] = (acc[row.merchant_id] ?? 0) + 1;
      return acc;
    }, {})),
    supabase.from('merchant_payment_accounts').select('merchant_id').then((r) => (r.data ?? []).reduce((acc: Record<string, number>, row: { merchant_id: string }) => {
      acc[row.merchant_id] = (acc[row.merchant_id] ?? 0) + 1;
      return acc;
    }, {})),
    supabase.from('merchant_settings').select('merchant_id, ai_system_prompt').then((r) => {
      const map: Record<string, { ai_system_prompt: string | null }> = {};
      (r.data ?? []).forEach((row: { merchant_id: string; ai_system_prompt: string | null }) => { map[row.merchant_id] = { ai_system_prompt: row.ai_system_prompt }; });
      return map;
    }),
    supabase.from('audit_logs').select('id, action, resource_type, resource_id, details, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('support_access_logs').select('id, merchant_id, started_at').order('started_at', { ascending: false }).limit(10),
  ]);

  const merchantList = merchants.data ?? [];
  const planList = plans.data ?? [];
  const planByMerchant: Record<string, { billing_status: string; monthly_price_usd?: number; trial_ends_at?: string | null; next_billing_at?: string | null }> = {};
  planList.forEach((p: { merchant_id: string; billing_status: string; monthly_price_usd?: number; trial_ends_at?: string | null; next_billing_at?: string | null }) => {
    planByMerchant[p.merchant_id] = p;
  });

  let mrrThisMonth = 0;
  let activeMerchants = 0;
  let trialingMerchants = 0;
  let pastDueMerchants = 0;
  let dueInNext7Days = 0;
  let newMerchantsThisMonth = 0;
  let activationReadyCount = 0;

  const dueSoon: MerchantBillingHealth['dueSoon'] = [];
  const overdue: MerchantBillingHealth['overdue'] = [];
  const trialEndingSoon: MerchantBillingHealth['trialEndingSoon'] = [];
  const setupHealth: SetupHealthItem[] = [];

  for (const m of merchantList) {
    const plan = planByMerchant[m.id];
    const price = (plan?.monthly_price_usd as number) ?? 0;
    const status = (m as { billing_status: string }).billing_status ?? plan?.billing_status ?? 'trialing';
    if (status === 'active') {
      activeMerchants++;
      mrrThisMonth += price;
    } else if (status === 'trialing') trialingMerchants++;
    else if (status === 'past_due') pastDueMerchants++;

    const nextBilling = plan?.next_billing_at ?? null;
    if (nextBilling && nextBilling <= in7Days && nextBilling >= now.toISOString()) dueInNext7Days++;
    if (nextBilling && nextBilling < now.toISOString() && status !== 'cancelled') overdue.push({ merchantId: m.id, name: (m as { name: string }).name, nextBillingAt: nextBilling });
    else if (nextBilling && nextBilling <= in7Days) dueSoon.push({ merchantId: m.id, name: (m as { name: string }).name, nextBillingAt: nextBilling });

    const trialEnds = plan?.trial_ends_at ?? null;
    if (trialEnds && trialEnds <= in7Days && trialEnds >= now.toISOString()) trialEndingSoon.push({ merchantId: m.id, name: (m as { name: string }).name, trialEndsAt: trialEnds });

    const created = (m as { created_at: string }).created_at;
    if (created >= startOfMonth) newMerchantsThisMonth++;

    const productCount = productCounts[m.id] ?? 0;
    const paymentCount = paymentCounts[m.id] ?? 0;
    const hasPrompt = !!(settings[m.id]?.ai_system_prompt?.trim());
    const missingProducts = productCount === 0;
    const noPaymentAccount = paymentCount === 0;
    const noAiPrompt = !hasPrompt;
    const incompleteSetup = missingProducts || noPaymentAccount || noAiPrompt;
    if (!incompleteSetup) activationReadyCount++;
    setupHealth.push({
      merchantId: m.id,
      name: (m as { name: string }).name,
      slug: (m as { slug: string }).slug,
      missingProducts,
      noPaymentAccount,
      noAiPrompt,
      incompleteSetup,
    });
  }

  const expectedNextBilling = merchantList.reduce((sum, m) => {
    const plan = planByMerchant[m.id];
    const status = (m as { billing_status: string }).billing_status ?? plan?.billing_status;
    if (status !== 'active' && status !== 'trialing') return sum;
    return sum + ((plan?.monthly_price_usd as number) ?? 0);
  }, 0);

  const recentActivity: RecentActivityItem[] = [];
  (auditRows.data ?? []).slice(0, 15).forEach((a: { id: string; action: string; resource_id: string | null; details: Record<string, unknown> | null; created_at: string }) => {
    recentActivity.push({
      type: a.action === 'support_access_merchant' ? 'support_access' : a.action === 'merchant_created' ? 'merchant_created' : 'audit',
      id: a.id,
      at: a.created_at,
      merchantId: a.resource_id ?? undefined,
      details: a.details ?? undefined,
    });
  });
  (supportRows.data ?? []).slice(0, 5).forEach((s: { id: string; merchant_id: string; started_at: string }) => {
    recentActivity.push({ type: 'support_access', id: s.id, at: s.started_at, merchantId: s.merchant_id });
  });
  recentActivity.sort((a, b) => (b.at < a.at ? -1 : 1));
  recentActivity.splice(15);

  return {
    kpis: {
      mrrThisMonth,
      activeMerchants,
      trialingMerchants,
      pastDueMerchants,
      dueInNext7Days,
      newMerchantsThisMonth,
      activationReadyCount,
    },
    revenue: { currentMonthMRR: mrrThisMonth, expectedNextBilling },
    billingHealth: { dueSoon, overdue, trialEndingSoon },
    setupHealth,
    recentActivity,
  };
}

export interface MerchantExpandedRow {
  id: string;
  name: string;
  slug: string;
  billing_status: string;
  created_at: string;
  admin_email: string | null;
  plan_code: string;
  monthly_price_usd: number;
  next_billing_at: string | null;
  last_paid_at: string | null;
  setup_percent: number;
  product_count: number;
  payment_account_count: number;
  connected_page_count: number;
  recent_activity_at: string | null;
}

export async function getMerchantsExpandedList(supabase: SupabaseClient): Promise<MerchantExpandedRow[]> {
  const [merchants, plans, productCounts, paymentCounts, settings, pages, membersWithEmail, auditMax] = await Promise.all([
    supabase.from('merchants').select('id, name, slug, billing_status, created_at').order('created_at', { ascending: false }),
    supabase.from('merchant_plans').select('merchant_id, plan_code, monthly_price_usd, next_billing_at, last_paid_at'),
    supabase.from('products').select('merchant_id').then((r) => (r.data ?? []).reduce((acc: Record<string, number>, row: { merchant_id: string }) => {
      acc[row.merchant_id] = (acc[row.merchant_id] ?? 0) + 1;
      return acc;
    }, {})),
    supabase.from('merchant_payment_accounts').select('merchant_id').then((r) => (r.data ?? []).reduce((acc: Record<string, number>, row: { merchant_id: string }) => {
      acc[row.merchant_id] = (acc[row.merchant_id] ?? 0) + 1;
      return acc;
    }, {})),
    supabase.from('merchant_settings').select('merchant_id, ai_system_prompt').then((r) => {
      const map: Record<string, boolean> = {};
      (r.data ?? []).forEach((row: { merchant_id: string; ai_system_prompt: string | null }) => { map[row.merchant_id] = !!(row.ai_system_prompt?.trim()); });
      return map;
    }),
    supabase.from('facebook_pages').select('merchant_id').then((r) => (r.data ?? []).reduce((acc: Record<string, number>, row: { merchant_id: string }) => {
      acc[row.merchant_id] = (acc[row.merchant_id] ?? 0) + 1;
      return acc;
    }, {})),
    supabase.from('merchant_members').select('merchant_id, user_id'),
    supabase.from('audit_logs').select('resource_id, created_at').eq('resource_type', 'merchant').order('created_at', { ascending: false }),
  ]);
  const membersData = membersWithEmail.data ?? [];
  const userIds = [...new Set(membersData.map((m: { user_id: string }) => m.user_id))];
  const { data: profilesData } = userIds.length > 0
    ? await supabase.from('profiles').select('id, email').in('id', userIds)
    : { data: [] };
  const emailByUserId: Record<string, string> = {};
  (profilesData ?? []).forEach((p: { id: string; email: string | null }) => { if (p.email) emailByUserId[p.id] = p.email; });
  const adminEmailByMerchant: Record<string, string> = {};
  membersData.forEach((m: { merchant_id: string; user_id: string }) => { if (emailByUserId[m.user_id]) adminEmailByMerchant[m.merchant_id] = emailByUserId[m.user_id]; });

  const planMap: Record<string, { plan_code: string; monthly_price_usd: number; next_billing_at: string | null; last_paid_at: string | null }> = {};
  (plans.data ?? []).forEach((p: { merchant_id: string; plan_code: string; monthly_price_usd?: number; next_billing_at?: string | null; last_paid_at?: string | null }) => {
    planMap[p.merchant_id] = {
      plan_code: p.plan_code ?? 'starter',
      monthly_price_usd: (p.monthly_price_usd as number) ?? 0,
      next_billing_at: p.next_billing_at ?? null,
      last_paid_at: p.last_paid_at ?? null,
    };
  });

  const recentByMerchant: Record<string, string> = {};
  (auditMax.data ?? []).forEach((a: { resource_id: string; created_at: string }) => {
    if (a.resource_id && !recentByMerchant[a.resource_id]) recentByMerchant[a.resource_id] = a.created_at;
  });

  const rows: MerchantExpandedRow[] = (merchants.data ?? []).map((m: { id: string; name: string; slug: string; billing_status: string; created_at: string }) => {
    const plan = planMap[m.id] ?? { plan_code: 'starter', monthly_price_usd: 0, next_billing_at: null, last_paid_at: null };
    const productCount = productCounts[m.id] ?? 0;
    const paymentCount = paymentCounts[m.id] ?? 0;
    const hasPrompt = settings[m.id] ?? false;
    const pageCount = pages[m.id] ?? 0;
    const steps = 3;
    let ready = 0;
    if (productCount > 0) ready++;
    if (paymentCount > 0) ready++;
    if (hasPrompt) ready++;
    const setup_percent = Math.round((ready / steps) * 100);
    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      billing_status: m.billing_status,
      created_at: m.created_at,
      admin_email: adminEmailByMerchant[m.id] ?? null,
      plan_code: plan.plan_code,
      monthly_price_usd: plan.monthly_price_usd,
      next_billing_at: plan.next_billing_at,
      last_paid_at: plan.last_paid_at,
      setup_percent,
      product_count: productCount,
      payment_account_count: paymentCount,
      connected_page_count: pageCount,
      recent_activity_at: recentByMerchant[m.id] ?? null,
    };
  });
  return rows;
}
