import type { SupabaseClient } from '@supabase/supabase-js';

export interface MerchantDashboardSummary {
  merchantId: string;
  ordersToday: number;
  pendingPayment: number;
  paidToday: number;
  manualReviewCount: number;
  probableMatchCount: number;
  activeProductsCount: number;
  activePaymentAccountsCount: number;
}

export interface ReadinessItem {
  key: string;
  label: string;
  status: 'not_started' | 'in_progress' | 'ready';
  detail?: string;
}

export async function getMerchantDashboardSummary(
  supabase: SupabaseClient,
  merchantId: string
): Promise<MerchantDashboardSummary> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  const [orders, matchingResults, productCount, paymentCount] = await Promise.all([
    supabase.from('orders').select('id, status, amount, created_at').eq('merchant_id', merchantId),
    supabase.from('matching_results').select('id, status').eq('merchant_id', merchantId),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId).eq('status', 'active'),
    supabase.from('merchant_payment_accounts').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId).eq('is_active', true),
  ]);

  const orderList = orders.data ?? [];
  const ordersToday = orderList.filter((o: { created_at: string }) => o.created_at >= todayStartIso).length;
  const pendingPayment = orderList.filter((o: { status: string }) => o.status === 'pending' || o.status === 'slip_uploaded' || o.status === 'bank_pending_match').length;
  const paidToday = orderList.filter((o: { status: string; created_at: string }) => o.status === 'paid' && o.created_at >= todayStartIso).length;

  const matchList = matchingResults.data ?? [];
  const manualReviewCount = matchList.filter((m: { status: string }) => m.status === 'manual_review').length;
  const probableMatchCount = matchList.filter((m: { status: string }) => m.status === 'probable_match').length;

  return {
    merchantId,
    ordersToday,
    pendingPayment,
    paidToday,
    manualReviewCount,
    probableMatchCount,
    activeProductsCount: (productCount.count as number) ?? 0,
    activePaymentAccountsCount: (paymentCount.count as number) ?? 0,
  };
}

export async function getMerchantReadiness(
  supabase: SupabaseClient,
  merchantId: string
): Promise<ReadinessItem[]> {
  const [products, categories, paymentAccounts, primaryAccount, settings, faqs, knowledge, pages] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    supabase.from('product_categories').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    supabase.from('merchant_payment_accounts').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId).eq('is_active', true),
    supabase.from('merchant_payment_accounts').select('id').eq('merchant_id', merchantId).eq('is_primary', true).maybeSingle(),
    supabase.from('merchant_settings').select('ai_system_prompt, bank_parser_id').eq('merchant_id', merchantId).single(),
    supabase.from('merchant_faqs').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    supabase.from('merchant_knowledge_entries').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    supabase.from('facebook_pages').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
  ]);

  const productCount = (products.count as number) ?? 0;
  const categoryCount = (categories.count as number) ?? 0;
  const paymentCount = (paymentAccounts.count as number) ?? 0;
  const hasPrimary = !!primaryAccount.data;
  const hasPrompt = !!(settings.data?.ai_system_prompt?.trim());
  const hasBankParser = !!settings.data?.bank_parser_id;
  const faqCount = (faqs.count as number) ?? 0;
  const knowledgeCount = (knowledge.count as number) ?? 0;
  const pageCount = (pages.count as number) ?? 0;

  const items: ReadinessItem[] = [
    { key: 'products', label: 'Products', status: productCount > 0 ? 'ready' : 'not_started', detail: productCount > 0 ? `${productCount} products` : undefined },
    { key: 'categories', label: 'Categories', status: categoryCount > 0 ? 'ready' : productCount > 0 ? 'in_progress' : 'not_started', detail: categoryCount > 0 ? `${categoryCount} categories` : undefined },
    { key: 'payment_account', label: 'Payment account', status: paymentCount > 0 ? 'ready' : 'not_started', detail: paymentCount > 0 ? `${paymentCount} account(s)` : undefined },
    { key: 'primary_payment', label: 'Primary payment account', status: hasPrimary ? 'ready' : paymentCount > 0 ? 'in_progress' : 'not_started' },
    { key: 'ai_prompt', label: 'AI prompt', status: hasPrompt ? 'ready' : 'in_progress' },
    { key: 'faq_knowledge', label: 'FAQ / Knowledge', status: faqCount > 0 || knowledgeCount > 0 ? 'ready' : 'in_progress', detail: faqCount + knowledgeCount > 0 ? `${faqCount} FAQs, ${knowledgeCount} entries` : undefined },
    { key: 'bank_parser', label: 'Bank parser config', status: hasBankParser ? 'ready' : 'in_progress' },
    { key: 'connected_page', label: 'Connected Facebook page', status: pageCount > 0 ? 'ready' : 'in_progress', detail: pageCount > 0 ? `${pageCount} page(s)` : undefined },
  ];
  return items;
}
