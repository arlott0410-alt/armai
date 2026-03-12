import { Hono } from 'hono'
import type { Env } from '../../env.js'
import { authMiddleware, requireSuperAdmin } from '../../middleware/auth.js'
import { getSupabaseAdmin } from '../../lib/supabase.js'
import { z } from 'zod'

const app = new Hono<{
  Bindings: Env
  Variables: { auth: import('../../middleware/auth.js').AuthContext }
}>()

const BANK_SETTINGS_KEY = 'subscription_bank'

const bankSettingsSchema = z.object({
  bank_name: z.string().min(1).max(200),
  account_number: z.string().min(1).max(50),
  account_holder: z.string().min(1).max(200),
  qr_image_url: z.string().max(500).optional().nullable(), // R2 key or full URL
})

const patchBodySchema = z.object({
  bank: bankSettingsSchema.optional(),
})

/** GET /api/system/settings — public read for bank details (pricing modal). */
app.get('/settings', async (c) => {
  const supabase = getSupabaseAdmin(c.env)
  const { data: row, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', BANK_SETTINGS_KEY)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  const value = (row?.value as Record<string, unknown>) ?? null
  return c.json({
    bank:
      value && typeof value === 'object' && 'bank_name' in value
        ? {
            bank_name: (value as { bank_name?: string }).bank_name ?? '',
            account_number: (value as { account_number?: string }).account_number ?? '',
            account_holder: (value as { account_holder?: string }).account_holder ?? '',
            qr_image_url: (value as { qr_image_url?: string | null }).qr_image_url ?? null,
          }
        : null,
  })
})

/** PATCH /api/system/settings — super_admin only. */
app.patch('/settings', authMiddleware, requireSuperAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = patchBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }
  const supabase = getSupabaseAdmin(c.env)
  const now = new Date().toISOString()
  if (parsed.data.bank) {
    const { error: upsertError } = await supabase.from('system_settings').upsert(
      {
        key: BANK_SETTINGS_KEY,
        value: {
          bank_name: parsed.data.bank.bank_name,
          account_number: parsed.data.bank.account_number,
          account_holder: parsed.data.bank.account_holder,
          qr_image_url: parsed.data.bank.qr_image_url ?? null,
        },
        updated_at: now,
      },
      { onConflict: 'key' }
    )
    if (upsertError) return c.json({ error: upsertError.message }, 400)
  }
  return c.json({ ok: true })
})

/** POST /api/system/settings/upload-qr — super_admin only; upload QR image to R2. */
app.post('/settings/upload-qr', authMiddleware, requireSuperAdmin, async (c) => {
  const bucket = c.env.SLIP_BUCKET
  if (!bucket) return c.json({ error: 'Upload not configured' }, 503)
  const body = await c.req.parseBody().catch(() => ({}))
  const file = body['file'] ?? body['qr']
  if (!file || typeof file === 'string') return c.json({ error: 'Missing file' }, 400)
  const f = file as File
  const ext = f.name?.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const key = `system/qr.${safeExt}`
  const contentType = f.type || (safeExt === 'png' ? 'image/png' : 'image/jpeg')
  await bucket.put(key, f.stream(), { httpMetadata: { contentType } })
  return c.json({ qr_image_url: key })
})

export default app
