/**
 * Conversation router: classify incoming normalized events before AI.
 * Rule-first; AI only when needed. Works across Facebook and WhatsApp.
 */

import type { ChannelType } from '@armai/shared';

export type RouteCategory =
  | 'greeting'
  | 'generic_small_talk'
  | 'product_inquiry'
  | 'price_inquiry'
  | 'buy_intent'
  | 'payment_method_inquiry'
  | 'switch_to_cod'
  | 'switch_to_prepaid'
  | 'shipping_question'
  | 'shipment_image_related'
  | 'payment_slip_related'
  | 'bank_proof_related'
  | 'faq_knowledge_question'
  | 'request_human_escalation'
  | 'unsupported_unknown';

export type ResponseMode = 'template' | 'retrieval' | 'ai' | 'escalation';

export interface NormalizedIncomingEvent {
  merchantId: string;
  channelType: ChannelType;
  conversationId: string | null;
  customerId: string | null;
  messageType: string;
  text: string | null;
  mediaUrl: string | null;
  /** Fresh from DB when available; do not trust cache for routing. */
  activeOrderId: string | null;
  activeOrderPaymentStatus: string | null;
  activeOrderFulfillmentStatus: string | null;
  hasShipmentWithTracking: boolean;
  codEnabled: boolean;
}

export interface RouteResult {
  routeCategory: RouteCategory;
  responseMode: ResponseMode;
  /** When responseMode is 'template', optional pre-resolved text (response-mode-resolver may override). */
  templateHint?: string;
}

const GREETING_PATTERNS = /^(hi|hello|hey|sawasdee|สวัสดี|ดีครับ|ดีค่ะ|ดีคะ|good morning|good afternoon|good evening|สับ|ฮัลโล)[\s!.]*$/i;
const SMALL_TALK = /^(ok|okay|thanks|thank you|ขอขอบคุณ|ได้ครับ|ครับ|ค่ะ|cool|got it|เข้าใจ)[\s!.]*$/i;
const SHIPPING_QUESTIONS = /ship|shipped|tracking|delivery|deliver|ส่งของ|เลขพัสดุ|ติดตาม|จัดส่ง/i;
const PAYMENT_SLIP = /slip|transfer|โอน|สลิป|proof|proof of payment|หลักฐานการโอน/i;
const COD_PATTERNS = /cod|เก็บเงินปลายทาง|เก็บเงินที่บ้าน|pay on delivery|switch.*cod|เปลี่ยน.*cod/i;
const PREPAID_PATTERNS = /prepaid|โอนก่อน|transfer|pay.*before|switch.*prepaid|เปลี่ยน.*โอน/i;
const PRICE_PATTERNS = /price|cost|how much|เท่าไหร่|ราคา|กี่บาท|ค่าใช้จ่าย/i;
const PRODUCT_PATTERNS = /product|item|ของ|สินค้า|มีอะไร|what do you have|รายการ/i;
const BUY_INTENT = /buy|order|สั่ง|ซื้อ|want to purchase|ต้องการสั่ง/i;
const PAYMENT_METHOD = /payment|pay|วิธีชำระ|ชำระเงิน|บัญชี|account number/i;
const FAQ_KNOWLEDGE = /how to|where to|when|why|what is|where is|อย่างไร|ที่ไหน|เมื่อไหร่|ทำไม|คืออะไร/i;
const ESCALATION = /human|agent|representative|คน|พนักงาน|ติดต่อคน|พูดกับคน/i;

export function routeIncomingConversationEvent(event: NormalizedIncomingEvent): RouteResult {
  const t = (event.text ?? '').trim();
  const isImage = event.messageType === 'image' || !!event.mediaUrl;

  if (isImage) {
    if (event.activeOrderId) return { routeCategory: 'payment_slip_related', responseMode: 'retrieval', templateHint: 'slip_verification' };
    return { routeCategory: 'shipment_image_related', responseMode: 'ai' };
  }

  if (t.length === 0) return { routeCategory: 'unsupported_unknown', responseMode: 'ai' };

  if (GREETING_PATTERNS.test(t)) return { routeCategory: 'greeting', responseMode: 'template', templateHint: 'greeting' };
  if (SMALL_TALK.test(t)) return { routeCategory: 'generic_small_talk', responseMode: 'template', templateHint: 'ack' };

  if (SHIPPING_QUESTIONS.test(t)) {
    if (event.hasShipmentWithTracking && event.activeOrderId)
      return { routeCategory: 'shipping_question', responseMode: 'retrieval', templateHint: 'tracking_lookup' };
    return { routeCategory: 'shipping_question', responseMode: 'ai' };
  }
  if (PAYMENT_SLIP.test(t))
    return { routeCategory: 'payment_slip_related', responseMode: event.activeOrderId ? 'retrieval' : 'ai', templateHint: 'send_slip_instructions' };
  if (COD_PATTERNS.test(t)) return { routeCategory: 'switch_to_cod', responseMode: event.codEnabled ? 'retrieval' : 'ai' };
  if (PREPAID_PATTERNS.test(t)) return { routeCategory: 'switch_to_prepaid', responseMode: 'retrieval' };
  if (PRICE_PATTERNS.test(t)) return { routeCategory: 'price_inquiry', responseMode: 'retrieval' };
  if (PRODUCT_PATTERNS.test(t)) return { routeCategory: 'product_inquiry', responseMode: 'retrieval' };
  if (BUY_INTENT.test(t)) return { routeCategory: 'buy_intent', responseMode: 'retrieval' };
  if (PAYMENT_METHOD.test(t)) return { routeCategory: 'payment_method_inquiry', responseMode: 'retrieval' };
  if (FAQ_KNOWLEDGE.test(t)) return { routeCategory: 'faq_knowledge_question', responseMode: 'retrieval' };
  if (ESCALATION.test(t)) return { routeCategory: 'request_human_escalation', responseMode: 'escalation' };

  return { routeCategory: 'unsupported_unknown', responseMode: 'ai' };
}
