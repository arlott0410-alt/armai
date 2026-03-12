import { Hono } from 'hono'
import type { Env } from '../../env.js'
import { authMiddleware, requireSuperAdmin } from '../../middleware/auth.js'
import { getSupabaseAdmin } from '../../lib/supabase.js'
import * as plansDb from '../../services/plans-db.js'
import { z } from 'zod'

const app = new Hono<{
  Bindings: Env
  Variables: { auth: import('../../middleware/auth.js').AuthContext }
}>()

app.use('/*', authMiddleware)
app.use('/*', requireSuperAdmin)

const createPlanSchema = z.object({
  name: z.string().min(1).max(200),
  code: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/),
  price_lak: z.number().int().min(0),
  features: z.array(z.string()),
  max_users: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

const updatePlanSchema = createPlanSchema.partial()

app.get('/', async (c) => {
  const supabase = getSupabaseAdmin(c.env)
  const plans = await plansDb.listPlansAdmin(supabase)
  return c.json({ plans })
})

app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = createPlanSchema.safeParse(body)
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  const supabase = getSupabaseAdmin(c.env)
  const plan = await plansDb.createPlan(supabase, {
    name: parsed.data.name,
    code: parsed.data.code,
    price_lak: parsed.data.price_lak,
    features: parsed.data.features,
    max_users: parsed.data.max_users ?? null,
    active: parsed.data.active ?? true,
    sort_order: parsed.data.sort_order ?? 0,
  })
  return c.json(plan, 201)
})

app.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const parsed = updatePlanSchema.safeParse(body)
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  const supabase = getSupabaseAdmin(c.env)
  const plan = await plansDb.updatePlan(supabase, id, parsed.data)
  return c.json(plan)
})

app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const supabase = getSupabaseAdmin(c.env)
  await plansDb.deletePlan(supabase, id)
  return c.json({ ok: true })
})

export default app
