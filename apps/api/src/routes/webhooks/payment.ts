import { Hono } from 'hono'
import type { Env } from '../../env.js'
import { getSupabaseAdmin } from '../../lib/supabase.js'
import { activateSubscription, markPaymentSucceeded } from '../../services/subscription.js'

const app = new Hono<{ Bindings: Env }>()

/**
 * Stripe webhook: checkout.session.completed.
 * Verify signature with STRIPE_WEBHOOK_SECRET, then activate subscription.
 */
app.post('/stripe', async (c) => {
  const secret = c.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return c.json({ error: 'Webhook not configured' }, 501)
  }

  const body = await c.req.text()
  const sig = c.req.header('stripe-signature')
  if (!sig) return c.json({ error: 'Missing stripe-signature' }, 400)

  try {
    const stripeMod = await import('stripe').catch(() => null)
    const Stripe = stripeMod?.default
    if (!Stripe) return c.json({ error: 'Stripe SDK not installed' }, 501)

    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-11-20.acacia' })
    const event = stripe.webhooks.constructEvent(body, sig, secret)
    if (event.type !== 'checkout.session.completed') {
      return c.json({ received: true })
    }

    const session = event.data.object as {
      id: string
      client_reference_id?: string
      metadata?: Record<string, string>
    }
    const merchantId = session.metadata?.merchant_id ?? session.client_reference_id
    const planCode = session.metadata?.plan_code
    if (!merchantId || !planCode) {
      return c.json({ error: 'Missing merchant_id or plan_code in session' }, 400)
    }

    const supabase = getSupabaseAdmin(c.env)
    await activateSubscription(supabase, merchantId, planCode, session.id)
    return c.json({ received: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return c.json({ error: message }, 400)
  }
})

/**
 * BCEL OnePay callback/webhook (placeholder). Verify with BCEL secret and activate.
 */
app.post('/bcel', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    ref?: string
    status?: string
    transaction_id?: string
  } | null
  if (!body?.ref || body.status !== 'success') {
    return c.json({ error: 'Invalid or unsuccessful payment' }, 400)
  }

  const supabase = getSupabaseAdmin(c.env)
  const { data: payment } = await supabase
    .from('subscription_payments')
    .select('id, merchant_id, metadata')
    .eq('id', body.ref)
    .eq('provider', 'bcel_onepay')
    .single()

  if (!payment) return c.json({ error: 'Payment not found' }, 404)

  const planCode = (payment.metadata as { plan_code?: string } | null)?.plan_code ?? 'basic'
  await activateSubscription(supabase, payment.merchant_id, planCode)
  await markPaymentSucceeded(supabase, payment.id, body.transaction_id ?? null)

  return c.json({ received: true })
})

export default app
