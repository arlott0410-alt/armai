/**
 * Conversation summary: compact per-conversation state for router and AI context.
 * Source of truth remains raw messages; summary is best-effort and safe to rebuild.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ConversationSummaryRow {
  id: string;
  merchant_id: string;
  conversation_id: string;
  recent_intent: string | null;
  recent_product_focus: string | null;
  active_order_id: string | null;
  active_payment_method: string | null;
  unresolved_questions: string | null;
  customer_profile_hints: string | null;
  latest_fulfillment_state: string | null;
  latest_payment_state: string | null;
  summary_version: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertSummaryInput {
  merchantId: string;
  conversationId: string;
  recentIntent?: string | null;
  recentProductFocus?: string | null;
  activeOrderId?: string | null;
  activePaymentMethod?: string | null;
  unresolvedQuestions?: string | null;
  customerProfileHints?: string | null;
  latestFulfillmentState?: string | null;
  latestPaymentState?: string | null;
}

export async function getConversationSummary(
  supabase: SupabaseClient,
  merchantId: string,
  conversationId: string
): Promise<ConversationSummaryRow | null> {
  const { data, error } = await supabase
    .from('conversation_summaries')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('conversation_id', conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertConversationSummary(
  supabase: SupabaseClient,
  input: UpsertSummaryInput
): Promise<ConversationSummaryRow> {
  const payload = {
    merchant_id: input.merchantId,
    conversation_id: input.conversationId,
    recent_intent: input.recentIntent ?? null,
    recent_product_focus: input.recentProductFocus ?? null,
    active_order_id: input.activeOrderId ?? null,
    active_payment_method: input.activePaymentMethod ?? null,
    unresolved_questions: input.unresolvedQuestions ?? null,
    customer_profile_hints: input.customerProfileHints ?? null,
    latest_fulfillment_state: input.latestFulfillmentState ?? null,
    latest_payment_state: input.latestPaymentState ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('conversation_summaries')
    .upsert(payload, {
      onConflict: 'conversation_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Bump version / clear summary for a conversation when critical state changes (e.g. order updated). */
export async function invalidateConversationSummary(
  supabase: SupabaseClient,
  merchantId: string,
  conversationId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversation_summaries')
    .update({
      summary_version: 0,
      latest_fulfillment_state: null,
      latest_payment_state: null,
      active_order_id: null,
      active_payment_method: null,
      updated_at: new Date().toISOString(),
    })
    .eq('merchant_id', merchantId)
    .eq('conversation_id', conversationId);
  if (error) throw new Error(error.message);
}
