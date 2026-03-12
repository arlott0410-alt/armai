import { Hono } from 'hono'
import type { Env } from '../env.js'
import { authMiddleware } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabase.js'
import { structuredLog } from '../lib/logger.js'
import { getMerchantDefaultCurrency, DEFAULT_COUNTRY } from '@armai/shared'

const app = new Hono<{
  Bindings: Env
  Variables: { auth: import('../middleware/auth.js').AuthContext }
}>()

app.use('/*', authMiddleware)

/**
 * POST /api/onboard/merchant
 * After signup: create merchant, membership, settings, trial subscription; set profile role.
 * Idempotent: if user already has a merchant, return success with existing merchantId.
 */
app.post('/merchant', async (c) => {
  structuredLog('info', 'onboard merchant', { path: '/api/onboard/merchant' })
  const auth = c.get('auth')
  const supabase = getSupabaseAdmin(c.env)
  const userId = auth.userId
  const email = auth.email ?? ''

  if (auth.role === 'super_admin') {
    return c.json({ error: 'Super admin cannot use merchant signup' }, 400)
  }

  if (auth.merchantIds.length > 0) {
    return c.json({ ok: true, merchantId: auth.merchantIds[0], alreadyOnboarded: true })
  }

  const slug = `store-${userId.slice(0, 8)}`
  const name = 'My Store'
  const defaultCountry = DEFAULT_COUNTRY
  const defaultCurrency = getMerchantDefaultCurrency(undefined, defaultCountry)
  const now = new Date()
  const trialEnd = new Date(now)
  trialEnd.setDate(trialEnd.getDate() + 7)

  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .insert({
      name,
      slug,
      billing_status: 'trialing',
      default_country: defaultCountry,
      default_currency: defaultCurrency,
    })
    .select('id')
    .single()

  if (merchantError || !merchant) {
    return c.json({ error: merchantError?.message ?? 'Failed to create merchant' }, 400)
  }

  const merchantId = merchant.id

  await supabase.from('merchant_members').insert({
    merchant_id: merchantId,
    user_id: userId,
    role: 'merchant_admin',
  })
  await supabase.from('merchant_settings').insert({ merchant_id: merchantId })
  await supabase.from('merchant_plans').insert({
    merchant_id: merchantId,
    plan_code: 'standard',
    billing_status: 'trialing',
    monthly_price_usd: 0,
    currency: defaultCurrency,
    trial_ends_at: trialEnd.toISOString(),
    current_period_end: trialEnd.toISOString(),
    next_billing_at: trialEnd.toISOString(),
    is_auto_renew: true,
  })

  // Set profile role so /auth/me and merchant routes resolve correctly
  await supabase.from('profiles').upsert(
    {
      id: userId,
      email: email || null,
      role: 'merchant_admin',
      updated_at: now.toISOString(),
    },
    { onConflict: 'id' }
  )

  return c.json({ ok: true, merchantId, message: 'Trial activated' }, 201)
})

export default app
