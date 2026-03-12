import { Hono } from 'hono'
import type { Env } from '../../env.js'
import { getSupabaseAdmin } from '../../lib/supabase.js'
import {
  parseWhatsAppWebhookBody,
  extractMessageChanges,
  storeWhatsAppWebhookEvent,
  ingestWhatsAppMessage,
} from '../../services/whatsapp-webhook.js'
import {
  resolveWhatsAppPhoneToMerchant,
  getOrCreateChannelConnectionWhatsApp,
} from '../../services/channel.js'
import { getReplyForIncomingWhatsApp } from '../../services/whatsapp-auto-reply.js'
import * as channelSender from '../../services/channel-sender.js'

async function hmacSha256(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifySignature(
  body: string,
  signature: string | undefined,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) return false
  const expected = 'sha256=' + (await hmacSha256(secret, body))
  return signature === expected
}

const app = new Hono<{ Bindings: Env }>()

/** GET: Webhook verification (WhatsApp Cloud API). */
app.get('/', async (c) => {
  const query = Object.fromEntries(
    c.req.raw.url
      .split('?')[1]
      ?.split('&')
      .map((p) => p.split('=')) ?? []
  ) as Record<string, string>
  const mode = query['hub.mode']
  const token = query['hub.verify_token']
  const challenge = query['hub.challenge']
  if (mode === 'subscribe') {
    const expectedToken = c.env.WHATSAPP_VERIFY_TOKEN
    if (expectedToken && token !== expectedToken) {
      return c.text('Forbidden', 403)
    }
    return c.text(challenge ?? '', 200, {
      'Content-Type': 'text/plain',
    })
  }
  return c.text('OK')
})

/** POST: Incoming webhook events. */
app.post('/', async (c) => {
  const rawBody = await c.req.text()
  const signature = c.req.header('x-hub-signature-256')
  const secret = c.env.WHATSAPP_APP_SECRET ?? c.env.FACEBOOK_APP_SECRET
  if (secret && !(await verifySignature(rawBody, signature, secret))) {
    return c.json({ error: 'Invalid signature' }, 401)
  }
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = parseWhatsAppWebhookBody(body)
  if (!parsed) {
    return c.json({ error: 'Invalid payload' }, 400)
  }

  const supabase = getSupabaseAdmin(c.env)
  const changes = extractMessageChanges(parsed)

  for (const { phoneNumberId, value } of changes) {
    const merchantId = await resolveWhatsAppPhoneToMerchant(supabase, phoneNumberId)
    await storeWhatsAppWebhookEvent(supabase, {
      merchantId,
      rawPayload: body,
    })
    if (!merchantId) continue

    await getOrCreateChannelConnectionWhatsApp(supabase, merchantId, phoneNumberId)

    const forReply = await ingestWhatsAppMessage(supabase, {
      merchantId,
      phoneNumberId,
      value,
      getMediaUrl: undefined,
    })

    for (const { conversationId, senderId, text } of forReply) {
      try {
        const replyText = await getReplyForIncomingWhatsApp(c.env, {
          merchantId,
          conversationId,
          customerMessage: text,
        })
        if (replyText) {
          await channelSender.sendChannelMessage({
            supabase,
            env: c.env,
            conversationId,
            payload: { text: replyText, message_type: 'text' },
          })
        }
      } catch {
        // Log but do not fail webhook
      }
    }
  }

  return c.json({ ok: true })
})

export default app
