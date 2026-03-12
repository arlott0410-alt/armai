/**
 * WhatsApp Cloud API outbound messages.
 * Session vs template policy: session allowed within 24h of last customer message.
 */

const WA_GRAPH_BASE = 'https://graph.facebook.com/v18.0';

export interface SendWhatsAppOptions {
  phoneNumberId: string;
  to: string;
  accessToken: string;
  text?: string;
  imageUrl?: string;
  caption?: string;
}

/** Check if we can send a session message (customer messaged within 24h). */
export function isWithinSessionWindow(lastInboundAt: Date, now: Date = new Date()): boolean {
  const ms = now.getTime() - lastInboundAt.getTime();
  return ms <= 24 * 60 * 60 * 1000;
}

/** Send text message (session or template). */
export async function sendWhatsAppText(
  options: SendWhatsAppOptions
): Promise<{ messageId: string | null; error?: string }> {
  const { phoneNumberId, to, accessToken, text } = options;
  if (!text?.trim()) {
    return { messageId: null, error: 'Missing text' };
  }
  const url = `${WA_GRAPH_BASE}/${phoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to.replace(/\D/g, ''),
    type: 'text',
    text: { body: text.slice(0, 4096) },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string } };
  if (!res.ok) {
    return { messageId: null, error: data.error?.message ?? `HTTP ${res.status}` };
  }
  return { messageId: data.messages?.[0]?.id ?? null };
}

/** Send image by URL (session or template). */
export async function sendWhatsAppImage(
  options: SendWhatsAppOptions
): Promise<{ messageId: string | null; error?: string }> {
  const { phoneNumberId, to, accessToken, imageUrl, caption } = options;
  if (!imageUrl?.trim()) {
    return { messageId: null, error: 'Missing image URL' };
  }
  const url = `${WA_GRAPH_BASE}/${phoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to.replace(/\D/g, ''),
    type: 'image',
    image: {
      link: imageUrl,
      caption: caption?.slice(0, 1024),
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string } };
  if (!res.ok) {
    return { messageId: null, error: data.error?.message ?? `HTTP ${res.status}` };
  }
  return { messageId: data.messages?.[0]?.id ?? null };
}
