import type { SupabaseClient } from '@supabase/supabase-js'
import { STANDARD_PLAN_CODE, STANDARD_PLAN, getPlanByCode as getCatalogPlan } from '@armai/shared'
import * as billing from './billing.js'
import * as merchantService from './merchant.js'
import * as plansDb from './plans-db.js'

/** Single plan: Standard. */
export const STANDARD_PRICE_LAK = 1_999_000
export const STANDARD_ANNUAL_LAK = 19_999_000
export const TRIAL_DAYS = 7

export interface PlanPublic {
  id?: string
  code: string
  name: string
  priceLak: number
  features: string[]
  maxUsers: number | null
}

/** List plans: single Standard plan from DB or fallback. */
export async function getPlansPublic(supabase: SupabaseClient): Promise<PlanPublic[]> {
  const rows = await plansDb.listPlansPublic(supabase)
  const standard = rows.find((r) => r.code === STANDARD_PLAN_CODE) ?? null
  if (standard) {
    return [
      {
        id: standard.id,
        code: standard.code,
        name: standard.name,
        priceLak: standard.price_lak,
        features: standard.features,
        maxUsers: standard.max_users,
      },
    ]
  }
  return [
    {
      code: STANDARD_PLAN.code,
      name: STANDARD_PLAN.nameKey,
      priceLak: STANDARD_PRICE_LAK,
      features: [...STANDARD_PLAN.features],
      maxUsers: STANDARD_PLAN.maxUsers,
    },
  ]
}

export async function getMerchantSubscription(
  supabase: SupabaseClient,
  merchantId: string
): Promise<{
  plan: PlanPublic | null
  planCode: string
  billingStatus: string
  currentPeriodEnd: string | null
  nextBillingAt: string | null
  trialEndsAt: string | null
} | null> {
  const planRow = await billing.getMerchantPlan(supabase, merchantId)
  if (!planRow) return null
  const row = planRow as {
    trial_ends_at?: string | null
    next_billing_at?: string | null
    current_period_end?: string | null
    plan_code: string
    billing_status: string
  }
  const dbPlan = await plansDb.getPlanByCode(supabase, planRow.plan_code)
  const plan: PlanPublic | null = dbPlan
    ? {
        id: dbPlan.id,
        code: dbPlan.code,
        name: dbPlan.name,
        priceLak: dbPlan.price_lak,
        features: dbPlan.features,
        maxUsers: dbPlan.max_users,
      }
    : null
  return {
    plan,
    planCode: planRow.plan_code,
    billingStatus: planRow.billing_status,
    currentPeriodEnd: row.current_period_end ?? null,
    nextBillingAt: row.next_billing_at ?? null,
    trialEndsAt: row.trial_ends_at ?? null,
  }
}

export type SubscribeType = 'trial' | 'monthly' | 'annual'

export interface CreateCheckoutParams {
  merchantId: string
  planCode: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string | null
  customerPhone?: string | null
  billingAddress?: {
    name?: string
    address_line1?: string
    city?: string
    country?: string
    postal_code?: string
  } | null
}

export interface CreateCheckoutResult {
  checkoutUrl: string | null
  paymentId: string | null
  trialStarted?: boolean
  error?: string
}

/** Start 7-day trial: no payment, set trialing + trial_ends_at. */
export async function startTrial(
  supabase: SupabaseClient,
  merchantId: string
): Promise<{ ok: boolean; error?: string }> {
  const merchant = await merchantService.getMerchantById(supabase, merchantId).catch(() => null)
  if (!merchant) return { ok: false, error: 'Merchant not found' }
  const now = new Date()
  const trialEnd = new Date(now)
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)
  await billing.upsertMerchantPlan(supabase, merchantId, {
    plan_code: STANDARD_PLAN_CODE,
    billing_status: 'trialing',
    trial_ends_at: trialEnd.toISOString(),
    next_billing_at: trialEnd.toISOString(),
    current_period_end: trialEnd.toISOString(),
    currency: 'LAK',
    updated_at: now.toISOString(),
  })
  return { ok: true }
}

/** Create pending payment for monthly or annual (manual slip). */
export async function createPayment(
  supabase: SupabaseClient,
  params: {
    merchantId: string
    type: 'monthly' | 'annual'
    customerEmail?: string | null
    customerPhone?: string | null
    billingAddress?: Record<string, unknown> | null
  }
): Promise<CreateCheckoutResult> {
  const amount = params.type === 'annual' ? STANDARD_ANNUAL_LAK : STANDARD_PRICE_LAK
  const merchant = await merchantService
    .getMerchantById(supabase, params.merchantId)
    .catch(() => null)
  if (!merchant) return { checkoutUrl: null, paymentId: null, error: 'Merchant not found' }
  const { data: paymentRow, error: insertError } = await supabase
    .from('subscription_payments')
    .insert({
      merchant_id: params.merchantId,
      provider: 'manual_slip',
      amount,
      currency: 'LAK',
      status: 'pending',
      payment_type: params.type,
      customer_email: params.customerEmail ?? null,
      customer_phone: params.customerPhone ?? null,
      billing_address: params.billingAddress ?? null,
      metadata: { plan_code: STANDARD_PLAN_CODE, plan_name: 'Standard', interval: params.type },
    })
    .select('id')
    .single()
  if (insertError) return { checkoutUrl: null, paymentId: null, error: insertError.message }
  return { checkoutUrl: null, paymentId: paymentRow.id }
}

/**
 * Create a pending subscription payment (manual slip). Amount by type: monthly 1,999,000, annual 19,999,000.
 * Superadmin approves via Billing → subscription active, expiry +30d or +365d.
 */
export async function createCheckout(
  supabase: SupabaseClient,
  _env: Record<string, unknown>,
  params: CreateCheckoutParams & { type?: SubscribeType }
): Promise<CreateCheckoutResult> {
  const type = params.type ?? 'monthly'
  if (type === 'trial') {
    const result = await startTrial(supabase, params.merchantId)
    return result.ok
      ? { checkoutUrl: null, paymentId: null, trialStarted: true }
      : { checkoutUrl: null, paymentId: null, error: result.error }
  }
  if (type === 'monthly' || type === 'annual') {
    return createPayment(supabase, {
      merchantId: params.merchantId,
      type,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      billingAddress: params.billingAddress ?? null,
    })
  }
  return { checkoutUrl: null, paymentId: null, error: 'Invalid type' }
}

/**
 * Activate subscription after payment approval: extend expiry by 30d (monthly) or 365d (annual).
 */
export async function activateSubscriptionByType(
  supabase: SupabaseClient,
  merchantId: string,
  paymentType: 'monthly' | 'annual'
): Promise<void> {
  const now = new Date()
  const periodStart = now
  const periodEnd = new Date(now)
  if (paymentType === 'annual') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }
  const amount = paymentType === 'annual' ? STANDARD_ANNUAL_LAK : STANDARD_PRICE_LAK
  await billing.upsertMerchantPlan(supabase, merchantId, {
    plan_code: STANDARD_PLAN_CODE,
    billing_status: 'active',
    monthly_price_usd: amount / 20000,
    currency: 'LAK',
    trial_ends_at: null,
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    next_billing_at: periodEnd.toISOString(),
    last_paid_at: now.toISOString(),
    grace_until: null,
    cancel_at_period_end: false,
    is_auto_renew: true,
  })
  await billing.createBillingEvent(supabase, merchantId, {
    event_type: 'subscription_charge',
    amount,
    currency: 'LAK',
    invoice_period_start: periodStart.toISOString(),
    invoice_period_end: periodEnd.toISOString(),
    due_at: now.toISOString(),
    paid_at: now.toISOString(),
    status: 'paid',
    reference_note: `${paymentType === 'annual' ? 'Annual' : 'Monthly'} subscription`,
  })
}

/**
 * Activate subscription after successful payment (legacy/webhook). Uses monthly extension.
 */
export async function activateSubscription(
  supabase: SupabaseClient,
  merchantId: string,
  _planCode: string,
  paymentExternalId?: string
): Promise<void> {
  await activateSubscriptionByType(supabase, merchantId, 'monthly')
  const now = new Date()
  if (paymentExternalId) {
    await supabase
      .from('subscription_payments')
      .update({ status: 'succeeded', paid_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('merchant_id', merchantId)
      .eq('external_id', paymentExternalId)
  }
}

/** Mark subscription_payment by our row id (e.g. BCEL callback with ref=id). */
export async function markPaymentSucceeded(
  supabase: SupabaseClient,
  paymentId: string,
  externalId?: string | null
): Promise<void> {
  await supabase
    .from('subscription_payments')
    .update({
      status: 'succeeded',
      external_id: externalId ?? undefined,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
}

export interface PendingPaymentRow {
  id: string
  merchant_id: string
  amount: number
  currency: string
  status: string
  created_at: string
  payment_type?: 'monthly' | 'annual' | null
  slip_url?: string | null
  merchant_name?: string
}

/** List pending subscription payments (for superadmin Billing page). */
export async function listPendingSubscriptionPayments(
  supabase: SupabaseClient
): Promise<PendingPaymentRow[]> {
  const { data: payments, error } = await supabase
    .from('subscription_payments')
    .select('id, merchant_id, amount, currency, status, created_at, payment_type, slip_url')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  const list = (payments ?? []) as PendingPaymentRow[]
  if (list.length === 0) return []
  const merchantIds = [...new Set(list.map((p) => p.merchant_id))]
  const { data: merchants } = await supabase
    .from('merchants')
    .select('id, name')
    .in('id', merchantIds)
  const nameById = new Map(
    (merchants ?? []).map((m: { id: string; name: string }) => [m.id, m.name])
  )
  return list.map((p) => ({ ...p, merchant_name: nameById.get(p.merchant_id) ?? undefined }))
}

/** Approve a pending payment: extend expiry (monthly +30d, annual +365d) and mark payment succeeded. Requires slip_url. */
export async function approveSubscriptionPayment(
  supabase: SupabaseClient,
  paymentId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: payment, error: fetchError } = await supabase
    .from('subscription_payments')
    .select('id, merchant_id, status, payment_type, slip_url')
    .eq('id', paymentId)
    .single()
  if (fetchError || !payment) return { ok: false, error: 'Payment not found' }
  if ((payment as { status: string }).status !== 'pending') {
    return { ok: false, error: 'Payment is not pending' }
  }
  const slipUrl = (payment as { slip_url?: string | null }).slip_url
  if (!slipUrl || slipUrl.trim() === '') {
    return { ok: false, error: 'Transfer slip is required before approval' }
  }
  const merchantId = (payment as { merchant_id: string }).merchant_id
  const paymentType =
    (payment as { payment_type?: 'monthly' | 'annual' | null }).payment_type ?? 'monthly'
  await activateSubscriptionByType(supabase, merchantId, paymentType)
  await markPaymentSucceeded(supabase, paymentId)
  return { ok: true }
}
