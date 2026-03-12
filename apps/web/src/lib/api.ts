/**
 * Typed API client for ArmAI backend. Base URL from env.
 */

/** Base URL สำหรับ API; ลงท้ายด้วย /api เสมอ (Worker ใช้ path /api/...) */
export function getBaseUrl(): string {
  const url =
    (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? ''
  if (!url) return '/api'
  const u = url.replace(/\/$/, '')
  return u.endsWith('/api') ? u : `${u}/api`
}

/** Slip image URL from R2 key (served via GET /api/slip/:key). */
export function getSlipUrl(key: string): string {
  if (!key) return ''
  const base = getBaseUrl()
  return key.startsWith('http') ? key : `${base}/slip/${key}`
}

/** Rate limit: max concurrent in-flight requests */
const MAX_CONCURRENT = 6
let inFlight = 0
const queue: Array<() => void> = []

function runNext() {
  if (inFlight >= MAX_CONCURRENT || queue.length === 0) return
  inFlight++
  const next = queue.shift()!
  next()
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  await new Promise<void>((resolve) => {
    if (inFlight < MAX_CONCURRENT) {
      inFlight++
      resolve()
    } else {
      queue.push(() => resolve())
    }
  })
  try {
    const base = getBaseUrl()
    const url = path.startsWith('http') ? path : `${base}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`
    if (opts.body != null && typeof opts.body === 'object' && !Array.isArray(opts.body)) {
      const b = opts.body as Record<string, unknown>
      if (
        b.price_lak != null &&
        typeof b.price_lak === 'number' &&
        (b.price_lak < 0 || !Number.isFinite(b.price_lak))
      ) {
        throw new Error('Invalid price_lak')
      }
      if (b.code != null && typeof b.code === 'string' && !/^[a-z0-9_-]+$/.test(b.code.trim())) {
        throw new Error('Invalid plan code (use letters, numbers, hyphen, underscore)')
      }
    }
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
    }
    return data as T
  } finally {
    inFlight--
    runNext()
  }
}

export interface MeResponse {
  userId: string
  email: string | null
  role: 'super_admin' | 'merchant_admin'
  merchantIds: string[]
}

export const authApi = {
  me: (token: string) => request<MeResponse>('/auth/me', { token }),
}

export interface PlanPublic {
  id?: string
  code: string
  name: string
  priceLak: number
  features: string[]
  maxUsers: number | null
}

export interface AdminPlanRow {
  id: string
  name: string
  code: string
  price_lak: number
  features: string[]
  max_users: number | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/** Subscription bank as returned by GET /api/plans (public shape). */
export interface SubscriptionBankPublic {
  name: string
  account_number: string
  holder: string
  qr_image_url: string | null
}

export const plansApi = {
  list: () =>
    request<{ plans: PlanPublic[]; subscription_bank: SubscriptionBankPublic | null }>('/plans'),
}

export type SubscribeType = 'trial' | 'monthly' | 'annual'

export interface SubscribeBody {
  type: SubscribeType
  success_url?: string
  cancel_url?: string
  customer_email?: string | null
  customer_phone?: string | null
  billing_address?: {
    name?: string
    address_line1?: string
    city?: string
    country?: string
    postal_code?: string
  } | null
}

export const subscribeApi = {
  subscribe: (token: string, body: SubscribeBody) =>
    request<{
      checkout_url: string | null
      payment_id: string | null
      trial_started?: boolean
    }>('/subscribe', { method: 'POST', token, body }),
}

export interface SystemSettingsResponse {
  bank: {
    bank_name: string
    account_number: string
    account_holder: string
    qr_image_url: string | null
  } | null
}

/** Subscription bank details (GET /api/public/subscription-bank). Read directly from DB so merchants see latest. */
export interface SubscriptionBankDetails {
  bank_name: string
  account_number: string
  account_holder: string
  qr_image_url: string | null
}

/** Fetch subscription bank from public endpoint (cache-bust). Use this on Pricing so merchants see data after super admin saves. */
export async function fetchSubscriptionBank(
  cacheBust = true
): Promise<SubscriptionBankDetails | null> {
  const base = getBaseUrl()
  const url = `${base}/public/subscription-bank${cacheBust ? `?t=${Date.now()}` : ''}`
  const res = await fetch(url)
  const data = await res.json().catch(() => null)
  if (!res.ok) return null
  if (data && typeof data === 'object' && 'bank_name' in data) {
    return {
      bank_name: data.bank_name ?? '',
      account_number: data.account_number ?? '',
      account_holder: data.account_holder ?? '',
      qr_image_url: data.qr_image_url ?? null,
    }
  }
  return null
}

export const systemSettingsApi = {
  /** Pass cacheBust: true when opening bank modal or on window focus so merchants see latest after super admin saves. */
  get: (cacheBust?: boolean) =>
    request<SystemSettingsResponse>(
      cacheBust ? `/system/settings?_t=${Date.now()}` : '/system/settings'
    ),
  patch: (
    token: string,
    body: {
      bank?: {
        bank_name: string
        account_number: string
        account_holder: string
        qr_image_url?: string | null
      }
      /** Required when updating bank: current password to confirm identity. */
      password_confirm?: string
    }
  ) => request<{ ok: boolean }>('/system/settings', { method: 'PATCH', token, body }),
  uploadQr: async (token: string, file: File): Promise<{ qr_image_url: string }> => {
    const base = getBaseUrl()
    const url = `${base}/system/settings/upload-qr`
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
    return data as { qr_image_url: string }
  },
}

export const subscriptionPaymentsApi = {
  uploadSlip: async (
    token: string,
    paymentId: string,
    file: File
  ): Promise<{ slip_url: string; ok: boolean }> => {
    const base = getBaseUrl()
    const url = `${base}/merchant/subscription-payments/${paymentId}/slip`
    const form = new FormData()
    form.append('slip', file)
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
    return data as { slip_url: string; ok: boolean }
  },
}

export interface MerchantSubscription {
  plan: PlanPublic | null
  planCode: string
  billingStatus: string
  currentPeriodEnd: string | null
  nextBillingAt: string | null
  trialEndsAt: string | null
}

export const subscriptionApi = {
  get: (token: string) =>
    request<{ subscription: MerchantSubscription | null }>('/merchant/subscription', { token }),
}

export interface SuperDashboardKPIs {
  mrrThisMonth: number
  activeMerchants: number
  trialingMerchants: number
  pastDueMerchants: number
  dueInNext7Days: number
  newMerchantsThisMonth: number
  activationReadyCount: number
}

export interface SuperDashboardResponse {
  mrr: number
  merchantCount: number
  activeMerchants: number
  systemHealth: string
  kpis?: SuperDashboardKPIs
  revenue?: { currentMonthMRR: number; expectedNextBilling: number }
  billingHealth?: {
    dueSoon: { merchantId: string; name: string; nextBillingAt: string | null }[]
    overdue: { merchantId: string; name: string; nextBillingAt: string | null }[]
    trialEndingSoon: { merchantId: string; name: string; trialEndsAt: string | null }[]
  }
  setupHealth?: {
    merchantId: string
    name: string
    slug: string
    missingProducts: boolean
    noPaymentAccount: boolean
    noAiPrompt: boolean
    incompleteSetup: boolean
  }[]
  recentActivity?: {
    type: string
    id: string
    at: string
    merchantId?: string
    details?: Record<string, unknown>
  }[]
}

export interface MerchantListItem {
  id: string
  name: string
  slug: string
  billing_status: string
  created_at: string
  admin_email?: string | null
  plan_code?: string
  monthly_price_usd?: number
  /** LAK per month when API returns it */
  monthly_price_lak?: number
  next_billing_at?: string | null
  last_paid_at?: string | null
  setup_percent?: number
  product_count?: number
  payment_account_count?: number
  connected_page_count?: number
  recent_activity_at?: string | null
}

export const superApi = {
  dashboard: (token: string) => request<SuperDashboardResponse>('/super/dashboard', { token }),
  merchants: (token: string) =>
    request<{ merchants: MerchantListItem[] }>('/super/merchants', { token }),
  merchant: (token: string, id: string) =>
    request<SuperMerchantDetailResponse>(`/super/merchants/${id}`, { token }),
  updateMerchant: (
    token: string,
    id: string,
    body: {
      billing_status?: string
      plan_code?: string
      monthly_price_usd?: number
      next_billing_at?: string | null
      trial_ends_at?: string | null
      notes?: string | null
    }
  ) => request<{ ok: boolean }>(`/super/merchants/${id}`, { method: 'PATCH', token, body }),
  createMerchant: (
    token: string,
    body: {
      name: string
      slug: string
      admin_email: string
      admin_password: string
      admin_full_name?: string
      default_country?: string
      default_currency?: string
    }
  ) =>
    request<{ merchantId: string; userId: string }>('/super/merchants', {
      method: 'POST',
      token,
      body,
    }),
  merchantBilling: (token: string, merchantId: string) =>
    request<{ events: unknown[] }>(`/super/merchants/${merchantId}/billing`, { token }),
  createBillingEvent: (
    token: string,
    merchantId: string,
    body: {
      event_type: string
      amount: number
      currency?: string
      due_at?: string | null
      paid_at?: string | null
      status?: string
      reference_note?: string
    }
  ) => request<unknown>(`/super/merchants/${merchantId}/billing`, { method: 'POST', token, body }),
  merchantNotes: (token: string, merchantId: string) =>
    request<{ notes: { id: string; note: string; created_at: string; actor_id?: string }[] }>(
      `/super/merchants/${merchantId}/notes`,
      { token }
    ),
  addNote: (token: string, merchantId: string, body: { note: string }) =>
    request<unknown>(`/super/merchants/${merchantId}/notes`, { method: 'POST', token, body }),
  billingEvents: (token: string, merchantId?: string) =>
    request<{ events: unknown[] }>(
      `/super/billing/events${merchantId ? `?merchantId=${merchantId}` : ''}`,
      { token }
    ),
  pendingSubscriptionPayments: (token: string) =>
    request<{
      payments: {
        id: string
        merchant_id: string
        merchant_name?: string
        amount: number
        currency: string
        status: string
        created_at: string
        payment_type?: 'monthly' | 'annual' | null
        slip_url?: string | null
      }[]
    }>('/super/billing/pending-payments', { token }),
  approveSubscriptionPayment: (token: string, paymentId: string) =>
    request<{ ok: boolean }>(`/super/billing/approve/${paymentId}`, { method: 'POST', token }),
  auditLogs: (token: string, limit?: number) =>
    request<{ logs: unknown[] }>(`/super/audit${limit != null ? `?limit=${limit}` : ''}`, {
      token,
    }),
  plans: (token: string) => request<{ plans: AdminPlanRow[] }>('/super/plans', { token }),
  createPlan: (
    token: string,
    body: {
      name: string
      code: string
      price_lak: number
      features: string[]
      max_users?: number | null
      active?: boolean
      sort_order?: number
    }
  ) => request<AdminPlanRow>('/super/plans', { method: 'POST', token, body }),
  updatePlan: (
    token: string,
    id: string,
    body: Partial<{
      name: string
      code: string
      price_lak: number
      features: string[]
      max_users: number | null
      active: boolean
      sort_order: number
    }>
  ) => request<AdminPlanRow>(`/super/plans/${id}`, { method: 'PATCH', token, body }),
  deletePlan: (token: string, id: string) =>
    request<{ ok: boolean }>(`/super/plans/${id}`, { method: 'DELETE', token }),
  supportStart: (token: string, merchantId: string) =>
    request<{ supportSessionId: string; merchantId: string; readOnly: boolean }>('/support/start', {
      method: 'POST',
      token,
      body: { merchantId },
    }),
  channelMetrics: (token: string) =>
    request<{
      whatsappMerchantCount: number
      whatsappActiveConnections: number
      messagesByChannel: { facebook: number; whatsapp: number }
    }>('/super/channel-metrics', { token }),
}

export interface SuperMerchantDetailResponse {
  merchant: { id: string; name: string; slug: string; billing_status: string; created_at: string }
  plan: Record<string, unknown> | null
  settings: Record<string, unknown> | null
  notes: { id: string; note: string; created_at: string }[]
  billingEvents: unknown[]
  orderSummary: { total: number }
  productCount: number
  paymentAccountCount: number
  supportAccessHistory: unknown[]
}

export interface MerchantDashboardSummary {
  merchantId: string
  ordersToday: number
  pendingPayment: number
  paidToday: number
  manualReviewCount: number
  probableMatchCount: number
  readyToShipCount?: number
  activeProductsCount: number
  activePaymentAccountsCount: number
}

export interface ReadinessItem {
  key: string
  label: string
  status: 'not_started' | 'in_progress' | 'ready'
  detail?: string
}

export interface MerchantDashboardMerchant {
  id: string
  name: string
  slug: string
  billing_status: string
  default_country?: string | null
  default_currency?: string | null
  created_at: string
  updated_at: string
}

export interface MerchantDashboardResponse {
  merchantId: string
  merchant?: MerchantDashboardMerchant | null
  settings: Record<string, unknown> | null
  summary?: MerchantDashboardSummary
  readiness?: ReadinessItem[]
}

export interface OrderRow {
  id: string
  merchant_id: string
  status: string
  payment_method?: string
  payment_status?: string
  payment_switch_count?: number
  payment_method_locked_at?: string | null
  customer_name: string | null
  amount: number | null
  reference_code: string | null
  created_at: string
  updated_at: string
  fulfillment_status?: string | null
}

export interface ShipmentRow {
  id: string
  merchant_id: string
  order_id: string
  courier_name: string | null
  shipment_method: string
  tracking_number: string | null
  tracking_url: string | null
  shipping_note: string | null
  shipment_status: string
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
}

export interface FulfillmentEventRow {
  id: string
  order_id: string
  shipment_id: string | null
  event_type: string
  event_note: string | null
  actor_type: string
  created_at: string
}

export interface OrderDetailResponse extends OrderRow {
  order_items: {
    id: string
    product_name_snapshot: string
    quantity: number
    unit_price: number
    total_price: number
  }[]
  shipping_details: Record<string, unknown> | null
  cod_details: Record<string, unknown> | null
  payment_target: Record<string, unknown> | null
  payment_method_events: {
    id: string
    from_method: string
    to_method: string
    switch_result: string
    reason: string | null
    requested_by_type: string
    created_at: string
  }[]
  shipments?: ShipmentRow[]
  fulfillment_events?: FulfillmentEventRow[]
  telegram_operation_events?: {
    id: string
    event_type: string
    event_note: string | null
    actor_type: string
    created_at: string
  }[]
  shipment_images?: {
    id: string
    image_url: string | null
    source: string
    processing_status: string
    created_at: string
  }[]
}

export interface CreateShipmentBody {
  courier_name?: string | null
  shipment_method?: string
  tracking_number?: string | null
  tracking_url?: string | null
  shipping_note?: string | null
  shipped_at?: string | null
}

export interface MerchantCodSettings {
  merchant_id: string
  enable_cod: boolean
  cod_min_order_amount: number | null
  cod_max_order_amount: number | null
  cod_fee_amount: number
  require_phone_for_cod: boolean
  require_full_address_for_cod: boolean
  cod_requires_manual_confirmation: boolean
  cod_notes_for_ai: string | null
}

export const merchantApi = {
  dashboard: (token: string) =>
    request<MerchantDashboardResponse>('/merchant/dashboard', { token }),
  orders: (
    token: string,
    params?: {
      status?: string
      payment_method?: string
      fulfillment_status?: string
      limit?: number
    }
  ) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.payment_method) q.set('payment_method', params.payment_method)
    if (params?.fulfillment_status) q.set('fulfillment_status', params.fulfillment_status)
    if (params?.limit) q.set('limit', String(params.limit))
    const query = q.toString()
    return request<{ orders: OrderRow[] }>(`/merchant/orders${query ? `?${query}` : ''}`, { token })
  },
  order: (token: string, orderId: string) =>
    request<OrderRow>(`/merchant/orders/${orderId}`, { token }),
  orderDetail: (token: string, orderId: string) =>
    request<OrderDetailResponse>(`/merchant/orders/${orderId}`, { token }),
  orderShipments: (token: string, orderId: string) =>
    request<{ shipments: ShipmentRow[] }>(`/merchant/orders/${orderId}/shipments`, { token }),
  createShipment: (token: string, orderId: string, body: CreateShipmentBody) =>
    request<{ shipment: ShipmentRow; order: OrderDetailResponse }>(
      `/merchant/orders/${orderId}/shipments`,
      { method: 'POST', token, body }
    ),
  updateShipment: (
    token: string,
    shipmentId: string,
    body: Partial<CreateShipmentBody> & { shipment_status?: string; delivered_at?: string | null }
  ) =>
    request<{ shipment: ShipmentRow }>(`/merchant/shipments/${shipmentId}`, {
      method: 'PATCH',
      token,
      body,
    }),
  sendShipmentConfirmation: (token: string, shipmentId: string) =>
    request<{ sent: boolean; message?: string }>(
      `/merchant/shipments/${shipmentId}/send-confirmation`,
      { method: 'POST', token }
    ),
  orderSwitchPaymentMethod: (
    token: string,
    orderId: string,
    body: { desired_method: string; requested_by?: string }
  ) =>
    request<{ ok: boolean; order?: OrderDetailResponse }>(
      `/merchant/orders/${orderId}/payment-method/switch`,
      { method: 'POST', token, body }
    ),
  orderCodConfirm: (token: string, orderId: string) =>
    request<{ ok: boolean; order: OrderDetailResponse }>(
      `/merchant/orders/${orderId}/cod/confirm`,
      { method: 'POST', token }
    ),
  orderCodMarkShipped: (token: string, orderId: string) =>
    request<{ ok: boolean; order: OrderDetailResponse }>(
      `/merchant/orders/${orderId}/cod/mark-shipped`,
      { method: 'POST', token }
    ),
  orderCodMarkCollected: (token: string, orderId: string, body?: { collection_note?: string }) =>
    request<{ ok: boolean; order: OrderDetailResponse }>(
      `/merchant/orders/${orderId}/cod/mark-collected`,
      { method: 'POST', token, body: body ?? {} }
    ),
  orderCodMarkFailed: (token: string, orderId: string) =>
    request<{ ok: boolean; order: OrderDetailResponse }>(
      `/merchant/orders/${orderId}/cod/mark-failed`,
      { method: 'POST', token }
    ),
  readiness: (token: string) =>
    request<{ readiness: ReadinessItem[] }>('/merchant/readiness', { token }),
  bankSync: (token: string, limit?: number) =>
    request<{ bankTransactions: BankTransactionRow[]; matchingResults: MatchingResultRow[] }>(
      `/merchant/bank-sync${limit != null ? `?limit=${limit}` : ''}`,
      { token }
    ),
}

/** Bank sync setup: merchant-facing summary and config. */
export interface BankSyncPaymentAccountSummary {
  id: string
  bank_code: string
  account_number_masked: string
  account_holder_name: string
  is_primary: boolean
}

export interface BankSyncBankOption {
  code: string
  label: string
  parserId: string
  parserLabel: string
  supported: boolean
}

/** Merchant-facing connection health for status chip and overview. */
export type BankSyncHealthStatus =
  | 'needs_setup'
  | 'partially_configured'
  | 'ready_for_test'
  | 'healthy'
  | 'needs_attention'

/** Wizard state for UI flow. */
export type BankSyncWizardState =
  | 'not_started'
  | 'partially_configured'
  | 'configured'
  | 'tested'
  | 'healthy'

export interface BankSyncSetupSummary {
  merchant_id: string
  bank_code: string | null
  bank_label: string
  parser_label: string
  payment_account_id: string | null
  payment_account_summary: BankSyncPaymentAccountSummary | null
  webhook_url: string
  webhook_verify_token: string | null
  is_active: boolean
  device_label: string | null
  match_mode?: BankScopingMode
  last_received_at: string | null
  last_tested_at: string | null
  recent_transaction_count: number
  token_set: boolean
  bank_options: BankSyncBankOption[]
  health_status?: BankSyncHealthStatus
  step1_complete?: boolean
  step2_ready?: boolean
  step3_ready?: boolean
  wizard_state?: BankSyncWizardState
  scoping_scoped_count?: number
  scoping_ambiguous_count?: number
  scoping_out_of_scope_count?: number
}

/** Strict = require strong account evidence; relaxed = allow heuristics. */
export type BankScopingMode = 'strict' | 'relaxed'

/** Scope outcome: only 'scoped' is eligible for auto-matching. */
export type ScopingStatus = 'scoped' | 'ambiguous' | 'out_of_scope' | 'manual_review'

export interface BankSyncUpdatePayload {
  bank_code?: string
  payment_account_id?: string | null
  device_label?: string | null
  is_active?: boolean
  webhook_verify_token?: string | null
  match_mode?: BankScopingMode
}

export interface BankSyncTestResult {
  success: boolean
  status:
    | 'ok'
    | 'missing_setup'
    | 'missing_token'
    | 'missing_payment_account'
    | 'parse_failed'
    | 'unsupported_bank'
  message: string
  parser_ready: boolean
  config_status?: 'ok' | 'missing' | 'incomplete'
  parser_status?: 'ok' | 'missing' | 'unsupported'
  payment_account_status?: 'ok' | 'missing' | 'optional'
  token_status?: 'ok' | 'missing'
  test_parse_status?: 'ok' | 'failed' | 'skipped'
  parsed_preview?: {
    amount: number
    sender_name: string | null
    reference_code: string | null
  } | null
  messages?: string[]
  last_tested_at: string
  /** Present when test used sample_payload: parse + scoping test only, no real event. */
  test_only?: boolean
  scope_status?: ScopingStatus | null
  scope_confidence?: number | null
  decision_reason?: string | null
  extracted_fields?: Record<string, unknown> | null
}

export interface BankSyncTokenRegenerateResponse {
  ok: boolean
  webhook_verify_token: string
}

export interface BankTransactionRow {
  id: string
  merchant_id: string
  bank_config_id: string | null
  amount: number
  sender_name: string | null
  transaction_at: string
  reference_code: string | null
  bank_tx_id: string | null
  raw_parser_id: string | null
  raw_payload: Record<string, unknown> | null
  created_at: string
  scope_status?: ScopingStatus | null
  scope_confidence?: number | null
  ignored_reason?: string | null
  payment_account_id?: string | null
}

export interface BankEventRow {
  id: string
  amount: number
  sender_name: string | null
  transaction_at: string
  reference_code: string | null
  scope_status?: ScopingStatus | null
  scope_confidence?: number | null
  ignored_reason?: string | null
  payment_account_id?: string | null
  created_at: string
}

export interface BankRawEventRow {
  id: string
  processing_status: string
  received_at: string
  raw_message: string | null
  notification_title: string | null
}

export interface BankProcessingLogRow {
  id: string
  raw_event_id: string | null
  parser_profile_id: string | null
  payment_account_id: string | null
  bank_transaction_id: string | null
  parse_status: string | null
  scope_status: string | null
  matching_eligibility: boolean
  decision_reason: string | null
  detail_json: Record<string, unknown> | null
  created_at: string
}

export interface BankNotificationTestResult extends BankSyncTestResult {
  test_only?: boolean
  scope_status?: ScopingStatus | null
  scope_confidence?: number | null
  decision_reason?: string | null
  extracted_fields?: Record<string, unknown> | null
}

export interface MatchingResultRow {
  id: string
  merchant_id: string
  order_id: string
  bank_transaction_id: string
  status: string
  score: number | null
  score_factors: Record<string, unknown> | null
  created_at: string
  updated_at: string
  orders?: OrderRow | null
  bank_transactions?: BankTransactionRow | null
}

export const bankSyncSetupApi = {
  getSetup: (token: string) =>
    request<BankSyncSetupSummary>('/merchant/bank-sync/setup', { token }),
  updateSetup: (token: string, body: BankSyncUpdatePayload) =>
    request<{ ok: boolean }>('/merchant/bank-sync/setup', { method: 'PATCH', token, body }),
  regenerateToken: (token: string) =>
    request<BankSyncTokenRegenerateResponse>('/merchant/bank-sync/token/regenerate', {
      method: 'POST',
      token,
    }),
  testConnection: (token: string, body?: { sample_payload?: Record<string, unknown> }) =>
    request<BankSyncTestResult>('/merchant/bank-sync/test', {
      method: 'POST',
      token,
      body: body ?? {},
    }),
}

export interface BankSyncEventsResponse {
  bankTransactions: BankEventRow[]
  rawEvents: BankRawEventRow[]
}

export interface BankSyncProcessingLogsResponse {
  processingLogs: BankProcessingLogRow[]
}

export const bankSyncEventsApi = {
  getEvents: (token: string, limit?: number) =>
    request<BankSyncEventsResponse>(
      `/merchant/bank-sync/events${limit != null ? `?limit=${limit}` : ''}`,
      { token }
    ),
}

export const bankSyncProcessingLogsApi = {
  getLogs: (token: string, limit?: number) =>
    request<BankSyncProcessingLogsResponse>(
      `/merchant/bank-sync/processing-logs${limit != null ? `?limit=${limit}` : ''}`,
      { token }
    ),
}

/** Typed bank sync wizard API (aliases for clarity). */
export const bankSyncWizardApi = {
  getBankSyncSummary: (token: string) =>
    request<BankSyncSetupSummary>('/merchant/bank-sync/setup', { token }),
  updateBankSyncConfig: (token: string, body: BankSyncUpdatePayload) =>
    request<{ ok: boolean }>('/merchant/bank-sync/setup', { method: 'PATCH', token, body }),
  regenerateBankSyncToken: (token: string) =>
    request<BankSyncTokenRegenerateResponse>('/merchant/bank-sync/token/regenerate', {
      method: 'POST',
      token,
    }),
  testBankSyncConnection: (token: string) =>
    request<BankSyncTestResult>('/merchant/bank-sync/test', { method: 'POST', token }),
}

export interface MerchantSettingsResponse {
  merchant_id: string
  ai_system_prompt: string | null
  bank_parser_id: string | null
  webhook_verify_token: string | null
  auto_send_shipping_confirmation?: boolean
  telegram_notify_order_paid?: boolean
  telegram_allow_shipment_confirmation?: boolean
  telegram_allow_ai_escalation?: boolean
  telegram_require_authorized_admins?: boolean
  telegram_auto_send_shipment_confirmation?: boolean
}

export const settingsApi = {
  get: (token: string) => request<MerchantSettingsResponse>('/settings', { token }),
  update: (token: string, body: Partial<MerchantSettingsResponse>) =>
    request<{ ok: boolean }>('/settings', { method: 'PATCH', token, body }),
}

export interface TelegramConnectionSummary {
  id: string
  merchant_id: string
  telegram_group_id: string
  telegram_group_title: string | null
  is_active: boolean
  has_bot_token: boolean
  created_at: string
  updated_at: string
}

export interface TelegramAdminRow {
  id: string
  merchant_id: string
  telegram_user_id: string
  telegram_username: string | null
  telegram_display_name: string | null
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TelegramSettingsResponse {
  merchantId?: string
  connection: TelegramConnectionSummary | null
  settings: Partial<MerchantSettingsResponse>
}

export const telegramApi = {
  get: (token: string) => request<TelegramSettingsResponse>('/merchant/telegram', { token }),
  update: (
    token: string,
    body: {
      telegram_group_id?: string
      telegram_group_title?: string | null
      is_active?: boolean
      bot_token_encrypted_or_bound_reference?: string | null
    }
  ) => request<{ ok: boolean }>('/merchant/telegram', { method: 'PATCH', token, body }),
  admins: (token: string) =>
    request<{ admins: TelegramAdminRow[] }>('/merchant/telegram/admins', { token }),
  addAdmin: (
    token: string,
    body: {
      telegram_user_id: string
      telegram_username?: string | null
      telegram_display_name?: string | null
      role?: string
    }
  ) =>
    request<{ admin: TelegramAdminRow }>('/merchant/telegram/admins', {
      method: 'POST',
      token,
      body,
    }),
  updateAdmin: (
    token: string,
    adminId: string,
    body: Partial<{
      telegram_username: string | null
      telegram_display_name: string | null
      role: string
      is_active: boolean
    }>
  ) =>
    request<{ admin: TelegramAdminRow }>(`/merchant/telegram/admins/${adminId}`, {
      method: 'PATCH',
      token,
      body,
    }),
  test: (token: string) =>
    request<{ ok: boolean; sent: boolean }>('/merchant/telegram/test', { method: 'POST', token }),
}

export interface WhatsAppConnectionRow {
  id: string
  phone_number_id: string
  waba_id?: string | null
  business_account_name?: string | null
  is_active: boolean
  has_webhook_verify_token?: boolean
  created_at: string
  updated_at: string
}

export interface FacebookPageRow {
  id: string
  page_id: string
  page_name: string | null
}

export interface ChannelsSummaryResponse {
  facebook: { pageCount: number; pages: FacebookPageRow[] }
  whatsapp: {
    connections: {
      id: string
      phone_number_id: string
      business_account_name: string | null
      display_phone_number: string | null
      is_active: boolean
    }[]
  }
}

export const channelsApi = {
  summary: (token: string) => request<ChannelsSummaryResponse>('/merchant/channels', { token }),
}

export interface FacebookConnectPagesResponse {
  pages: Array<{ id: string; name: string; access_token: string | null }>
}

export interface FacebookStorePageResponse {
  page: { id: string; page_id: string; page_name: string | null; connection_id: string | null }
}

export const facebookChannelApi = {
  connect: (token: string, body: { access_token: string }) =>
    request<FacebookConnectPagesResponse>('/channels/facebook/connect', {
      method: 'POST',
      token,
      body,
    }),
  storePage: (
    token: string,
    body: { page_id: string; page_name?: string; page_access_token: string }
  ) =>
    request<FacebookStorePageResponse>('/channels/facebook/pages', {
      method: 'POST',
      token,
      body,
    }),
  disconnectPage: (token: string, pageRowId: string) =>
    request<{ ok: boolean }>(`/channels/facebook/pages/${pageRowId}`, {
      method: 'DELETE',
      token,
    }),
}

export const whatsappApi = {
  list: (token: string) =>
    request<{ connections: WhatsAppConnectionRow[] }>('/merchant/whatsapp', { token }),
  create: (
    token: string,
    body: {
      phone_number_id: string
      waba_id?: string | null
      business_account_name?: string | null
      access_token_reference?: string | null
      webhook_verify_token?: string | null
      is_active?: boolean
    }
  ) =>
    request<{ connection: WhatsAppConnectionRow }>('/merchant/whatsapp', {
      method: 'POST',
      token,
      body,
    }),
  update: (
    token: string,
    id: string,
    body: Partial<{
      phone_number_id: string
      waba_id: string | null
      business_account_name: string | null
      access_token_reference: string | null
      webhook_verify_token: string | null
      is_active: boolean
    }>
  ) =>
    request<{ connection: WhatsAppConnectionRow }>(`/merchant/whatsapp/${id}`, {
      method: 'PATCH',
      token,
      body,
    }),
  test: (token: string) =>
    request<{ ok: boolean; message?: string }>('/merchant/whatsapp/test', {
      method: 'POST',
      token,
    }),
}

/** WhatsApp OAuth connect (exchange code for token, store connection). */
export const whatsappChannelApi = {
  connect: (token: string, body: { code: string; redirect_uri: string }) =>
    request<{ ok: boolean; phone_number_id: string; display_phone_number: string | null }>(
      '/channels/whatsapp/connect',
      { method: 'POST', token, body }
    ),
  disconnect: (token: string, connectionId: string) =>
    request<{ ok: boolean }>(`/channels/whatsapp/disconnect/${connectionId}`, {
      method: 'DELETE',
      token,
    }),
}

export interface MerchantCustomerRow {
  id: string
  merchant_id: string
  primary_display_name: string | null
  phone_number: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface CustomerChannelIdentityRow {
  id: string
  merchant_id: string
  merchant_customer_id: string | null
  channel_type: string
  external_user_id: string
  channel_display_name: string | null
  phone_number: string | null
  last_seen_at: string
  created_at: string
}

export interface MerchantCustomerDetailResponse {
  customer: MerchantCustomerRow & { notes?: string | null; normalized_phone?: string | null }
  identities: CustomerChannelIdentityRow[]
  orderCount: number
  orders: {
    id: string
    status: string
    amount: number
    payment_status: string
    fulfillment_status: string | null
    created_at: string
  }[]
  recentMessages: {
    id: string
    channel_type: string
    direction: string
    message_type: string
    text_content: string | null
    created_at: string
  }[]
  identityEvents: {
    id: string
    event_type: string
    actor_type: string
    created_at: string
    reason: string | null
  }[]
}

export const customersApi = {
  list: (token: string, params?: { limit?: number; offset?: number; status?: string }) =>
    request<{ customers: MerchantCustomerRow[] }>(
      `/merchant/customers${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ''}`,
      { token }
    ),
  get: (token: string, id: string) =>
    request<MerchantCustomerDetailResponse>(`/merchant/customers/${id}`, { token }),
  create: (
    token: string,
    body: {
      primary_display_name?: string | null
      phone_number?: string | null
      notes?: string | null
      link_channel_identity_id?: string | null
    }
  ) =>
    request<{ customer: MerchantCustomerRow }>('/merchant/customers', {
      method: 'POST',
      token,
      body,
    }),
  update: (
    token: string,
    id: string,
    body: {
      primary_display_name?: string | null
      phone_number?: string | null
      notes?: string | null
      status?: string
    }
  ) =>
    request<{ customer: MerchantCustomerRow }>(`/merchant/customers/${id}`, {
      method: 'PATCH',
      token,
      body,
    }),
}

export const customerIdentitiesApi = {
  list: (token: string, params?: { merchant_customer_id?: string; unlinked?: boolean }) =>
    request<{ identities: CustomerChannelIdentityRow[] }>(
      `/merchant/customer-identities${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ''}`,
      { token }
    ),
  link: (token: string, body: { channel_identity_id: string; merchant_customer_id: string }) =>
    request<{ ok: boolean }>('/merchant/customer-identities/link', { method: 'POST', token, body }),
  unlink: (token: string, body: { channel_identity_id: string }) =>
    request<{ ok: boolean }>('/merchant/customer-identities/unlink', {
      method: 'POST',
      token,
      body,
    }),
  suggestions: (token: string, merchantCustomerId: string) =>
    request<{ suggestions: CustomerChannelIdentityRow[] }>(
      `/merchant/customer-identities/suggestions?merchant_customer_id=${merchantCustomerId}`,
      { token }
    ),
}

export interface TelegramOperationEventRow {
  id: string
  merchant_id: string
  related_order_id: string | null
  related_shipment_image_id: string | null
  event_type: string
  event_note: string | null
  actor_type: string
  actor_id: string | null
  created_at: string
}

export interface ShipmentImageRow {
  id: string
  merchant_id: string
  order_id: string | null
  source: string
  image_url: string | null
  processing_status: string
  created_at: string
}

export interface OperationsFeedResponse {
  events: TelegramOperationEventRow[]
  ambiguous_shipment_images: ShipmentImageRow[]
  awaiting_order_reference: ShipmentImageRow[]
}

export const operationsFeedApi = {
  getFeed: (token: string, limit?: number) =>
    request<OperationsFeedResponse>(
      `/merchant/operations/feed${limit != null ? `?limit=${limit}` : ''}`,
      { token }
    ),
}

export const ordersApi = {
  confirmMatch: (token: string, matchingResultId: string, confirm: boolean) =>
    request<{ ok: boolean }>('/orders/confirm-match', {
      method: 'POST',
      token,
      body: { matching_result_id: matchingResultId, confirm },
    }),
}

export interface SupportOrdersResponse {
  orders: OrderRow[]
}

export const supportApi = {
  merchantOrders: (token: string, merchantId: string) =>
    request<SupportOrdersResponse>(`/support/merchants/${merchantId}/orders`, { token }),
  merchantSettings: (token: string, merchantId: string) =>
    request<MerchantSettingsResponse>(`/support/merchants/${merchantId}/settings`, { token }),
}

/** Product fields for merchant CRUD (matches backend productSchema). */
export interface ProductRow {
  id: string
  merchant_id: string
  category_id: string | null
  name: string
  slug: string
  description: string | null
  base_price: number
  sale_price: number | null
  currency: string | null
  sku: string | null
  status: string
  requires_manual_confirmation: boolean
  ai_visible: boolean
  is_cod_allowed?: boolean
  requires_manual_cod_confirmation?: boolean
  created_at?: string
  updated_at?: string
}

export interface CreateProductBody {
  category_id?: string | null
  name: string
  slug: string
  description?: string | null
  base_price: number
  sale_price?: number | null
  currency?: string
  sku?: string | null
  status?: string
  requires_manual_confirmation?: boolean
  ai_visible?: boolean
  is_cod_allowed?: boolean
  requires_manual_cod_confirmation?: boolean
}

export const productsApi = {
  list: (token: string, params?: { categoryId?: string; status?: string }) => {
    const q = new URLSearchParams()
    if (params?.categoryId) q.set('categoryId', params.categoryId)
    if (params?.status) q.set('status', params.status)
    const query = q.toString()
    return request<{ products: ProductRow[] }>(`/merchant/products${query ? `?${query}` : ''}`, {
      token,
    })
  },
  get: (token: string, productId: string) =>
    request<ProductRow>(`/merchant/products/${productId}`, { token }),
  create: (token: string, body: CreateProductBody) =>
    request<ProductRow>('/merchant/products', { method: 'POST', token, body }),
  update: (token: string, productId: string, body: Partial<CreateProductBody>) =>
    request<ProductRow>(`/merchant/products/${productId}`, { method: 'PATCH', token, body }),
  variants: (token: string, productId: string) =>
    request<{ variants: unknown[] }>(`/merchant/products/${productId}/variants`, { token }),
  keywords: (token: string, productId: string) =>
    request<{ keywords: unknown[] }>(`/merchant/products/${productId}/keywords`, { token }),
  addKeyword: (token: string, productId: string, keyword: string) =>
    request<unknown>(`/merchant/products/${productId}/keywords`, {
      method: 'POST',
      token,
      body: { product_id: productId, keyword },
    }),
  deleteKeyword: (token: string, productId: string, keywordId: string) =>
    request<{ ok: boolean }>(`/merchant/products/${productId}/keywords/${keywordId}`, {
      method: 'DELETE',
      token,
    }),
}

export interface CategoryRow {
  id: string
  merchant_id: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface CreateCategoryBody {
  name: string
  description?: string | null
  sort_order?: number
  is_active?: boolean
}

export const categoriesApi = {
  list: (token: string, params?: { activeOnly?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.activeOnly === false) q.set('activeOnly', 'false')
    const query = q.toString()
    return request<{ categories: CategoryRow[] }>(
      `/merchant/categories${query ? `?${query}` : ''}`,
      { token }
    )
  },
  create: (token: string, body: CreateCategoryBody) =>
    request<CategoryRow>('/merchant/categories', { method: 'POST', token, body }),
  update: (token: string, categoryId: string, body: Partial<CreateCategoryBody>) =>
    request<CategoryRow>(`/merchant/categories/${categoryId}`, { method: 'PATCH', token, body }),
}

export interface FaqRow {
  id: string
  merchant_id: string
  question: string
  answer: string
  keywords: string | null
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface CreateFaqBody {
  question: string
  answer: string
  keywords?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface KnowledgeEntryRow {
  id: string
  merchant_id: string
  type: string
  title: string
  content: string
  keywords: string | null
  priority: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface CreateKnowledgeEntryBody {
  type: string
  title: string
  content: string
  keywords?: string | null
  priority?: number
  is_active?: boolean
}

export const knowledgeApi = {
  faqs: (token: string, params?: { activeOnly?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.activeOnly === false) q.set('activeOnly', 'false')
    const query = q.toString()
    return request<{ faqs: FaqRow[] }>(`/merchant/knowledge/faqs${query ? `?${query}` : ''}`, {
      token,
    })
  },
  createFaq: (token: string, body: CreateFaqBody) =>
    request<FaqRow>('/merchant/knowledge/faqs', { method: 'POST', token, body }),
  updateFaq: (token: string, faqId: string, body: Partial<CreateFaqBody>) =>
    request<FaqRow>(`/merchant/knowledge/faqs/${faqId}`, { method: 'PATCH', token, body }),
  entries: (token: string, params?: { type?: string; activeOnly?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.type) q.set('type', params.type)
    if (params?.activeOnly === false) q.set('activeOnly', 'false')
    const query = q.toString()
    return request<{ entries: KnowledgeEntryRow[] }>(
      `/merchant/knowledge/entries${query ? `?${query}` : ''}`,
      { token }
    )
  },
  createEntry: (token: string, body: CreateKnowledgeEntryBody) =>
    request<KnowledgeEntryRow>('/merchant/knowledge/entries', { method: 'POST', token, body }),
  updateEntry: (token: string, entryId: string, body: Partial<CreateKnowledgeEntryBody>) =>
    request<KnowledgeEntryRow>(`/merchant/knowledge/entries/${entryId}`, {
      method: 'PATCH',
      token,
      body,
    }),
}

export interface PromotionRow {
  id: string
  merchant_id: string
  title: string
  content: string | null
  valid_from: string | null
  valid_until: string | null
  keywords: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface CreatePromotionBody {
  title: string
  content?: string | null
  valid_from?: string | null
  valid_until?: string | null
  keywords?: string | null
  is_active?: boolean
}

export const promotionsApi = {
  list: (token: string, params?: { activeOnly?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.activeOnly === false) q.set('activeOnly', 'false')
    const query = q.toString()
    return request<{ promotions: PromotionRow[] }>(
      `/merchant/promotions${query ? `?${query}` : ''}`,
      { token }
    )
  },
  create: (token: string, body: CreatePromotionBody) =>
    request<PromotionRow>('/merchant/promotions', { method: 'POST', token, body }),
  update: (token: string, promotionId: string, body: Partial<CreatePromotionBody>) =>
    request<PromotionRow>(`/merchant/promotions/${promotionId}`, { method: 'PATCH', token, body }),
}

export interface PaymentAccountRow {
  id: string
  merchant_id: string
  bank_code: string
  account_name: string | null
  account_number: string
  account_holder_name: string
  currency: string | null
  qr_image_path: string | null
  qr_image_object_key: string | null
  is_primary: boolean
  is_active: boolean
  sort_order: number
  notes: string | null
  created_at?: string
  updated_at?: string
}

export interface CreatePaymentAccountBody {
  bank_code: string
  account_name?: string | null
  account_number: string
  account_holder_name: string
  currency?: string
  qr_image_path?: string | null
  qr_image_object_key?: string | null
  is_primary?: boolean
  is_active?: boolean
  sort_order?: number
  notes?: string | null
}

export const paymentMethodSettingsApi = {
  get: (token: string) =>
    request<MerchantCodSettings>('/merchant/payment-method-settings', { token }),
  update: (token: string, body: Partial<MerchantCodSettings>) =>
    request<MerchantCodSettings>('/merchant/payment-method-settings', {
      method: 'PATCH',
      token,
      body,
    }),
}

export const paymentAccountsApi = {
  list: (token: string, params?: { activeOnly?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.activeOnly === false) q.set('activeOnly', 'false')
    const query = q.toString()
    return request<{ paymentAccounts: PaymentAccountRow[] }>(
      `/merchant/payment-accounts${query ? `?${query}` : ''}`,
      { token }
    )
  },
  get: (token: string, accountId: string) =>
    request<PaymentAccountRow>(`/merchant/payment-accounts/${accountId}`, { token }),
  create: (token: string, body: CreatePaymentAccountBody) =>
    request<PaymentAccountRow>('/merchant/payment-accounts', { method: 'POST', token, body }),
  update: (token: string, accountId: string, body: Partial<CreatePaymentAccountBody>) =>
    request<PaymentAccountRow>(`/merchant/payment-accounts/${accountId}`, {
      method: 'PATCH',
      token,
      body,
    }),
}
