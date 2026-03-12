import { Hono } from 'hono'
import type { Env } from '../env.js'
import { getPlansPublic } from '../services/subscription.js'

const app = new Hono<{ Bindings: Env }>()

/** Public: list subscription plans with USD and Kip pricing. */
app.get('/', (c) => {
  const plans = getPlansPublic()
  return c.json({ plans })
})

export default app
