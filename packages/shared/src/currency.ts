/**
 * Centralized currency and money handling for enterprise multi-country (Laos, Thailand, etc.).
 * ISO 4217 codes; country-aware defaults; single source of truth for display/input.
 */

/** ISO 3166-1 alpha-2 country codes we support for default currency. */
export const COUNTRY_LA = 'LA';
export const COUNTRY_TH = 'TH';

/** ISO 4217 currency codes. */
export const CURRENCY_LAK = 'LAK';
export const CURRENCY_THB = 'THB';
export const CURRENCY_USD = 'USD';

/** Default currency per country. Laos-first; extensible. */
export const DEFAULT_CURRENCY_BY_COUNTRY: Record<string, string> = {
  [COUNTRY_LA]: CURRENCY_LAK,
  [COUNTRY_TH]: CURRENCY_THB,
};

/** Currencies supported for display and storage. */
export const SUPPORTED_CURRENCIES = [CURRENCY_LAK, CURRENCY_THB, CURRENCY_USD] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** Default country when not set (backward compat: Thailand). */
export const DEFAULT_COUNTRY = COUNTRY_TH;

/** Default currency when country/merchant not set (backward compat). */
export const FALLBACK_CURRENCY = CURRENCY_THB;

/**
 * Resolve default currency for a country. Returns ISO 4217 code.
 */
export function getDefaultCurrencyForCountry(countryCode: string | null | undefined): string {
  if (!countryCode || typeof countryCode !== 'string') return FALLBACK_CURRENCY;
  const upper = countryCode.toUpperCase().trim();
  return DEFAULT_CURRENCY_BY_COUNTRY[upper] ?? FALLBACK_CURRENCY;
}

/**
 * Resolve display currency for a merchant (default_country / default_currency).
 * Prefers explicit default_currency; otherwise derives from default_country.
 */
export function getMerchantDefaultCurrency(
  defaultCurrency: string | null | undefined,
  defaultCountry: string | null | undefined
): string {
  const code = typeof defaultCurrency === 'string' ? defaultCurrency.trim().toUpperCase() : '';
  if (code.length === 3) return code;
  return getDefaultCurrencyForCountry(defaultCountry);
}

/** Symbol or code for UI. LAK often shown as "₭" or "LAK"; THB as "฿" or "THB". */
const CURRENCY_SYMBOL: Record<string, string> = {
  LAK: '₭',
  THB: '฿',
  USD: '$',
};

/**
 * Format amount for display. No rounding; shows 0–2 decimals by currency convention.
 * LAK/THB: no decimals for whole numbers; otherwise 2. USD: 2 decimals.
 */
export function formatMoney(
  amount: number,
  currency: string,
  opts?: { showCode?: boolean; compact?: boolean }
): string {
  const code = (currency || FALLBACK_CURRENCY).toUpperCase();
  const symbol = CURRENCY_SYMBOL[code] ?? code + ' ';
  const isWhole = Number.isInteger(amount);
  const decimals = code === 'USD' ? 2 : isWhole ? 0 : 2;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount);
  const part = opts?.compact ? formatted : `${symbol}${formatted}`;
  if (opts?.showCode) return `${part} ${code}`;
  return part;
}

/**
 * Parse numeric input for amount (e.g. form input). Returns null if invalid.
 */
export function parseMoneyInput(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const cleaned = String(value).replace(/,/g, '').trim();
  const n = Number(cleaned);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}
