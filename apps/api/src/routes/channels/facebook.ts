/**
 * Facebook Messenger channel: connect (OAuth token exchange + pages list) and store page.
 */

import { Hono } from 'hono'
import type { Env } from '../../env.js'
import { getSupabaseAdmin } from '../../lib/supabase.js'
import { facebookConnectBodySchema, facebookStorePageBodySchema } from '@armai/shared'
import { getOrCreateChannelConnectionFacebook } from '../../services/channel.js'

const GRAPH_API_VERSION = 'v18.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

const app = new Hono<{
  Bindings: Env
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string }
}>()

/** Exchange short-lived user token for long-lived, then return pages the user manages. */
app.post('/connect', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = facebookConnectBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400)
  }

  const appId = c.env.FACEBOOK_APP_ID
  const appSecret = c.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) {
    return c.json({ error: 'Facebook app not configured' }, 503)
  }

  const shortLivedToken = parsed.data.access_token

  // 1) Exchange short-lived for long-lived user token
  const tokenUrl = new URL(`${GRAPH_BASE}/oauth/access_token`)
  tokenUrl.searchParams.set('grant_type', 'fb_exchange_token')
  tokenUrl.searchParams.set('client_id', appId)
  tokenUrl.searchParams.set('client_secret', appSecret)
  tokenUrl.searchParams.set('fb_exchange_token', shortLivedToken)

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
  const longLivedUserToken = tokenData.access_token
  if (!longLivedUserToken) {
    return c.json({ error: 'No access token in exchange response' }, 400)
  }

  // 2) Get pages the user manages (with page access tokens)
  const accountsUrl = new URL(`${GRAPH_BASE}/me/accounts`)
  accountsUrl.searchParams.set('access_token', longLivedUserToken)
  accountsUrl.searchParams.set('fields', 'id,name,access_token')

  const accountsRes = await fetch(accountsUrl.toString())
  const accountsData = (await accountsRes.json().catch(() => ({}))) as {
    data?: Array<{ id: string; name?: string; access_token?: string }>
    error?: { message: string }
  }
  if (!accountsRes.ok || accountsData.error) {
    const msg = accountsData.error?.message ?? `Pages fetch failed: ${accountsRes.status}`
    return c.json({ error: msg }, 400)
  }
  const pages = (accountsData.data ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? p.id,
    access_token: p.access_token ?? null,
  }))

  return c.json({ pages })
})

/** Store selected page: insert facebook_pages + channel_connections. */
app.post('/pages', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = facebookStorePageBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400)
  }

  const supabase = getSupabaseAdmin(c.env)
  const merchantId = c.get('merchantId')
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('facebook_pages')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('page_id', parsed.data.page_id)
    .maybeSingle()

  if (existing) {
    const { error: updateErr } = await supabase
      .from('facebook_pages')
      .update({
        page_name: parsed.data.page_name ?? null,
        page_access_token: parsed.data.page_access_token,
        updated_at: now,
      })
      .eq('id', existing.id)
    if (updateErr) return c.json({ error: updateErr.message }, 400)
    const connId = await getOrCreateChannelConnectionFacebook(
      supabase,
      merchantId,
      parsed.data.page_id
    )
    return c.json({
      page: {
        id: existing.id,
        page_id: parsed.data.page_id,
        page_name: parsed.data.page_name ?? null,
        connection_id: connId,
      },
    })
  }

  const { data: inserted, error } = await supabase
    .from('facebook_pages')
    .insert({
      merchant_id: merchantId,
      page_id: parsed.data.page_id,
      page_name: parsed.data.page_name ?? null,
      page_access_token: parsed.data.page_access_token,
      updated_at: now,
    })
    .select('id, page_id, page_name')
    .single()

  if (error) return c.json({ error: error.message }, 400)
  if (!inserted) return c.json({ error: 'Insert failed' }, 500)

  const connId = await getOrCreateChannelConnectionFacebook(
    supabase,
    merchantId,
    parsed.data.page_id
  )

  return c.json({
    page: {
      id: inserted.id,
      page_id: inserted.page_id,
      page_name: inserted.page_name ?? null,
      connection_id: connId,
    },
  })
})

/** Disconnect: delete facebook_pages row (cascade or manual channel_connections). */
app.delete('/pages/:id', async (c) => {
  const id = c.req.param('id')
  const supabase = getSupabaseAdmin(c.env)
  const merchantId = c.get('merchantId')

  const { data: row, error: fetchErr } = await supabase
    .from('facebook_pages')
    .select('id, page_id')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single()

  if (fetchErr || !row) {
    return c.json({ error: 'Page not found' }, 404)
  }

  await supabase
    .from('channel_connections')
    .delete()
    .eq('merchant_id', merchantId)
    .eq('channel_type', 'facebook')
    .eq('external_account_id', row.page_id)

  const { error: deleteErr } = await supabase
    .from('facebook_pages')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchantId)

  if (deleteErr) return c.json({ error: deleteErr.message }, 400)
  return c.json({ ok: true })
})

export default app
