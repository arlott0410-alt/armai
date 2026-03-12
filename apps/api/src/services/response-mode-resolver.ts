/**
 * Resolves low-cost responses when router says template or retrieval.
 * Never returns payment/shipment/order state from cache; uses provided fresh context.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RouteCategory, ResponseMode } from './conversation-router.js';
import type { BuiltContext } from './ai-context.js';

export type ResolvedResponse =
  | { mode: 'template'; text: string }
  | { mode: 'retrieval'; text: string | null; needAi: boolean }
  | { mode: 'ai'; needAi: true }
  | { mode: 'escalation'; text: string };

export interface ResolverInput {
  routeCategory: RouteCategory;
  responseMode: ResponseMode;
  templateHint?: string;
  /** Fresh from DB; do not pass cached order/shipment state. */
  builtContext: BuiltContext | null;
  /** Fresh: tracking number if available. */
  trackingNumber: string | null;
  /** Fresh: COD enabled from merchant settings. */
  codEnabled: boolean;
  /** Optional: exact FAQ answer when retrieval path matches one. */
  faqAnswer: string | null;
  /** Merchant greeting override. */
  greetingTemplate: string | null;
}

export function resolveLowCostResponse(input: ResolverInput): ResolvedResponse {
  const { routeCategory, responseMode, templateHint, codEnabled, faqAnswer, greetingTemplate, trackingNumber } = input;

  if (responseMode === 'escalation') {
    return { mode: 'escalation', text: 'We will connect you with a team member shortly. Please wait.' };
  }

  if (responseMode === 'template') {
    if (templateHint === 'greeting') {
      return { mode: 'template', text: greetingTemplate ?? 'Hello! How can we help you today?' };
    }
    if (templateHint === 'ack') {
      return { mode: 'template', text: 'Got it. Anything else?' };
    }
  }

  if (responseMode === 'retrieval') {
    if (routeCategory === 'faq_knowledge_question' && faqAnswer) {
      return { mode: 'retrieval', text: faqAnswer, needAi: false };
    }
    if (routeCategory === 'shipping_question' && templateHint === 'tracking_lookup' && trackingNumber) {
      return { mode: 'retrieval', text: `Your tracking number is: ${trackingNumber}. You can track your parcel with the courier.`, needAi: false };
    }
    if (routeCategory === 'payment_slip_related' && templateHint === 'send_slip_instructions') {
      return { mode: 'retrieval', text: 'Please send your payment slip/transfer proof so we can confirm your order.', needAi: false };
    }
    if (routeCategory === 'switch_to_cod') {
      return { mode: 'retrieval', text: codEnabled ? 'COD is available. We can switch your order to pay on delivery.' : 'COD is not available for this order.', needAi: false };
    }
    if (routeCategory === 'switch_to_prepaid') {
      return { mode: 'retrieval', text: 'You can pay by transfer. Please use the payment details we sent and submit your slip after payment.', needAi: false };
    }
    return { mode: 'retrieval', text: null, needAi: true };
  }

  return { mode: 'ai', needAi: true };
}

/**
 * Try to find an exact or close FAQ match from structured context. Returns null if none.
 */
export function getFaqAnswerForQuery(query: string, faqs: Array<{ question: string; answer: string }>): string | null {
  const q = query.trim().toLowerCase();
  for (const faq of faqs) {
    if (faq.question.trim().toLowerCase().includes(q) || q.includes(faq.question.trim().toLowerCase())) {
      return faq.answer;
    }
  }
  return null;
}
