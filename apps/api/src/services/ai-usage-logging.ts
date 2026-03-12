/**
 * Log router and AI usage for metrics. No PII or message content.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResponseMode } from './conversation-router.js';
import type { RouteCategory } from './conversation-router.js';

export type AiCallReason =
  | 'selling_conversation'
  | 'ambiguity_resolution'
  | 'freeform_merchant_knowledge'
  | 'unsupported_rule_case'
  | 'template'
  | 'retrieval'
  | 'escalation';

export interface LogAiUsageInput {
  merchantId: string;
  conversationId: string | null;
  responseMode: ResponseMode;
  aiCallReason?: AiCallReason | null;
  routeCategory?: RouteCategory | null;
}

export async function logAiUsage(supabase: SupabaseClient, input: LogAiUsageInput): Promise<void> {
  const { error } = await supabase.from('ai_usage_events').insert({
    merchant_id: input.merchantId,
    conversation_id: input.conversationId ?? null,
    response_mode: input.responseMode,
    ai_call_reason: input.aiCallReason ?? null,
    route_category: input.routeCategory ?? null,
  });
  if (error) throw new Error(error.message);
}
