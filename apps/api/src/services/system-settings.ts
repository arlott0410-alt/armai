/**
 * Shared logic for reading subscription bank from KV or Supabase (used by GET /api/system/settings and GET /api/plans).
 */

import type { Env } from '../env.js'
import { getSupabaseAdmin } from '../lib/supabase.js'

const BANK_SETTINGS_KEY = 'subscription_bank'
const KV_SETTINGS_KEY = 'settings:subscription_bank'

export interface SubscriptionBankRow {
  bank_name: string
  account_number: string
  account_holder: string
  qr_image_url: string | null
}

function normalizeBank(value: Record<string, unknown> | null): SubscriptionBankRow | null {
  if (!value || typeof value !== 'object' || !('bank_name' in value)) return null
  return {
    bank_name: (value as { bank_name?: string }).bank_name ?? '',
    account_number: (value as { account_number?: string }).account_number ?? '',
    account_holder: (value as { account_holder?: string }).account_holder ?? '',
    qr_image_url: (value as { qr_image_url?: string | null }).qr_image_url ?? null,
  }
}

/** Get subscription bank from KV then Supabase. Used for public read (Pricing, plans). */
export async function getSubscriptionBank(env: Env): Promise<SubscriptionBankRow | null> {
  const kv = env.SETTINGS_KV
  if (kv) {
    try {
      const raw = await kv.get(KV_SETTINGS_KEY)
      if (raw != null) {
        const value = JSON.parse(raw) as Record<string, unknown>
        return normalizeBank(value)
      }
    } catch {
      // fallback to Supabase
    }
  }
  const supabase = getSupabaseAdmin(env)
  const { data: row, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', BANK_SETTINGS_KEY)
    .maybeSingle()
  if (error) return null
  const value = (row?.value as Record<string, unknown>) ?? null
  return normalizeBank(value)
}

/** subscription_bank shape for public API (name/holder as in user request). */
export function toSubscriptionBankPublic(row: SubscriptionBankRow | null) {
  if (!row) return null
  return {
    name: row.bank_name,
    account_number: row.account_number,
    holder: row.account_holder,
    qr_image_url: row.qr_image_url,
  }
}
