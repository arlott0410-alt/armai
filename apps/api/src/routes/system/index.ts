import { Hono } from 'hono'
import type { Env } from '../../env.js'
import { authMiddleware, requireSuperAdmin } from '../../middleware/auth.js'
import { getSupabaseAdmin, getSupabaseAnon } from '../../lib/supabase.js'
import {
  getCachedResponse,
  setCachedResponse,
  deleteCachedResponse,
  cacheControlHeaders,
} from '../../lib/cache.js'
import { logRequest } from '../../lib/logger.js'
import { z } from 'zod'

const app = new Hono<{
  Bindings: Env
  Variables: { auth: import('../../middleware/auth.js').AuthContext; correlationId?: string }
}>()

const BANK_SETTINGS_KEY = 'subscription_bank'
const KV_SETTINGS_KEY = 'settings:subscription_bank'

const bankSettingsSchema = z.object({
  bank_name: z.string().min(1).max(200),
  account_number: z.string().min(1).max(50),
  account_holder: z.string().min(1).max(200),
  qr_image_url: z.string().max(500).optional().nullable(), // R2 key or full URL
})

const patchBodySchema = z.object({
  bank: bankSettingsSchema.optional(),
  /** Required when updating bank: current password to prevent unauthorized change. */
  password_confirm: z.string().min(1).optional(),
})

function normalizeBank(value: Record<string, unknown> | null) {
  if (!value || typeof value !== 'object' || !('bank_name' in value)) return null
  return {
    bank_name: (value as { bank_name?: string }).bank_name ?? '',
    account_number: (value as { account_number?: string }).account_number ?? '',
    account_holder: (value as { account_holder?: string }).account_holder ?? '',
    qr_image_url: (value as { qr_image_url?: string | null }).qr_image_url ?? null,
  }
}

/** GET /api/system/settings — public read for bank details. Cached (Cache API + KV). */
app.get('/settings', async (c) => {
  const url = c.req.url
  logRequest('/api/system/settings', c.get('correlationId') as string | undefined, {
    method: 'GET',
  })

  const cached = await getCachedResponse(url)
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: { ...Object.fromEntries(cached.headers), ...cacheControlHeaders() },
    })
  }

  const kv = c.env.SETTINGS_KV
  if (kv) {
    try {
      const raw = await kv.get(KV_SETTINGS_KEY)
      if (raw != null) {
        const value = JSON.parse(raw) as Record<string, unknown>
        const bank = normalizeBank(value)
        const body = { bank }
        const res = c.json(body)
        const headers = new Headers(res.headers)
        Object.entries(cacheControlHeaders()).forEach(([k, v]) => headers.set(k, v))
        const response = new Response(res.body, { status: res.status, headers })
        await setCachedResponse(url, response.clone())
        return response
      }
    } catch {
      // fallback to Supabase
    }
  }

  const supabase = getSupabaseAdmin(c.env)
  const { data: row, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', BANK_SETTINGS_KEY)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  const value = (row?.value as Record<string, unknown>) ?? null
  const bank = normalizeBank(value)
  if (kv && value) {
    try {
      await kv.put(KV_SETTINGS_KEY, JSON.stringify(value), { expirationTtl: 86400 * 7 })
    } catch {
      // ignore
    }
  }
  const res = c.json({ bank })
  const headers = new Headers(res.headers)
  Object.entries(cacheControlHeaders()).forEach(([k, v]) => headers.set(k, v))
  const response = new Response(res.body, { status: res.status, headers })
  // Only cache when bank is set so Pricing sees updates after super admin saves (avoid serving stale null)
  if (bank != null) await setCachedResponse(url, response.clone())
  return response
})

/** PATCH /api/system/settings — super_admin only. Bank change requires password_confirm and is audited. */
app.patch('/settings', authMiddleware, requireSuperAdmin, async (c) => {
  logRequest('/api/system/settings', c.get('correlationId') as string | undefined, {
    method: 'PATCH',
  })
  const auth = c.get('auth')
  const body = (await c.req.json().catch(() => ({}))) as {
    bank?: {
      bank_name: string
      account_number: string
      account_holder: string
      qr_image_url?: string | null
    }
    password_confirm?: string
  }
  const parsed = patchBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }
  if (parsed.data.bank) {
    if (!parsed.data.password_confirm || parsed.data.password_confirm.length < 1) {
      return c.json(
        { error: 'Password confirmation required to change bank account (security)' },
        400
      )
    }
    if (!auth.email) {
      return c.json({ error: 'Cannot verify password: no email on account' }, 400)
    }
    const anon = getSupabaseAnon(c.env, null)
    const { error: signInError } = await anon.auth.signInWithPassword({
      email: auth.email,
      password: parsed.data.password_confirm,
    })
    if (signInError) {
      return c.json({ error: 'Invalid password. Enter your current password to confirm.' }, 401)
    }
  }
  const supabase = getSupabaseAdmin(c.env)
  const now = new Date().toISOString()
  if (parsed.data.bank) {
    const value = {
      bank_name: parsed.data.bank.bank_name,
      account_number: parsed.data.bank.account_number,
      account_holder: parsed.data.bank.account_holder,
      qr_image_url: parsed.data.bank.qr_image_url ?? null,
    }
    const { error: upsertError } = await supabase
      .from('system_settings')
      .upsert({ key: BANK_SETTINGS_KEY, value, updated_at: now }, { onConflict: 'key' })
    if (upsertError) return c.json({ error: upsertError.message }, 400)
    const kv = c.env.SETTINGS_KV
    if (kv) {
      try {
        await kv.put(KV_SETTINGS_KEY, JSON.stringify(value), { expirationTtl: 86400 * 7 })
      } catch {
        // ignore
      }
    }
    // Invalidate GET cache so Pricing page shows new bank details on next load
    const getSettingsUrl = new URL(c.req.url)
    getSettingsUrl.search = ''
    await deleteCachedResponse(getSettingsUrl.toString())
    // Audit: who changed subscription bank and when (no sensitive data in details)
    await supabase.from('audit_logs').insert({
      actor_id: auth.userId,
      action: 'system_settings_updated',
      resource_type: 'system_settings',
      resource_id: null,
      details: { key: BANK_SETTINGS_KEY, at: now },
    })
  }
  return c.json({ ok: true })
})

/** POST /api/system/settings/upload-qr — super_admin only; upload QR image to R2. */
app.post('/settings/upload-qr', authMiddleware, requireSuperAdmin, async (c) => {
  const bucket = c.env.SLIP_BUCKET
  if (!bucket) return c.json({ error: 'Upload not configured' }, 503)
  const body = (await c.req.parseBody().catch(() => ({}))) as Record<string, string | File>
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
