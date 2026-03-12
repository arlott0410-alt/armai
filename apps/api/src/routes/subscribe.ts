import { Hono } from 'hono'
import type { Env } from '../env.js'
import { authMiddleware, resolveMerchant, requireMerchantAdmin } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabase.js'
import { createCheckout } from '../services/subscription.js'
import { z } from 'zod'

const app = new Hono<{
  Bindings: Env
  Variables: { auth: import('../middleware/auth.js').AuthContext; merchantId: string }
}>()

app.use('/*', authMiddleware)
app.use('/*', resolveMerchant)
app.use('/*', requireMerchantAdmin)

const subscribeBodySchema = z.object({
  type: z.enum(['trial', 'monthly', 'annual']),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
  customer_email: z.string().email().optional().nullable(),
  customer_phone: z.string().max(32).optional().nullable(),
  billing_address: z
    .object({
      name: z.string().max(200).optional(),
      address_line1: z.string().max(300).optional(),
      city: z.string().max(100).optional(),
      country: z.string().max(2).optional(),
      postal_code: z.string().max(20).optional(),
    })
    .optional()
    .nullable(),
})

app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = subscribeBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }
  const { type, success_url, cancel_url, customer_email, customer_phone, billing_address } =
    parsed.data
  const merchantId = c.get('merchantId')
  const supabase = getSupabaseAdmin(c.env)
  const base = c.req.url.replace(/\/subscribe\/?.*$/, '')
  const result = await createCheckout(supabase, c.env, {
    merchantId,
    planCode: 'standard',
    successUrl: success_url ?? `${base}/pricing`,
    cancelUrl: cancel_url ?? `${base}/pricing`,
    type,
    customerEmail: customer_email ?? null,
    customerPhone: customer_phone ?? null,
    billingAddress: billing_address ?? null,
  })

  if (result.error) {
    return c.json({ error: result.error }, 400)
  }
  return c.json({
    checkout_url: result.checkoutUrl,
    payment_id: result.paymentId,
    trial_started: result.trialStarted ?? false,
  })
})

export default app
