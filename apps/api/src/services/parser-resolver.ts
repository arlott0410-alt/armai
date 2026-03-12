/**
 * Resolve which parser profile to use for a bank notification.
 * Uses bank_parser_profiles table; fallback to merchant_settings.bank_parser_id.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { genericBankParser } from '@armai/shared';

const GENERIC_PARSER_ID = genericBankParser.id;

export interface ParserResolutionInput {
  merchantId: string;
  bankCode: string | null;
  /** Optional: from raw payload for profile matching */
  sourceAppPackage?: string | null;
  locale?: string | null;
  rawMessage?: string | null;
}

export interface ParserResolutionResult {
  parserProfileId: string;
  parserId: string;
  parserFamily: string | null;
  parserVersion: string | null;
  source: 'profile' | 'merchant_settings' | 'fallback';
}

/**
 * Resolve parser profile by bank_code and optional hints. Returns profile id and app-level parser id.
 */
export async function resolveParserProfile(
  supabase: SupabaseClient,
  input: ParserResolutionInput
): Promise<ParserResolutionResult> {
  const { merchantId, bankCode } = input;
  const code = bankCode ?? 'GENERIC';

  let profile: { id: string; parser_family: string | null; parser_version: string | null } | null = null;
  const { data: profiles, error: profileError } = await supabase
    .from('bank_parser_profiles')
    .select('id, parser_family, parser_version')
    .eq('bank_code', code)
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(5);

  if (!profileError && profiles?.length) {
    profile = profiles[0];
    if (profiles.length > 1 && (input.sourceAppPackage ?? input.locale ?? input.rawMessage)) {
      const matched = profiles.find((p) => true);
      profile = matched ?? profile;
    }
  }

  if (profile) {
    return {
      parserProfileId: profile.id,
      parserId: profile.id,
      parserFamily: profile.parser_family,
      parserVersion: profile.parser_version,
      source: 'profile',
    };
  }

  const { data: settings } = await supabase
    .from('merchant_settings')
    .select('bank_parser_id')
    .eq('merchant_id', merchantId)
    .single();

  const parserId = settings?.bank_parser_id ?? GENERIC_PARSER_ID;
  return {
    parserProfileId: parserId,
    parserId,
    parserFamily: 'generic_fallback',
    parserVersion: '1.0.0',
    source: settings?.bank_parser_id ? 'merchant_settings' : 'fallback',
  };
}
