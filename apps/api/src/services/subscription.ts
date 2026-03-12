import type { SupabaseClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_PLAN_CATALOG, getPlanByCode, type PlanCode } from '@armai/shared'
import * as billing from './billing.js'
import * as merchantService from './merchant.js'

/** USD to LAK approximate rate for display (configurable via env in production). */
const USD_TO_LAK = 20_000

export interface PlanPublic {
  code: PlanCode
  nameKey: string
  monthlyPriceUsd: number
  monthlyPriceKip: number
  features: string[]
  maxUsers: number | null
  supportLevel: string
}

export function getPlansPublic(): PlanPublic[] {
  return (['basic', 'pro'] as const).map((code) => {
    const p = SUBSCRIPTION_PLAN_CATALOG[code]
    return {
      code: p.code,
      nameKey: p.nameKey,
      monthlyPriceUsd: p.monthlyPriceUsd,
      monthlyPriceKip: Math.round(p.monthlyPriceUsd * USD_TO_LAK),
      features: p.features,
      maxUsers: p.maxUsers,
      supportLevel: p.supportLevel,
    }
  })
}

export async function getMerchantSubscription(
  supabase: SupabaseClient,
  merchantId: string
): Promise<{
  plan: (typeof SUBSCRIPTION_PLAN_CATALOG)[PlanCode] | null
  planCode: string
  billingStatus: string
  currentPeriodEnd: string | null
  nextBillingAt: string | null
} | null> {
  const planRow = await billing.getMerchantPlan(supabase, merchantId)
  if (!planRow) return null
  const plan = getPlanByCode(planRow.plan_code)
  return {
    plan: plan ?? null,
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
  const plan = getPlanByCode(params.planCode)
  if (!plan) return { checkoutUrl: null, paymentId: null, error: 'Invalid plan' }

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
        amount: plan.monthlyPriceUsd,
        currency: 'USD',
        status: 'pending',
        customer_email: params.customerEmail ?? null,
        customer_phone: params.customerPhone ?? null,
        billing_address: params.billingAddress ?? null,
        metadata: { plan_code: params.planCode },
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
              unit_amount: Math.round(plan.monthlyPriceUsd * 100),
              product_data: {
                name: plan.nameKey,
                description: plan.features.join(', '),
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
        amount: plan.monthlyPriceUsd,
        currency: 'USD',
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
  const plan = getPlanByCode(planCode)
  if (!plan) return

  const now = new Date()
  const periodStart = now
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)
  const nextBilling = new Date(periodEnd)

  await billing.upsertMerchantPlan(supabase, merchantId, {
    plan_code: planCode,
    billing_status: 'active',
    monthly_price_usd: plan.monthlyPriceUsd,
    currency: 'USD',
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
    amount: plan.monthlyPriceUsd,
    currency: 'USD',
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
