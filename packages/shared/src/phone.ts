/**
 * Phone normalization by country. Prevents duplicate customer identity from format variations.
 * Laos (+856, 020...), Thailand (66, 0...), and generic fallback.
 * Country codes (LA, TH) are in currency.ts.
 */

import { COUNTRY_LA, COUNTRY_TH } from './currency.js';

/** E.164 country calling codes. */
export const CALLING_CODE_LA = '856';
export const CALLING_CODE_TH = '66';

/**
 * Normalize phone to digits-only canonical form for matching.
 * Country-aware: strips local prefix and ensures consistent format for storage/lookup.
 * Returns null if too short or invalid.
 */
export function normalizePhoneByCountry(
  phone: string | null | undefined,
  countryCode: string | null | undefined
): string | null {
  if (phone == null || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;

  const country = countryCode?.toUpperCase().trim();

  if (country === COUNTRY_LA) {
    return normalizeLaosPhone(digits);
  }
  if (country === COUNTRY_TH) {
    return normalizeThailandPhone(digits);
  }
  return normalizePhoneGeneric(digits);
}

/**
 * Laos: +856 ... ; local 020, 030, etc. → 85620..., 85630...
 * Strip leading 0 when followed by 2 digits (local mobile prefix).
 */
function normalizeLaosPhone(digits: string): string | null {
  let d = digits;
  if (d.startsWith('856')) {
    d = d.slice(3);
  } else if (d.startsWith('0') && d.length >= 9) {
    d = d.slice(1);
  }
  if (d.length < 8) return null;
  return '856' + d;
}

/**
 * Thailand: 66... or 0... → 66...
 */
function normalizeThailandPhone(digits: string): string | null {
  let d = digits;
  if (d.startsWith('66') && d.length > 10) {
    d = d.slice(2);
  } else if (d.startsWith('0') && d.length >= 9) {
    d = d.slice(1);
  }
  if (d.length < 8) return null;
  return '66' + d;
}

/**
 * Generic: digits only, min 8. No country prefix added.
 * Used when country unknown (backward compat).
 */
function normalizePhoneGeneric(digits: string): string | null {
  if (digits.length < 8) return null;
  return digits;
}

/**
 * Backward-compatible: normalize to digits-only, min 8.
 * Use normalizePhoneByCountry when merchant/country is known (e.g. Laos).
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (phone == null || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return digits;
}
