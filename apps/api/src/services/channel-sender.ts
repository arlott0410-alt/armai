/**
 * Multi-channel outbound message router.
 * sendChannelMessage(channel_type, connection, customer, payload) -> Facebook or WhatsApp.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '../env.js'
import type { ChannelType, SendChannelMessagePayload } from '@armai/shared'
import * as whatsappSender from './whatsapp-sender.js'
import type { ChannelMessageType } from '@armai/shared'

export interface SendChannelMessageParams {
  supabase: SupabaseClient
  env: Env
  conversationId: string
  payload: SendChannelMessagePayload
}

export interface SendChannelMessageResult {
  sent: boolean
  channelType: ChannelType
  externalMessageId?: string | null
  error?: string
}

/**
 * Load conversation and resolve channel_type, external_account_id, external_customer_id.
 */
async function getConversationChannelInfo(
  supabase: SupabaseClient,
  conversationId: string
): Promise<{
  merchantId: string
  channelType: ChannelType
  externalAccountId: string
  externalCustomerId: string
} | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      'merchant_id, channel_type, external_account_id, external_customer_id, page_id, customer_psid'
    )
    .eq('id', conversationId)
    .single()
  if (error || !data) return null
  const channelType = (data.channel_type ?? 'facebook') as ChannelType
  const externalAccountId = data.external_account_id ?? data.page_id ?? ''
  const externalCustomerId = data.external_customer_id ?? data.customer_psid ?? ''
  if (!externalAccountId || !externalCustomerId) return null
  return {
    merchantId: data.merchant_id,
    channelType,
    externalAccountId,
    externalCustomerId,
  }
}

/**
 * Resolve WhatsApp access token for this connection.
 * Prefer connection.access_token (OAuth), then env.WHATSAPP_ACCESS_TOKEN, then access_token_reference.
 */
async function getWhatsAppAccessToken(
  env: Env,
  _merchantId: string,
  _phoneNumberId: string,
  connectionTokenOrRef: string | null
): Promise<string | null> {
  if (connectionTokenOrRef) return connectionTokenOrRef
  if (env.WHATSAPP_ACCESS_TOKEN) return env.WHATSAPP_ACCESS_TOKEN
  return null
}

/** Check if conversation has an inbound WhatsApp message within last 24h (session window). */
async function isWhatsAppSessionActive(
  supabase: SupabaseClient,
  merchantId: string,
  senderExternalId: string
): Promise<boolean> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('channel_messages')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('channel_type', 'whatsapp')
    .eq('sender_external_id', senderExternalId)
    .eq('direction', 'inbound')
    .gte('created_at', cutoff)
    .limit(1)
    .maybeSingle()
  return !!data?.id
}

/**
 * Send outbound message via the appropriate channel.
 * Writes to messages and channel_messages; for WhatsApp also calls Cloud API.
 */
export async function sendChannelMessage(
  params: SendChannelMessageParams
): Promise<SendChannelMessageResult> {
  const { supabase, env, conversationId, payload } = params
  const info = await getConversationChannelInfo(supabase, conversationId)
  if (!info) {
    return { sent: false, channelType: 'facebook', error: 'Conversation not found' }
  }

  const messageType: ChannelMessageType = payload.message_type ?? 'text'
  const contentText = payload.text ?? null
  const mediaUrl = payload.media_url ?? null

  if (info.channelType === 'facebook') {
    const { error } = await supabase.from('messages').insert({
      merchant_id: info.merchantId,
      conversation_id: conversationId,
      direction: 'outbound',
      content_type: messageType === 'image' ? 'image' : 'text',
      content_text: contentText,
      content_metadata: mediaUrl ? { url: mediaUrl } : undefined,
    })
    if (error) return { sent: false, channelType: 'facebook', error: error.message }
    await supabase.from('channel_messages').insert({
      merchant_id: info.merchantId,
      channel_type: 'facebook',
      sender_external_id: info.externalCustomerId,
      direction: 'outbound',
      message_type: messageType,
      text_content: contentText,
      media_url: mediaUrl,
    })
    return { sent: true, channelType: 'facebook' }
  }

  if (info.channelType === 'whatsapp') {
    const withinSession = await isWhatsAppSessionActive(
      supabase,
      info.merchantId,
      info.externalCustomerId
    )
    if (!withinSession) {
      return {
        sent: false,
        channelType: 'whatsapp',
        error: 'Outside 24h session window; use an approved template message',
      }
    }
    const { data: waConn } = await supabase
      .from('whatsapp_connections')
      .select('id, phone_number_id, access_token, access_token_reference')
      .eq('merchant_id', info.merchantId)
      .eq('phone_number_id', info.externalAccountId)
      .eq('is_active', true)
      .single()
    if (!waConn?.phone_number_id) {
      return { sent: false, channelType: 'whatsapp', error: 'WhatsApp connection not found' }
    }
    const token = await getWhatsAppAccessToken(
      env,
      info.merchantId,
      waConn.phone_number_id,
      (waConn as { access_token?: string | null }).access_token ?? waConn.access_token_reference
    )
    if (!token) {
      return { sent: false, channelType: 'whatsapp', error: 'WhatsApp access token not configured' }
    }

    let result: { messageId: string | null; error?: string }
    if (messageType === 'image' && mediaUrl) {
      result = await whatsappSender.sendWhatsAppImage({
        phoneNumberId: waConn.phone_number_id,
        to: info.externalCustomerId,
        accessToken: token,
        imageUrl: mediaUrl,
        caption: contentText ?? undefined,
      })
    } else {
      result = await whatsappSender.sendWhatsAppText({
        phoneNumberId: waConn.phone_number_id,
        to: info.externalCustomerId,
        accessToken: token,
        text: contentText ?? '',
      })
    }

    const { error: insertErr } = await supabase.from('messages').insert({
      merchant_id: info.merchantId,
      conversation_id: conversationId,
      direction: 'outbound',
      content_type: messageType === 'image' ? 'image' : 'text',
      content_text: contentText,
      content_metadata: mediaUrl ? { url: mediaUrl } : undefined,
      external_mid: result.messageId ?? undefined,
    })
    if (insertErr) return { sent: false, channelType: 'whatsapp', error: insertErr.message }

    await supabase.from('channel_messages').insert({
      merchant_id: info.merchantId,
      channel_type: 'whatsapp',
      external_message_id: result.messageId,
      sender_external_id: info.externalCustomerId,
      direction: 'outbound',
      message_type: messageType,
      text_content: contentText,
      media_url: mediaUrl,
    })

    return {
      sent: !!result.messageId,
      channelType: 'whatsapp',
      externalMessageId: result.messageId,
      error: result.error,
    }
  }

  return { sent: false, channelType: info.channelType, error: 'Unsupported channel' }
}
