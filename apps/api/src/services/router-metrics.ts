/**
 * Metrics from ai_usage_events. Tenant-scoped; no PII.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface RouterMetrics {
  totalInbound: number;
  ruleHandled: number;
  retrievalHandled: number;
  aiHandled: number;
  escalated: number;
  from: string;
  to: string;
}

export async function getRouterMetrics(
  supabase: SupabaseClient,
  merchantId: string,
  from: Date,
  to: Date
): Promise<RouterMetrics> {
  const fromStr = from.toISOString();
  const toStr = to.toISOString();
  const { data, error } = await supabase
    .from('ai_usage_events')
    .select('response_mode')
    .eq('merchant_id', merchantId)
    .gte('created_at', fromStr)
    .lte('created_at', toStr);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const totalInbound = rows.length;
  const ruleHandled = rows.filter((r) => r.response_mode === 'template').length;
  const retrievalHandled = rows.filter((r) => r.response_mode === 'retrieval').length;
  const aiHandled = rows.filter((r) => r.response_mode === 'ai').length;
  const escalated = rows.filter((r) => r.response_mode === 'escalation').length;
  return {
    totalInbound,
    ruleHandled,
    retrievalHandled,
    aiHandled,
    escalated,
    from: fromStr,
    to: toStr,
  };
}
