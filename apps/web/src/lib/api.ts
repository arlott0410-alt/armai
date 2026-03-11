/**
 * Typed API client for ArmAI backend. Base URL from env.
 */

/** Base URL สำหรับ API; ลงท้ายด้วย /api เสมอ (Worker ใช้ path /api/...) */
export function getBaseUrl(): string {
  const url = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '';
  if (!url) return '/api';
  const u = url.replace(/\/$/, '');
  return u.endsWith('/api') ? u : `${u}/api`;
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const base = getBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export interface MeResponse {
  userId: string;
  email: string | null;
  role: 'super_admin' | 'merchant_admin';
  merchantIds: string[];
}

export const authApi = {
  me: (token: string) => request<MeResponse>('/auth/me', { token }),
};

export interface SuperDashboardKPIs {
  mrrThisMonth: number;
  activeMerchants: number;
  trialingMerchants: number;
  pastDueMerchants: number;
  dueInNext7Days: number;
  newMerchantsThisMonth: number;
  activationReadyCount: number;
}

export interface SuperDashboardResponse {
  mrr: number;
  merchantCount: number;
  activeMerchants: number;
  systemHealth: string;
  kpis?: SuperDashboardKPIs;
  revenue?: { currentMonthMRR: number; expectedNextBilling: number };
  billingHealth?: {
    dueSoon: { merchantId: string; name: string; nextBillingAt: string | null }[];
    overdue: { merchantId: string; name: string; nextBillingAt: string | null }[];
    trialEndingSoon: { merchantId: string; name: string; trialEndsAt: string | null }[];
  };
  setupHealth?: { merchantId: string; name: string; slug: string; missingProducts: boolean; noPaymentAccount: boolean; noAiPrompt: boolean; incompleteSetup: boolean }[];
  recentActivity?: { type: string; id: string; at: string; merchantId?: string; details?: Record<string, unknown> }[];
}

export interface MerchantListItem {
  id: string;
  name: string;
  slug: string;
  billing_status: string;
  created_at: string;
  admin_email?: string | null;
  plan_code?: string;
  monthly_price_usd?: number;
  next_billing_at?: string | null;
  last_paid_at?: string | null;
  setup_percent?: number;
  product_count?: number;
  payment_account_count?: number;
  connected_page_count?: number;
  recent_activity_at?: string | null;
}

export const superApi = {
  dashboard: (token: string) => request<SuperDashboardResponse>('/super/dashboard', { token }),
  merchants: (token: string) => request<{ merchants: MerchantListItem[] }>('/super/merchants', { token }),
  merchant: (token: string, id: string) => request<SuperMerchantDetailResponse>(`/super/merchants/${id}`, { token }),
  updateMerchant: (token: string, id: string, body: { billing_status?: string; plan_code?: string; monthly_price_usd?: number; next_billing_at?: string | null; trial_ends_at?: string | null; notes?: string | null }) =>
    request<{ ok: boolean }>(`/super/merchants/${id}`, { method: 'PATCH', token, body }),
  createMerchant: (token: string, body: { name: string; slug: string; admin_email: string; admin_password: string; admin_full_name?: string }) =>
    request<{ merchantId: string; userId: string }>('/super/merchants', { method: 'POST', token, body }),
  merchantBilling: (token: string, merchantId: string) => request<{ events: unknown[] }>(`/super/merchants/${merchantId}/billing`, { token }),
  createBillingEvent: (token: string, merchantId: string, body: { event_type: string; amount: number; currency?: string; due_at?: string | null; paid_at?: string | null; status?: string; reference_note?: string }) =>
    request<unknown>(`/super/merchants/${merchantId}/billing`, { method: 'POST', token, body }),
  merchantNotes: (token: string, merchantId: string) => request<{ notes: { id: string; note: string; created_at: string; actor_id?: string }[] }>(`/super/merchants/${merchantId}/notes`, { token }),
  addNote: (token: string, merchantId: string, body: { note: string }) => request<unknown>(`/super/merchants/${merchantId}/notes`, { method: 'POST', token, body }),
  billingEvents: (token: string, merchantId?: string) =>
    request<{ events: unknown[] }>(`/super/billing/events${merchantId ? `?merchantId=${merchantId}` : ''}`, { token }),
  auditLogs: (token: string, limit?: number) => request<{ logs: unknown[] }>(`/super/audit${limit != null ? `?limit=${limit}` : ''}`, { token }),
  supportStart: (token: string, merchantId: string) =>
    request<{ supportSessionId: string; merchantId: string; readOnly: boolean }>('/support/start', {
      method: 'POST',
      token,
      body: { merchantId },
    }),
};

export interface SuperMerchantDetailResponse {
  merchant: { id: string; name: string; slug: string; billing_status: string; created_at: string };
  plan: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  notes: { id: string; note: string; created_at: string }[];
  billingEvents: unknown[];
  orderSummary: { total: number };
  productCount: number;
  paymentAccountCount: number;
  supportAccessHistory: unknown[];
}

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

export interface MerchantDashboardResponse {
  merchantId: string;
  settings: Record<string, unknown> | null;
  summary?: MerchantDashboardSummary;
  readiness?: ReadinessItem[];
}

export interface OrderRow {
  id: string;
  merchant_id: string;
  status: string;
  customer_name: string | null;
  amount: number | null;
  reference_code: string | null;
  created_at: string;
  updated_at: string;
}

export const merchantApi = {
  dashboard: (token: string) => request<MerchantDashboardResponse>('/merchant/dashboard', { token }),
  orders: (token: string, params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    const query = q.toString();
    return request<{ orders: OrderRow[] }>(`/merchant/orders${query ? `?${query}` : ''}`, { token });
  },
  order: (token: string, orderId: string) => request<OrderRow>(`/merchant/orders/${orderId}`, { token }),
  readiness: (token: string) => request<{ readiness: ReadinessItem[] }>('/merchant/readiness', { token }),
  bankSync: (token: string, limit?: number) =>
    request<{ bankTransactions: unknown[]; matchingResults: unknown[] }>(
      `/merchant/bank-sync${limit != null ? `?limit=${limit}` : ''}`,
      { token }
    ),
};

export interface MerchantSettingsResponse {
  merchant_id: string;
  ai_system_prompt: string | null;
  bank_parser_id: string | null;
  webhook_verify_token: string | null;
}

export const settingsApi = {
  get: (token: string) => request<MerchantSettingsResponse>('/settings', { token }),
  update: (token: string, body: Partial<{ ai_system_prompt: string | null; bank_parser_id: string | null; webhook_verify_token: string | null }>) =>
    request<{ ok: boolean }>('/settings', { method: 'PATCH', token, body }),
};

export const ordersApi = {
  confirmMatch: (token: string, matchingResultId: string, confirm: boolean) =>
    request<{ ok: boolean }>('/orders/confirm-match', { method: 'POST', token, body: { matching_result_id: matchingResultId, confirm } }),
};

export interface SupportOrdersResponse {
  orders: OrderRow[];
}

export const supportApi = {
  merchantOrders: (token: string, merchantId: string) =>
    request<SupportOrdersResponse>(`/support/merchants/${merchantId}/orders`, { token }),
  merchantSettings: (token: string, merchantId: string) =>
    request<MerchantSettingsResponse>(`/support/merchants/${merchantId}/settings`, { token }),
};

/** Product fields for merchant CRUD (matches backend productSchema). */
export interface ProductRow {
  id: string;
  merchant_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  sale_price: number | null;
  currency: string | null;
  sku: string | null;
  status: string;
  requires_manual_confirmation: boolean;
  ai_visible: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProductBody {
  category_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  base_price: number;
  sale_price?: number | null;
  currency?: string;
  sku?: string | null;
  status?: string;
  requires_manual_confirmation?: boolean;
  ai_visible?: boolean;
}

export const productsApi = {
  list: (token: string, params?: { categoryId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.categoryId) q.set('categoryId', params.categoryId);
    if (params?.status) q.set('status', params.status);
    const query = q.toString();
    return request<{ products: ProductRow[] }>(`/merchant/products${query ? `?${query}` : ''}`, { token });
  },
  get: (token: string, productId: string) => request<ProductRow>(`/merchant/products/${productId}`, { token }),
  create: (token: string, body: CreateProductBody) => request<ProductRow>('/merchant/products', { method: 'POST', token, body }),
  update: (token: string, productId: string, body: Partial<CreateProductBody>) => request<ProductRow>(`/merchant/products/${productId}`, { method: 'PATCH', token, body }),
  variants: (token: string, productId: string) => request<{ variants: unknown[] }>(`/merchant/products/${productId}/variants`, { token }),
  keywords: (token: string, productId: string) => request<{ keywords: unknown[] }>(`/merchant/products/${productId}/keywords`, { token }),
  addKeyword: (token: string, productId: string, keyword: string) => request<unknown>(`/merchant/products/${productId}/keywords`, { method: 'POST', token, body: { product_id: productId, keyword } }),
  deleteKeyword: (token: string, productId: string, keywordId: string) => request<{ ok: boolean }>(`/merchant/products/${productId}/keywords/${keywordId}`, { method: 'DELETE', token }),
};

export interface CategoryRow {
  id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCategoryBody {
  name: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export const categoriesApi = {
  list: (token: string, params?: { activeOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.activeOnly === false) q.set('activeOnly', 'false');
    const query = q.toString();
    return request<{ categories: CategoryRow[] }>(`/merchant/categories${query ? `?${query}` : ''}`, { token });
  },
  create: (token: string, body: CreateCategoryBody) =>
    request<CategoryRow>('/merchant/categories', { method: 'POST', token, body }),
  update: (token: string, categoryId: string, body: Partial<CreateCategoryBody>) =>
    request<CategoryRow>(`/merchant/categories/${categoryId}`, { method: 'PATCH', token, body }),
};

export interface FaqRow {
  id: string;
  merchant_id: string;
  question: string;
  answer: string;
  keywords: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateFaqBody {
  question: string;
  answer: string;
  keywords?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface KnowledgeEntryRow {
  id: string;
  merchant_id: string;
  type: string;
  title: string;
  content: string;
  keywords: string | null;
  priority: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateKnowledgeEntryBody {
  type: string;
  title: string;
  content: string;
  keywords?: string | null;
  priority?: number;
  is_active?: boolean;
}

export const knowledgeApi = {
  faqs: (token: string, params?: { activeOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.activeOnly === false) q.set('activeOnly', 'false');
    const query = q.toString();
    return request<{ faqs: FaqRow[] }>(`/merchant/knowledge/faqs${query ? `?${query}` : ''}`, { token });
  },
  createFaq: (token: string, body: CreateFaqBody) =>
    request<FaqRow>('/merchant/knowledge/faqs', { method: 'POST', token, body }),
  updateFaq: (token: string, faqId: string, body: Partial<CreateFaqBody>) =>
    request<FaqRow>(`/merchant/knowledge/faqs/${faqId}`, { method: 'PATCH', token, body }),
  entries: (token: string, params?: { type?: string; activeOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set('type', params.type);
    if (params?.activeOnly === false) q.set('activeOnly', 'false');
    const query = q.toString();
    return request<{ entries: KnowledgeEntryRow[] }>(`/merchant/knowledge/entries${query ? `?${query}` : ''}`, { token });
  },
  createEntry: (token: string, body: CreateKnowledgeEntryBody) =>
    request<KnowledgeEntryRow>('/merchant/knowledge/entries', { method: 'POST', token, body }),
  updateEntry: (token: string, entryId: string, body: Partial<CreateKnowledgeEntryBody>) =>
    request<KnowledgeEntryRow>(`/merchant/knowledge/entries/${entryId}`, { method: 'PATCH', token, body }),
};

export interface PromotionRow {
  id: string;
  merchant_id: string;
  title: string;
  content: string | null;
  valid_from: string | null;
  valid_until: string | null;
  keywords: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePromotionBody {
  title: string;
  content?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  keywords?: string | null;
  is_active?: boolean;
}

export const promotionsApi = {
  list: (token: string, params?: { activeOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.activeOnly === false) q.set('activeOnly', 'false');
    const query = q.toString();
    return request<{ promotions: PromotionRow[] }>(`/merchant/promotions${query ? `?${query}` : ''}`, { token });
  },
  create: (token: string, body: CreatePromotionBody) =>
    request<PromotionRow>('/merchant/promotions', { method: 'POST', token, body }),
  update: (token: string, promotionId: string, body: Partial<CreatePromotionBody>) =>
    request<PromotionRow>(`/merchant/promotions/${promotionId}`, { method: 'PATCH', token, body }),
};

export interface PaymentAccountRow {
  id: string;
  merchant_id: string;
  bank_code: string;
  account_name: string | null;
  account_number: string;
  account_holder_name: string;
  currency: string | null;
  qr_image_path: string | null;
  qr_image_object_key: string | null;
  is_primary: boolean;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePaymentAccountBody {
  bank_code: string;
  account_name?: string | null;
  account_number: string;
  account_holder_name: string;
  currency?: string;
  qr_image_path?: string | null;
  qr_image_object_key?: string | null;
  is_primary?: boolean;
  is_active?: boolean;
  sort_order?: number;
  notes?: string | null;
}

export const paymentAccountsApi = {
  list: (token: string, params?: { activeOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.activeOnly === false) q.set('activeOnly', 'false');
    const query = q.toString();
    return request<{ paymentAccounts: PaymentAccountRow[] }>(`/merchant/payment-accounts${query ? `?${query}` : ''}`, { token });
  },
  get: (token: string, accountId: string) => request<PaymentAccountRow>(`/merchant/payment-accounts/${accountId}`, { token }),
  create: (token: string, body: CreatePaymentAccountBody) =>
    request<PaymentAccountRow>('/merchant/payment-accounts', { method: 'POST', token, body }),
  update: (token: string, accountId: string, body: Partial<CreatePaymentAccountBody>) =>
    request<PaymentAccountRow>(`/merchant/payment-accounts/${accountId}`, { method: 'PATCH', token, body }),
};
