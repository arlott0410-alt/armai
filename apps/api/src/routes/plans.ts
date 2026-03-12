import { Hono } from 'hono'
import type { Env } from '../env.js'
import { getSupabaseAdmin } from '../lib/supabase.js'
import { getPlansPublic } from '../services/subscription.js'

const app = new Hono<{ Bindings: Env }>()

/** Public: list subscription plans (LAK). */
app.get('/', async (c) => {
  const supabase = getSupabaseAdmin(c.env)
  const plans = await getPlansPublic(supabase)
  return c.json({ plans })
})

export default app
