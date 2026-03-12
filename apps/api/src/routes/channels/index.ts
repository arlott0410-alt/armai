import { Hono } from 'hono'
import type { Env } from '../../env.js'
import { authMiddleware, resolveMerchant, requireMerchantAdmin } from '../../middleware/auth.js'
import facebookRoutes from './facebook.js'
import whatsappRoutes from './whatsapp.js'

const app = new Hono<{
  Bindings: Env
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string }
}>()

app.use('/*', authMiddleware)
app.use('/*', resolveMerchant)
app.use('/*', requireMerchantAdmin)

app.route('/facebook', facebookRoutes)
app.route('/whatsapp', whatsappRoutes)

export default app
