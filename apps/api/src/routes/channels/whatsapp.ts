/**
 * WhatsApp Cloud API: OAuth connect (exchange code, get phone numbers, store).
 */

import { Hono } from 'hono'
import type { Env } from '../../env.js'
import { getSupabaseAdmin } from '../../lib/supabase.js'
import { whatsappConnectBodySchema } from '@armai/shared'
import { getOrCreateChannelConnectionWhatsApp } from '../../services/channel.js'

const GRAPH_API_VERSION = 'v18.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

const app = new Hono<{
  Bindings: Env
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string }
}>()

/** POST /connect — exchange OAuth code for token, fetch phone numbers, upsert whatsapp_connections. */
app.post('/connect', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = whatsappConnectBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400)
  }

  const appId = c.env.META_APP_ID ?? c.env.FACEBOOK_APP_ID
  const appSecret = c.env.META_APP_SECRET ?? c.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) {
    return c.json({ error: 'WhatsApp app not configured (META_APP_ID / META_APP_SECRET)' }, 503)
  }

  const { code, redirect_uri } = parsed.data

  // 1) Exchange code for short-lived access token
  const tokenUrl = new URL(`${GRAPH_BASE}/oauth/access_token`)
  tokenUrl.searchParams.set('client_id', appId)
  tokenUrl.searchParams.set('client_secret', appSecret)
  tokenUrl.searchParams.set('redirect_uri', redirect_uri)
  tokenUrl.searchParams.set('code', code)

  const tokenRes = await fetch(tokenUrl.toString())
  const tokenData = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string
    token_type?: string
    expires_in?: number
    error?: { message: string; code?: number }
  }
  if (!tokenRes.ok || tokenData.error) {
    const msg = tokenData.error?.message ?? `Token exchange failed: ${tokenRes.status}`
    return c.json({ error: msg }, 400)
  }
  let accessToken = tokenData.access_token
  if (!accessToken) return c.json({ error: 'No access token in response' }, 400)

  // 2) Optional: exchange for long-lived token (60 days)
  const longLivedUrl = new URL(`${GRAPH_BASE}/oauth/access_token`)
  longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token')
  longLivedUrl.searchParams.set('client_id', appId)
  longLivedUrl.searchParams.set('client_secret', appSecret)
  longLivedUrl.searchParams.set('fb_exchange_token', accessToken)
  const longRes = await fetch(longLivedUrl.toString())
  const longData = (await longRes.json().catch(() => ({}))) as { access_token?: string }
  if (longData.access_token) accessToken = longData.access_token

  // 3) Get businesses and WhatsApp phone numbers
  const bizUrl = new URL(`${GRAPH_BASE}/me/businesses`)
  bizUrl.searchParams.set(
    'fields',
    'id,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}'
  )
  bizUrl.searchParams.set('access_token', accessToken)
  const bizRes = await fetch(bizUrl.toString())
  const bizData = (await bizRes.json().catch(() => ({}))) as {
    data?: Array<{
      id: string
      owned_whatsapp_business_accounts?: {
        data?: Array<{
          id: string
          phone_numbers?: {
            data?: Array<{ id: string; display_phone_number?: string; verified_name?: string }>
          }
        }>
      }
    }>
    error?: { message: string }
  }
  if (!bizRes.ok || bizData.error) {
    const msg = bizData.error?.message ?? 'Failed to fetch businesses'
    return c.json({ error: msg }, 400)
  }

  const businesses = bizData.data ?? []
  let phoneNumberId: string | null = null
  let displayPhoneNumber: string | null = null
  let wabaId: string | null = null
  for (const biz of businesses) {
    const wabas = biz.owned_whatsapp_business_accounts?.data ?? []
    for (const waba of wabas) {
      const phones = waba.phone_numbers?.data ?? []
      if (phones.length > 0) {
        phoneNumberId = phones[0].id
        displayPhoneNumber = phones[0].display_phone_number ?? phones[0].verified_name ?? null
        wabaId = waba.id
        break
      }
    }
    if (phoneNumberId) break
  }
  if (!phoneNumberId) {
    return c.json(
      { error: 'No WhatsApp phone number found. Add a phone number in Meta Business Suite.' },
      400
    )
  }

  const merchantId = c.get('merchantId')
  const supabase = getSupabaseAdmin(c.env)
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('whatsapp_connections')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle()

  const row = {
    merchant_id: merchantId,
    phone_number_id: phoneNumberId,
    waba_id: wabaId,
    business_account_name: displayPhoneNumber,
    display_phone_number: displayPhoneNumber,
    access_token: accessToken,
    is_active: true,
    updated_at: now,
  }

  if (existing) {
    const { error } = await supabase
      .from('whatsapp_connections')
      .update({
        waba_id: row.waba_id,
        business_account_name: row.business_account_name,
        display_phone_number: row.display_phone_number,
        access_token: row.access_token,
        is_active: true,
        updated_at: now,
      })
      .eq('id', existing.id)
    if (error) return c.json({ error: error.message }, 400)
  } else {
    const { error } = await supabase.from('whatsapp_connections').insert(row)
    if (error) return c.json({ error: error.message }, 400)
  }

  await getOrCreateChannelConnectionWhatsApp(supabase, merchantId, phoneNumberId)

  return c.json({
    ok: true,
    phone_number_id: phoneNumberId,
    display_phone_number: displayPhoneNumber,
  })
})

/** DELETE /disconnect/:id — remove WhatsApp connection (and channel_connection). */
app.delete('/disconnect/:id', async (c) => {
  const id = c.req.param('id')
  const supabase = getSupabaseAdmin(c.env)
  const merchantId = c.get('merchantId')

  const { data: row, error: fetchErr } = await supabase
    .from('whatsapp_connections')
    .select('id, phone_number_id')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single()
  if (fetchErr || !row) return c.json({ error: 'Connection not found' }, 404)

  await supabase
    .from('channel_connections')
    .delete()
    .eq('merchant_id', merchantId)
    .eq('channel_type', 'whatsapp')
    .eq('external_account_id', row.phone_number_id)

  const { error: delErr } = await supabase
    .from('whatsapp_connections')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchantId)
  if (delErr) return c.json({ error: delErr.message }, 400)
  return c.json({ ok: true })
})

export default app
