import { describe, it, expect } from 'vitest';
import { normalizePhone, normalizePhoneByCountry } from './phone.js';

describe('normalizePhone (generic)', () => {
  it('strips non-digits', () => {
    expect(normalizePhone('+856 20 1234 5678')).toBe('8562012345678');
  });
  it('returns null for too short', () => {
    expect(normalizePhone('1234567')).toBe(null);
  });
  it('returns null for null/undefined', () => {
    expect(normalizePhone(null)).toBe(null);
    expect(normalizePhone(undefined)).toBe(null);
  });
});

describe('normalizePhoneByCountry (Laos)', () => {
  it('normalizes +856 prefix to canonical 856...', () => {
    expect(normalizePhoneByCountry('+8562012345678', 'LA')).toBe('8562012345678');
  });
  it('normalizes local 020 prefix to 85620...', () => {
    expect(normalizePhoneByCountry('02012345678', 'LA')).toBe('8562012345678');
  });
  it('strips spaces and dashes', () => {
    expect(normalizePhoneByCountry('856 20 123-456-78', 'LA')).toBe('8562012345678');
  });
  it('returns null for too short', () => {
    expect(normalizePhoneByCountry('0201234', 'LA')).toBe(null);
  });
});

describe('normalizePhoneByCountry (Thailand)', () => {
  it('normalizes 0 prefix to 66...', () => {
    const r = normalizePhoneByCountry('0812345678', 'TH');
    expect(r).toBe('66812345678');
  });
  it('keeps 66 prefix when present', () => {
    const r = normalizePhoneByCountry('66812345678', 'TH');
    expect(r).toBe('66812345678');
  });
});

describe('normalizePhoneByCountry (generic/unknown)', () => {
  it('returns digits only when country unknown', () => {
    expect(normalizePhoneByCountry('+8562012345678', null)).toBe('8562012345678');
  });
});
