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

const createCheckoutBodySchema = z.object({
  plan_code: z.string().min(1).max(64),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
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
  const parsed = createCheckoutBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }
  const { plan_code, success_url, cancel_url, customer_email, customer_phone, billing_address } =
    parsed.data
  const merchantId = c.get('merchantId')
  const supabase = getSupabaseAdmin(c.env)

  const result = await createCheckout(supabase, c.env, {
    merchantId,
    planCode: plan_code,
    successUrl: success_url,
    cancelUrl: cancel_url,
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
  })
})

export default app
