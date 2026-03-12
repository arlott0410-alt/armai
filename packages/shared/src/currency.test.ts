import { describe, it, expect } from 'vitest';
import {
  getDefaultCurrencyForCountry,
  getMerchantDefaultCurrency,
  formatMoney,
  parseMoneyInput,
  FALLBACK_CURRENCY,
  CURRENCY_LAK,
  CURRENCY_THB,
  COUNTRY_LA,
  COUNTRY_TH,
} from './currency.js';

describe('getDefaultCurrencyForCountry', () => {
  it('returns LAK for LA', () => {
    expect(getDefaultCurrencyForCountry('LA')).toBe(CURRENCY_LAK);
  });
  it('returns THB for TH', () => {
    expect(getDefaultCurrencyForCountry('TH')).toBe(CURRENCY_THB);
  });
  it('returns fallback for unknown country', () => {
    expect(getDefaultCurrencyForCountry('XX')).toBe(FALLBACK_CURRENCY);
  });
  it('returns fallback for null/undefined', () => {
    expect(getDefaultCurrencyForCountry(null)).toBe(FALLBACK_CURRENCY);
    expect(getDefaultCurrencyForCountry(undefined)).toBe(FALLBACK_CURRENCY);
  });
});

describe('getMerchantDefaultCurrency', () => {
  it('uses default_currency when set', () => {
    expect(getMerchantDefaultCurrency('LAK', 'TH')).toBe('LAK');
  });
  it('derives from default_country when default_currency not set', () => {
    expect(getMerchantDefaultCurrency(null, COUNTRY_LA)).toBe(CURRENCY_LAK);
    expect(getMerchantDefaultCurrency(undefined, COUNTRY_TH)).toBe(CURRENCY_THB);
  });
  it('returns fallback when both missing', () => {
    expect(getMerchantDefaultCurrency(null, null)).toBe(FALLBACK_CURRENCY);
  });
});

describe('formatMoney', () => {
  it('formats THB with symbol', () => {
    expect(formatMoney(1000, 'THB')).toBe('฿1,000');
  });
  it('formats LAK with symbol', () => {
    expect(formatMoney(50000, 'LAK')).toContain('50');
  });
  it('formats USD with 2 decimals', () => {
    expect(formatMoney(10.5, 'USD')).toBe('$10.5');
  });
  it('can show code', () => {
    expect(formatMoney(100, 'THB', { showCode: true })).toContain('THB');
  });
});

describe('parseMoneyInput', () => {
  it('parses number string', () => {
    expect(parseMoneyInput('100')).toBe(100);
  });
  it('strips commas', () => {
    expect(parseMoneyInput('1,000')).toBe(1000);
  });
  it('returns null for invalid', () => {
    expect(parseMoneyInput('')).toBe(null);
    expect(parseMoneyInput('abc')).toBe(null);
    expect(parseMoneyInput('-1')).toBe(null);
  });
});
