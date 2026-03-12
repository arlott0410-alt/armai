/**
 * Public endpoints (no auth). Used by Pricing page for subscription bank details.
 */

import { Hono } from 'hono'
import type { Env } from '../../env.js'
import { getSupabaseAdmin } from '../../lib/supabase.js'

const app = new Hono<{ Bindings: Env }>()
const BANK_SETTINGS_KEY = 'subscription_bank'

/** GET /api/public/subscription-bank — returns bank details from DB (no cache). Merchants see latest after super admin saves. */
app.get('/subscription-bank', async (c) => {
  const supabase = getSupabaseAdmin(c.env)
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', BANK_SETTINGS_KEY)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  const value = data?.value
  if (value == null || typeof value !== 'object' || !('bank_name' in value)) {
    return c.json({
      bank_name: null,
      account_number: null,
      account_holder: null,
      qr_image_url: null,
    })
  }
  const row = value as {
    bank_name?: string
    account_number?: string
    account_holder?: string
    qr_image_url?: string | null
  }
  return c.json({
    bank_name: row.bank_name ?? '',
    account_number: row.account_number ?? '',
    account_holder: row.account_holder ?? '',
    qr_image_url: row.qr_image_url ?? null,
  })
})

export default app
