import type { SupabaseClient } from '@supabase/supabase-js';
import { createMerchantBodySchema, getMerchantDefaultCurrency, DEFAULT_COUNTRY } from '@armai/shared';

export type CreateMerchantInput = ReturnType<typeof createMerchantBodySchema.parse>;

/**
 * Create merchant + profile (via Supabase Auth Admin) + membership + settings.
 * Caller must use service role and ensure actor is super_admin.
 * Auth user creation must be done via Supabase Auth Admin API (not in SQL).
 */
export async function createMerchant(
  supabase: SupabaseClient,
  input: CreateMerchantInput
): Promise<{ merchantId: string; userId: string }> {
  const parsed = createMerchantBodySchema.parse(input);
  const defaultCountry = parsed.default_country ?? DEFAULT_COUNTRY;
  const defaultCurrency = getMerchantDefaultCurrency(parsed.default_currency, defaultCountry);
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .insert({
      name: parsed.name,
      slug: parsed.slug,
      billing_status: 'trialing',
      default_country: defaultCountry,
      default_currency: defaultCurrency,
    })
    .select('id')
    .single();
  if (merchantError || !merchant) {
    throw new Error(merchantError?.message ?? 'Failed to create merchant');
  }
  return { merchantId: merchant.id };
}

export async function getMerchantById(supabase: SupabaseClient, merchantId: string) {
  const { data, error } = await supabase.from('merchants').select('*').eq('id', merchantId).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMerchantSettings(supabase: SupabaseClient, merchantId: string) {
  const { data, error } = await supabase
    .from('merchant_settings')
    .select('*')
    .eq('merchant_id', merchantId)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data;
}

export async function listMerchantsForSuper(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('merchants')
    .select('id, name, slug, billing_status, default_country, default_currency, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
