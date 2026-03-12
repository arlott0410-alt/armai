import type { SupabaseClient } from '@supabase/supabase-js';
import { selectPaymentAccountForOrder, getMerchantDefaultCurrency, FALLBACK_CURRENCY } from '@armai/shared';
import type { CreateMerchantPaymentAccountBody } from '@armai/shared';
import type { MerchantPaymentAccount } from '@armai/shared';
import * as merchantService from './merchant.js';

export async function listPaymentAccounts(supabase: SupabaseClient, merchantId: string, activeOnly = true) {
  let q = supabase
    .from('merchant_payment_accounts')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('sort_order');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPaymentAccount(supabase: SupabaseClient, merchantId: string, accountId: string) {
  const { data, error } = await supabase
    .from('merchant_payment_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('merchant_id', merchantId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createPaymentAccount(supabase: SupabaseClient, merchantId: string, body: CreateMerchantPaymentAccountBody) {
  const merchant = await merchantService.getMerchantById(supabase, merchantId).catch(() => null);
  const defaultCurrency = merchant
    ? getMerchantDefaultCurrency(merchant.default_currency, merchant.default_country)
    : FALLBACK_CURRENCY;
  const currency = body.currency ?? defaultCurrency;
  const { data, error } = await supabase
    .from('merchant_payment_accounts')
    .insert({
      merchant_id: merchantId,
      bank_code: body.bank_code,
      account_name: body.account_name ?? null,
      account_number: body.account_number,
      account_holder_name: body.account_holder_name,
      currency,
      qr_image_path: body.qr_image_path ?? null,
      qr_image_object_key: body.qr_image_object_key ?? null,
      is_primary: body.is_primary ?? false,
      is_active: body.is_active ?? true,
      sort_order: body.sort_order ?? 0,
      notes: body.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePaymentAccount(supabase: SupabaseClient, merchantId: string, accountId: string, body: Partial<CreateMerchantPaymentAccountBody>) {
  const { data, error } = await supabase
    .from('merchant_payment_accounts')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('merchant_id', merchantId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Select account for a new order (deterministic, auditable). Uses primary or first active. */
export async function selectAccountForOrder(
  supabase: SupabaseClient,
  merchantId: string,
  context?: { categoryId?: string | null; totalAmount?: number }
): Promise<MerchantPaymentAccount | null> {
  const accounts = await listPaymentAccounts(supabase, merchantId, true);
  return selectPaymentAccountForOrder(accounts as MerchantPaymentAccount[], context);
}
