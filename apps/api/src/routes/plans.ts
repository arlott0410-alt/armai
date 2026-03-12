import { Hono } from 'hono'
import type { Env } from '../env.js'
import { getSupabaseAdmin } from '../lib/supabase.js'
import { getPlansPublic } from '../services/subscription.js'
import { getSubscriptionBank, toSubscriptionBankPublic } from '../services/system-settings.js'
import { getCachedResponse, setCachedResponse, cacheControlHeaders } from '../lib/cache.js'
import { logRequest } from '../lib/logger.js'

const app = new Hono<{ Bindings: Env; Variables: { correlationId?: string } }>()

/** Public: list subscription plans (LAK) and subscription_bank for Pricing. Cached 1h (Cache API). */
app.get('/', async (c) => {
  const url = c.req.url
  const correlationId = c.get('correlationId') as string | undefined
  logRequest('/api/plans', correlationId, { method: 'GET' })

  const cached = await getCachedResponse(url)
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: { ...Object.fromEntries(cached.headers), ...cacheControlHeaders() },
    })
  }

  const supabase = getSupabaseAdmin(c.env)
  const [plans, bankRow] = await Promise.all([getPlansPublic(supabase), getSubscriptionBank(c.env)])
  const subscription_bank = toSubscriptionBankPublic(bankRow)
  const res = c.json({ plans, subscription_bank })
  const headers = new Headers(res.headers)
  Object.entries(cacheControlHeaders()).forEach(([k, v]) => headers.set(k, v))
  const response = new Response(res.body, { status: res.status, headers })
  await setCachedResponse(url, response.clone())
  return response
})

export default app
