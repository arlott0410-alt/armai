import type { SupabaseClient } from '@supabase/supabase-js';
import type { MerchantPlanRow, MerchantBillingEventRow, MerchantInternalNoteRow } from '@armai/shared';
import { getMerchantDefaultCurrency, FALLBACK_CURRENCY } from '@armai/shared';
import * as merchantService from './merchant.js';

export async function getMerchantPlan(supabase: SupabaseClient, merchantId: string): Promise<MerchantPlanRow | null> {
  const { data, error } = await supabase
    .from('merchant_plans')
    .select('*')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as MerchantPlanRow | null;
}

export async function upsertMerchantPlan(
  supabase: SupabaseClient,
  merchantId: string,
  payload: Partial<{
    plan_code: string;
    billing_status: string;
    monthly_price_usd: number;
    currency: string;
    trial_ends_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    next_billing_at: string | null;
    last_paid_at: string | null;
    grace_until: string | null;
    cancel_at_period_end: boolean;
    is_auto_renew: boolean;
    notes: string | null;
  }>
) {
  const { data, error } = await supabase
    .from('merchant_plans')
    .upsert(
      {
        merchant_id: merchantId,
        ...payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'merchant_id' }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as MerchantPlanRow;
}

export async function listBillingEvents(
  supabase: SupabaseClient,
  merchantId: string,
  opts?: { limit?: number }
): Promise<MerchantBillingEventRow[]> {
  const limit = Math.min(opts?.limit ?? 50, 100);
  const { data, error } = await supabase
    .from('merchant_billing_events')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as MerchantBillingEventRow[];
}

export async function createBillingEvent(
  supabase: SupabaseClient,
  merchantId: string,
  payload: {
    event_type: string;
    amount: number;
    currency?: string;
    invoice_period_start?: string | null;
    invoice_period_end?: string | null;
    due_at?: string | null;
    paid_at?: string | null;
    status?: string;
    reference_note?: string | null;
  }
): Promise<MerchantBillingEventRow> {
  const merchant = await merchantService.getMerchantById(supabase, merchantId).catch(() => null);
  const defaultCurrency = merchant
    ? getMerchantDefaultCurrency(merchant.default_currency, merchant.default_country)
    : FALLBACK_CURRENCY;
  const currency = payload.currency ?? defaultCurrency;
  const { data, error } = await supabase
    .from('merchant_billing_events')
    .insert({
      merchant_id: merchantId,
      event_type: payload.event_type,
      amount: payload.amount,
      currency,
      invoice_period_start: payload.invoice_period_start ?? null,
      invoice_period_end: payload.invoice_period_end ?? null,
      due_at: payload.due_at ?? null,
      paid_at: payload.paid_at ?? null,
      status: payload.status ?? 'pending',
      reference_note: payload.reference_note ?? null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as MerchantBillingEventRow;
}

export async function listInternalNotes(
  supabase: SupabaseClient,
  merchantId: string,
  opts?: { limit?: number }
): Promise<MerchantInternalNoteRow[]> {
  const limit = Math.min(opts?.limit ?? 50, 100);
  const { data, error } = await supabase
    .from('merchant_internal_notes')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as MerchantInternalNoteRow[];
}

export async function addInternalNote(
  supabase: SupabaseClient,
  merchantId: string,
  actorId: string,
  note: string
): Promise<MerchantInternalNoteRow> {
  const { data, error } = await supabase
    .from('merchant_internal_notes')
    .insert({ merchant_id: merchantId, actor_id: actorId, note })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as MerchantInternalNoteRow;
}
