import { Hono } from 'hono'
import type { Env } from './env.js'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

function correlationId(): string {
  return crypto.randomUUID()
}

import health from './routes/health.js'
import auth from './routes/auth.js'
import onboard from './routes/onboard.js'
import plans from './routes/plans.js'
import subscribe from './routes/subscribe.js'
import superRoutes from './routes/super/index.js'
import merchantRoutes from './routes/merchant/index.js'
import settings from './routes/settings.js'
import orders from './routes/orders.js'
import support from './routes/support.js'
import paymentWebhook from './routes/webhooks/payment.js'
import facebookWebhook from './routes/webhooks/facebook.js'
import bankWebhook from './routes/webhooks/bank.js'
import telegramWebhook from './routes/webhooks/telegram.js'
import whatsappWebhook from './routes/webhooks/whatsapp.js'
import systemRoutes from './routes/system/index.js'

const app = new Hono<{ Bindings: Env; Variables: { correlationId: string } }>()

app.use('*', logger())
app.use('*', async (c, next) => {
  const id = c.req.header('x-correlation-id') ?? correlationId()
  c.set('correlationId', id)
  await next()
})
app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  })
)

app.route('/api/health', health)
app.route('/api/auth', auth)
app.route('/api/onboard', onboard)
app.route('/api/plans', plans)
app.route('/api/subscribe', subscribe)
app.route('/api/super', superRoutes)
app.route('/api/merchant', merchantRoutes)
app.route('/api/system', systemRoutes)
app.route('/api/settings', settings)
/** Serve R2 slip images (e.g. subscription transfer slips). Key = path after /api/slip/ */
app.get('/api/slip/*', async (c) => {
  const key = c.req.path.replace(/^\/api\/slip\/?/, '')
  if (!key) return c.json({ error: 'Missing key' }, 400)
  const bucket = (c.env as Env).SLIP_BUCKET
  if (!bucket) return c.json({ error: 'Not configured' }, 503)
  const object = await bucket.get(key)
  if (!object) return c.notFound()
  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream'
  return new Response(object.body, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=86400' },
  })
})
app.route('/api/orders', orders)
app.route('/api/support', support)
app.route('/api/webhooks/payment', paymentWebhook)
app.route('/api/webhooks/facebook', facebookWebhook)
app.route('/api/webhooks/bank', bankWebhook)
app.route('/api/webhooks/telegram', telegramWebhook)
app.route('/api/webhooks/whatsapp', whatsappWebhook)

app.notFound((c) => c.json({ error: 'Not Found' }, 404))
app.onError((err, c) => {
  try {
    const correlationId = c.get('correlationId') as string | undefined
    return c.json({ error: err.message ?? 'Internal Server Error', correlationId }, 500)
  } catch {
    return c.json({ error: err.message ?? 'Internal Server Error' }, 500)
  }
})

export default app
