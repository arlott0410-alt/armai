/**
 * WhatsApp Cloud API webhook intake.
 * Verify, parse, resolve merchant, normalize to channel_messages, route to conversation + message_buffers.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { WhatsAppWebhookBody, WhatsAppChangeValue, WhatsAppMessage } from '@armai/shared';
import { whatsappWebhookBodySchema } from '@armai/shared';
import * as channel from './channel.js';
import * as customerIdentity from './customer-identity.js';
import type { ChannelMessageType } from '@armai/shared';

const WA_MESSAGE_TYPE_TO_CHANNEL: Record<string, ChannelMessageType> = {
  text: 'text',
  image: 'image',
  document: 'file',
  audio: 'file',
  video: 'file',
};

/** Store raw webhook event. */
export async function storeWhatsAppWebhookEvent(
  supabase: SupabaseClient,
  p: { merchantId: string | null; rawPayload: unknown }
): Promise<void> {
  const { error } = await supabase.from('webhook_events').insert({
    merchant_id: p.merchantId,
    kind: 'whatsapp_incoming',
    external_id: null,
    raw_payload: p.rawPayload as Record<string, unknown>,
  });
  if (error) throw new Error(error.message);
}

/** Parse and validate webhook body. */
export function parseWhatsAppWebhookBody(body: unknown): WhatsAppWebhookBody | null {
  const parsed = whatsappWebhookBodySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** Extract message changes from body (entry[].changes[].value). */
export function extractMessageChanges(body: WhatsAppWebhookBody): { phoneNumberId: string; value: WhatsAppChangeValue }[] {
  const out: { phoneNumberId: string; value: WhatsAppChangeValue }[] = [];
  const entries = body.entry ?? [];
  for (const entry of entries) {
    const changes = entry.changes ?? [];
    for (const c of changes) {
      const value = c.value;
      if (!value?.metadata?.phone_number_id || !value.messages?.length) continue;
      out.push({
        phoneNumberId: value.metadata.phone_number_id,
        value,
      });
    }
  }
  return out;
}

/** Map WhatsApp message to normalized type and text. */
function normalizeWaMessage(msg: WhatsAppMessage): { messageType: ChannelMessageType; text: string | null; mediaId: string | null } {
  const type = (msg.type ?? 'text') as string;
  const messageType = WA_MESSAGE_TYPE_TO_CHANNEL[type] ?? 'text';
  let text: string | null = msg.text?.body ?? null;
  if (!text && msg.image?.caption) text = msg.image.caption;
  if (!text && msg.document?.caption) text = msg.document.caption;
  const mediaId = msg.image?.id ?? msg.document?.id ?? null;
  return { messageType, text, mediaId };
}

/** Ingest one WhatsApp message: channel_messages + conversation + message_buffers. */
export async function ingestWhatsAppMessage(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    phoneNumberId: string;
    value: WhatsAppChangeValue;
    getMediaUrl?: (mediaId: string) => Promise<string | null>;
  }
): Promise<void> {
  const messages = p.value.messages ?? [];
  const contacts = p.value.contacts ?? [];
  const contactByFrom = new Map<string, { name?: string }>();
  for (const c of contacts) {
    if (c.wa_id) contactByFrom.set(c.wa_id, { name: c.profile?.name });
  }

  for (const msg of messages) {
    const from = msg.from;
    const displayName = contactByFrom.get(from)?.name ?? null;
    const { messageType, text, mediaId } = normalizeWaMessage(msg);
    let mediaUrl: string | null = null;
    if (mediaId && p.getMediaUrl) {
      mediaUrl = await p.getMediaUrl(mediaId);
    }

    await channel.getOrCreateChannelCustomer(supabase, {
      merchantId: p.merchantId,
      channelType: 'whatsapp',
      externalUserId: from,
      displayName: displayName ?? undefined,
    });

    const { id: identityId, merchantCustomerId } = await customerIdentity.getOrCreateChannelIdentity(supabase, {
      merchantId: p.merchantId,
      channelType: 'whatsapp',
      externalUserId: from,
      channelDisplayName: displayName ?? undefined,
      phoneNumber: from,
    });
    let linkedCustomerId: string | null = merchantCustomerId;
    if (!linkedCustomerId) {
      const norm = await customerIdentity.normalizePhoneForMerchant(supabase, p.merchantId, from);
      if (norm) {
        const autoLinked = await customerIdentity.tryAutoLinkByPhone(supabase, {
          merchantId: p.merchantId,
          channelIdentityId: identityId,
          normalizedPhone: norm,
        });
        if (autoLinked) linkedCustomerId = autoLinked;
      }
    }

    const conversationId = await channel.getOrCreateConversationForChannel(supabase, {
      merchantId: p.merchantId,
      channelType: 'whatsapp',
      externalAccountId: p.phoneNumberId,
      externalCustomerId: from,
    });
    if (linkedCustomerId) {
      await channel.setConversationMerchantCustomer(supabase, { merchantId: p.merchantId, conversationId, merchantCustomerId: linkedCustomerId });
    }

    await channel.insertChannelMessage(supabase, {
      merchantId: p.merchantId,
      channelType: 'whatsapp',
      externalMessageId: msg.id ?? null,
      senderExternalId: from,
      direction: 'inbound',
      messageType,
      textContent: text,
      mediaUrl,
      rawPayload: msg as unknown as Record<string, unknown>,
      merchantCustomerId: linkedCustomerId ?? undefined,
    });

    await channel.bufferIncomingMessageForConversation(supabase, {
      merchantId: p.merchantId,
      conversationId,
      rawMid: msg.id ?? null,
      rawText: text,
      rawAttachments: mediaUrl ? [{ type: messageType, url: mediaUrl }] : null,
    });
  }
}
