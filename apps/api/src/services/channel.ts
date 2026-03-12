/**
 * Multi-channel messaging abstraction.
 * Normalized storage (channel_messages, channel_customers) and conversation/message_buffers for existing pipeline.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelType, ChannelMessageType } from '@armai/shared';

export interface ChannelConnectionRow {
  id: string;
  merchant_id: string;
  channel_type: string;
  external_account_id: string;
  is_active: boolean;
}

/** Resolve merchant from Facebook page_id (existing table). */
export async function resolveFacebookPageToMerchant(
  supabase: SupabaseClient,
  pageId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('facebook_pages')
    .select('merchant_id')
    .eq('page_id', pageId)
    .single();
  return data?.merchant_id ?? null;
}

/** Resolve merchant from WhatsApp phone_number_id. */
export async function resolveWhatsAppPhoneToMerchant(
  supabase: SupabaseClient,
  phoneNumberId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('whatsapp_connections')
    .select('merchant_id')
    .eq('phone_number_id', phoneNumberId)
    .eq('is_active', true)
    .single();
  return data?.merchant_id ?? null;
}

/** Get or create channel_connection for Facebook (from facebook_pages). */
export async function getOrCreateChannelConnectionFacebook(
  supabase: SupabaseClient,
  merchantId: string,
  pageId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('channel_connections')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('channel_type', 'facebook')
    .eq('external_account_id', pageId)
    .single();
  if (existing) return existing.id;
  const { data: inserted, error } = await supabase
    .from('channel_connections')
    .insert({
      merchant_id: merchantId,
      channel_type: 'facebook',
      external_account_id: pageId,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) return null;
  return inserted?.id ?? null;
}

/** Get or create channel_connection for WhatsApp. */
export async function getOrCreateChannelConnectionWhatsApp(
  supabase: SupabaseClient,
  merchantId: string,
  phoneNumberId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('channel_connections')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('channel_type', 'whatsapp')
    .eq('external_account_id', phoneNumberId)
    .single();
  if (existing) return existing.id;
  const { data: waConn } = await supabase
    .from('whatsapp_connections')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('phone_number_id', phoneNumberId)
    .single();
  if (!waConn?.id) return null;
  const { data: inserted, error } = await supabase
    .from('channel_connections')
    .insert({
      merchant_id: merchantId,
      channel_type: 'whatsapp',
      external_account_id: phoneNumberId,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) return null;
  return inserted?.id ?? null;
}

/** Get or create channel_customer. */
export async function getOrCreateChannelCustomer(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    channelType: ChannelType;
    externalUserId: string;
    displayName?: string | null;
  }
): Promise<string> {
  const { data: existing } = await supabase
    .from('channel_customers')
    .select('id')
    .eq('merchant_id', p.merchantId)
    .eq('channel_type', p.channelType)
    .eq('external_user_id', p.externalUserId)
    .single();
  if (existing) return existing.id;
  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from('channel_customers')
    .insert({
      merchant_id: p.merchantId,
      channel_type: p.channelType,
      external_user_id: p.externalUserId,
      display_name: p.displayName ?? null,
      updated_at: now,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return inserted!.id;
}

/**
 * Get or create conversation for a channel.
 * For Facebook: page_id and customer_psid as before; for WhatsApp: page_id = phone_number_id, customer_psid = wa_id.
 */
export async function getOrCreateConversationForChannel(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    channelType: ChannelType;
    externalAccountId: string;
    externalCustomerId: string;
  }
): Promise<string> {
  const pageId = p.externalAccountId;
  const customerPsid = p.externalCustomerId;
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('merchant_id', p.merchantId)
    .eq('page_id', pageId)
    .eq('customer_psid', customerPsid)
    .single();
  if (existing) return existing.id;
  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from('conversations')
    .insert({
      merchant_id: p.merchantId,
      page_id: pageId,
      customer_psid: customerPsid,
      channel_type: p.channelType,
      external_account_id: p.externalAccountId,
      external_customer_id: p.externalCustomerId,
      updated_at: now,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return inserted!.id;
}

/** Insert normalized row into channel_messages. Optional merchant_customer_id when identity is linked. */
export async function insertChannelMessage(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    channelType: ChannelType;
    externalMessageId: string | null;
    senderExternalId: string;
    direction: 'inbound' | 'outbound';
    messageType: ChannelMessageType;
    textContent: string | null;
    mediaUrl: string | null;
    rawPayload: Record<string, unknown> | null;
    merchantCustomerId?: string | null;
  }
): Promise<string> {
  const row: Record<string, unknown> = {
    merchant_id: p.merchantId,
    channel_type: p.channelType,
    external_message_id: p.externalMessageId,
    sender_external_id: p.senderExternalId,
    direction: p.direction,
    message_type: p.messageType,
    text_content: p.textContent,
    media_url: p.mediaUrl,
    raw_payload: p.rawPayload,
  };
  if (p.merchantCustomerId != null) row.merchant_customer_id = p.merchantCustomerId;
  const { data, error } = await supabase.from('channel_messages').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  return data!.id;
}

/** Set conversation.merchant_customer_id when identity is linked (additive; does not overwrite with null). */
export async function setConversationMerchantCustomer(
  supabase: SupabaseClient,
  p: { merchantId: string; conversationId: string; merchantCustomerId: string }
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({
      merchant_customer_id: p.merchantCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', p.conversationId)
    .eq('merchant_id', p.merchantId);
  if (error) throw new Error(error.message);
}

/** Buffer incoming message for existing AI pipeline (message_buffers). */
export async function bufferIncomingMessageForConversation(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    conversationId: string;
    rawMid: string | null;
    rawText: string | null;
    rawAttachments: unknown;
  }
): Promise<void> {
  const { error } = await supabase.from('message_buffers').insert({
    merchant_id: p.merchantId,
    conversation_id: p.conversationId,
    raw_mid: p.rawMid,
    raw_text: p.rawText,
    raw_attachments: p.rawAttachments as Record<string, unknown>[] | null,
  });
  if (error) throw new Error(error.message);
}

/** Normalized inbound payload for AI: from channel_messages or built from webhook. */
export interface NormalizedInboundPayload {
  merchant_id: string;
  channel_type: ChannelType;
  customer_id: string;
  message_type: ChannelMessageType;
  text: string | null;
  media_url: string | null;
  timestamp: string;
}
