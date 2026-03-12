import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SUBSCRIPTION_PLAN_CATALOG,
  getPlanByCode as getCatalogPlan,
  type PlanCode,
} from '@armai/shared'
import * as billing from './billing.js'
import * as merchantService from './merchant.js'
import * as plansDb from './plans-db.js'

/** Default LAK prices when subscription_plans table is empty. */
const FALLBACK_PLANS_LAK: Record<string, number> = { basic: 1_072_000, pro: 6_432_000 }

export interface PlanPublic {
  id?: string
  code: string
  name: string
  priceLak: number
  features: string[]
  maxUsers: number | null
}

/** List plans from DB (LAK). Fallback to hardcoded if table empty. */
export async function getPlansPublic(supabase: SupabaseClient): Promise<PlanPublic[]> {
  const rows = await plansDb.listPlansPublic(supabase)
  if (rows.length > 0) {
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      priceLak: r.price_lak,
      features: r.features,
      maxUsers: r.max_users,
    }))
  }
  return (['basic', 'pro'] as const).map((code) => {
    const p = SUBSCRIPTION_PLAN_CATALOG[code]
    return {
      code: p.code,
      name: p.nameKey,
      priceLak: FALLBACK_PLANS_LAK[code] ?? 0,
      features: p.features,
      maxUsers: p.maxUsers,
    }
  })
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
} | null> {
  const planRow = await billing.getMerchantPlan(supabase, merchantId)
  if (!planRow) return null
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
    currentPeriodEnd: planRow.current_period_end ?? null,
    nextBillingAt: planRow.next_billing_at ?? null,
  }
}

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
  error?: string
}

/**
 * Create a checkout session. Prefer BCEL OnePay for Laos; fallback to Stripe.
 * In production, integrate BCEL OnePay SDK/API here.
 */
export async function createCheckout(
  supabase: SupabaseClient,
  env: {
    STRIPE_SECRET_KEY?: string
    BCEL_ONEPAY_API_URL?: string
    BCEL_ONEPAY_MERCHANT_ID?: string
    BCEL_ONEPAY_SECRET_KEY?: string
  },
  params: CreateCheckoutParams
): Promise<CreateCheckoutResult> {
  const dbPlan = await plansDb.getPlanByCode(supabase, params.planCode)
  const catalogPlan = getCatalogPlan(params.planCode)
  const priceLak = dbPlan?.price_lak ?? FALLBACK_PLANS_LAK[params.planCode] ?? 0
  const planName = dbPlan?.name ?? catalogPlan?.nameKey ?? params.planCode
  const features = dbPlan?.features ?? catalogPlan?.features ?? []
  if (!dbPlan && !catalogPlan && priceLak <= 0)
    return { checkoutUrl: null, paymentId: null, error: 'Invalid plan' }

  const merchant = await merchantService
    .getMerchantById(supabase, params.merchantId)
    .catch(() => null)
  if (!merchant) return { checkoutUrl: null, paymentId: null, error: 'Merchant not found' }

  // Prefer BCEL OnePay for Laos (LA)
  const isLaos = (merchant.default_country ?? '').toUpperCase() === 'LA'
  if (
    isLaos &&
    env.BCEL_ONEPAY_API_URL &&
    env.BCEL_ONEPAY_MERCHANT_ID &&
    env.BCEL_ONEPAY_SECRET_KEY
  ) {
    // Placeholder: BCEL OnePay integration would call their API to create payment/e-invoice
    // and return redirect URL for QR or card entry. For now return a placeholder URL.
    const { data: paymentRow, error } = await supabase
      .from('subscription_payments')
      .insert({
        merchant_id: params.merchantId,
        provider: 'bcel_onepay',
        amount: priceLak,
        currency: 'LAK',
        status: 'pending',
        customer_email: params.customerEmail ?? null,
        customer_phone: params.customerPhone ?? null,
        billing_address: params.billingAddress ?? null,
        metadata: { plan_code: params.planCode, plan_name: planName },
      })
      .select('id')
      .single()
    if (error) return { checkoutUrl: null, paymentId: null, error: error.message }
    // In production: call BCEL API, get payment URL, update external_id when available
    const checkoutUrl = `${env.BCEL_ONEPAY_API_URL}/pay?ref=${paymentRow.id}`
    return { checkoutUrl, paymentId: paymentRow.id }
  }

  // Stripe fallback (for global cards). Requires stripe package: npm install stripe
  if (env.STRIPE_SECRET_KEY) {
    try {
      const stripeMod = await import('stripe').catch(() => null)
      const Stripe = stripeMod?.default
      if (!Stripe) {
        return { checkoutUrl: null, paymentId: null, error: 'Stripe SDK not installed' }
      }
      const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' })
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: Math.round((priceLak / 20000) * 100), // LAK to USD approx for Stripe
              product_data: {
                name: planName,
                description: features.join(', '),
              },
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.customerEmail ?? undefined,
        client_reference_id: params.merchantId,
        metadata: {
          merchant_id: params.merchantId,
          plan_code: params.planCode,
        },
      })
      const paymentId = session.id
      await supabase.from('subscription_payments').insert({
        merchant_id: params.merchantId,
        provider: 'stripe',
        external_id: session.id,
        amount: priceLak,
        currency: 'LAK',
        status: 'pending',
      })
      return {
        checkoutUrl: session.url ?? null,
        paymentId,
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { checkoutUrl: null, paymentId: null, error: message }
    }
  }

  return { checkoutUrl: null, paymentId: null, error: 'No payment provider configured' }
}

/**
 * Activate subscription after successful payment (called from webhook or after redirect).
 * Optional paymentExternalId: when provided (e.g. Stripe session id), update that subscription_payment row.
 */
export async function activateSubscription(
  supabase: SupabaseClient,
  merchantId: string,
  planCode: string,
  paymentExternalId?: string
): Promise<void> {
  const dbPlan = await plansDb.getPlanByCodeAny(supabase, planCode)
  const priceLak = dbPlan?.price_lak ?? FALLBACK_PLANS_LAK[planCode] ?? 0

  const now = new Date()
  const periodStart = now
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)
  const nextBilling = new Date(periodEnd)

  await billing.upsertMerchantPlan(supabase, merchantId, {
    plan_code: planCode,
    billing_status: 'active',
    monthly_price_usd: priceLak / 20000,
    currency: 'LAK',
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    next_billing_at: nextBilling.toISOString(),
    last_paid_at: now.toISOString(),
    grace_until: null,
    cancel_at_period_end: false,
    is_auto_renew: true,
  })

  await billing.createBillingEvent(supabase, merchantId, {
    event_type: 'subscription_charge',
    amount: priceLak,
    currency: 'LAK',
    invoice_period_start: periodStart.toISOString(),
    invoice_period_end: periodEnd.toISOString(),
    due_at: now.toISOString(),
    paid_at: now.toISOString(),
    status: 'paid',
    reference_note: paymentExternalId ? `Payment ${paymentExternalId}` : 'Subscription activated',
  })

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
