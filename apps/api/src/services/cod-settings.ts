import type { SupabaseClient } from '@supabase/supabase-js';
import * as contextCache from './ai-context-cache.js';

export interface MerchantCodSettingsRow {
  merchant_id: string;
  enable_cod: boolean;
  cod_min_order_amount: number | null;
  cod_max_order_amount: number | null;
  cod_fee_amount: number;
  require_phone_for_cod: boolean;
  require_full_address_for_cod: boolean;
  cod_requires_manual_confirmation: boolean;
  cod_notes_for_ai: string | null;
  created_at: string;
  updated_at: string;
}

export async function getMerchantCodSettings(supabase: SupabaseClient, merchantId: string): Promise<MerchantCodSettingsRow | null> {
  const { data, error } = await supabase
    .from('merchant_cod_settings')
    .select('*')
    .eq('merchant_id', merchantId)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data;
}

export async function upsertMerchantCodSettings(
  supabase: SupabaseClient,
  merchantId: string,
  update: Partial<Omit<MerchantCodSettingsRow, 'merchant_id' | 'created_at'>>
) {
  const payload = {
    merchant_id: merchantId,
    ...update,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('merchant_cod_settings').upsert(payload, { onConflict: 'merchant_id' });
  if (error) throw new Error(error.message);
  contextCache.invalidate(merchantId, 'cod_settings');
}
