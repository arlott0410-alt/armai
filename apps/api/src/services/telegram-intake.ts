import type { SupabaseClient } from '@supabase/supabase-js';
import * as telegram from './telegram.js';
import * as shipmentImage from './shipment-image.js';

/** Incoming Telegram update (minimal shape we need). */
export type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id: number;
    chat?: { id: number | string; title?: string };
    from?: { id: number; username?: string; first_name?: string; last_name?: string };
    text?: string;
    caption?: string;
    photo?: { file_id: string; width: number; height: number }[];
    reply_to_message?: {
      message_id: number;
      text?: string;
      caption?: string;
      from?: { id: number };
    };
  };
};

function getMessageType(update: TelegramUpdate): 'text' | 'photo' | 'command' | 'reply' {
  const msg = update.message;
  if (!msg) return 'text';
  if (msg.photo && msg.photo.length > 0) return 'photo';
  const t = (msg.text ?? msg.caption ?? '').trim();
  if (t.startsWith('/')) return 'command';
  if (msg.reply_to_message) return 'reply';
  return 'text';
}

/** Get Telegram file URL from file_id (for storing in shipment_images). */
export async function getTelegramFileUrl(botToken: string, fileId: string): Promise<string | null> {
  const url = `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`;
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { file_path?: string } };
  if (!data.ok || !data.result?.file_path) return null;
  return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
}

/**
 * Process incoming Telegram update: store message, handle photo (shipment image) and reply (order link).
 * Caller must have resolved merchantId and verified group + optional admin.
 */
export async function processTelegramUpdate(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    update: TelegramUpdate;
    connection: telegram.TelegramConnectionRow;
  }
): Promise<{ processed: boolean; reply?: string }> {
  const msg = p.update.message;
  if (!msg || !msg.chat) return { processed: false };

  const chatId = String(msg.chat.id);
  const telegramUserId = msg.from?.id != null ? String(msg.from.id) : null;
  const messageType = getMessageType(p.update);

  const { data: tm, error: insertErr } = await supabase
    .from('telegram_messages')
    .insert({
      merchant_id: p.merchantId,
      telegram_chat_id: chatId,
      telegram_message_id: String(msg.message_id),
      telegram_user_id: telegramUserId,
      message_type: messageType,
      raw_payload_json: p.update as unknown as Record<string, unknown>,
      processed_status: 'received',
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertErr || !tm) {
    await supabase.from('telegram_messages').update({ processed_status: 'failed', updated_at: new Date().toISOString() }).eq('id', tm?.id ?? '');
    return { processed: false };
  }

  const settings = await telegram.getMerchantTelegramSettings(supabase, p.merchantId);
  const requireAuth = settings.telegram_require_authorized_admins !== false;
  const allowedShipment = settings.telegram_allow_shipment_confirmation === true;
  const isAdmin = telegramUserId ? await telegram.isAuthorizedTelegramAdmin(supabase, p.merchantId, telegramUserId) : false;
  const canAct = !requireAuth || isAdmin;

  if (messageType === 'photo' && allowedShipment && canAct) {
    const fileId = msg.photo?.[msg.photo.length - 1]?.file_id;
    if (fileId) {
      const imageUrl = await getTelegramFileUrl(p.connection.bot_token_encrypted_or_bound_reference!, fileId);
      const caption = (msg.caption ?? '').trim();
      const result = await shipmentImage.createFromTelegram(supabase, {
        merchantId: p.merchantId,
        telegramMessageId: tm.id,
        imageUrl: imageUrl ?? undefined,
        fileId,
        caption,
        telegramUserId: telegramUserId ?? undefined,
      });
      if (result.status === 'needs_manual_link') {
        const sent = await telegram.sendTelegramText(
          p.connection.bot_token_encrypted_or_bound_reference!,
          chatId,
          'Shipment image received. Order unclear. Please reply to this message with the order number.'
        );
        if (sent.ok) {
          await supabase.from('telegram_messages').update({ processed_status: 'needs_manual_link', updated_at: new Date().toISOString() }).eq('id', tm.id);
        }
      }
      await supabase.from('telegram_messages').update({ processed_status: 'processed', updated_at: new Date().toISOString() }).eq('id', tm.id);
      return { processed: true };
    }
  }

  if (messageType === 'reply' && canAct && msg.reply_to_message) {
    const replyText = (msg.text ?? msg.caption ?? '').trim();
    const linked = await shipmentImage.tryLinkFromTelegramReply(supabase, p.connection, chatId, replyText);
    if (linked) {
      await supabase.from('telegram_messages').update({ processed_status: 'processed', updated_at: new Date().toISOString() }).eq('id', tm.id);
      return { processed: true, reply: 'Order linked. Customer will be notified if enabled.' };
    }
  }

  if (messageType === 'command') {
    const text = (msg.text ?? '').trim();
    if (text === '/help' || text.startsWith('/help ')) {
      const lines = [
        '<b>ArmAI Operations</b>',
        '• Send a <b>photo</b> (shipment slip/waybill) to link to an order.',
        '• If the order is unclear, reply to the bot with the <b>order number</b>.',
        '• /pending — paid orders awaiting shipment (optional)',
        '• /order &lt;number&gt; — order details (optional)',
      ];
      await telegram.sendTelegramText(p.connection.bot_token_encrypted_or_bound_reference!, chatId, lines.join('\n'));
      await supabase.from('telegram_messages').update({ processed_status: 'processed', updated_at: new Date().toISOString() }).eq('id', tm.id);
      return { processed: true };
    }
  }

  await supabase.from('telegram_messages').update({ processed_status: 'ignored', updated_at: new Date().toISOString() }).eq('id', tm.id);
  return { processed: true };
}
