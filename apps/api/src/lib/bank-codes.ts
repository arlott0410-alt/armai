/**
 * Business-friendly bank codes for merchant UI. Maps to parser IDs used by webhook.
 * Only parsers that exist in the parser registry should be mapped; unsupported banks
 * fall back to generic parser with clear labeling.
 */
import { genericBankParser } from '@armai/shared';

export const GENERIC_PARSER_ID = genericBankParser.id;

export type BankCode = 'BCEL_ONE' | 'LDB' | 'JDB' | 'GENERIC';

export interface BankOption {
  code: BankCode;
  label: string;
  parserId: string;
  parserLabel: string;
  supported: boolean;
}

/** Known bank options. Only GENERIC has a real parser implemented; others map to generic and are marked unsupported for clarity. */
const BANK_OPTIONS: BankOption[] = [
  { code: 'BCEL_ONE', label: 'BCEL One', parserId: GENERIC_PARSER_ID, parserLabel: 'Generic', supported: false },
  { code: 'LDB', label: 'LDB', parserId: GENERIC_PARSER_ID, parserLabel: 'Generic', supported: false },
  { code: 'JDB', label: 'JDB', parserId: GENERIC_PARSER_ID, parserLabel: 'Generic', supported: false },
  { code: 'GENERIC', label: 'Generic / Other', parserId: GENERIC_PARSER_ID, parserLabel: 'Generic', supported: true },
];

const BY_CODE = new Map<string, BankOption>(BANK_OPTIONS.map((o) => [o.code, o]));

export function getBankOption(code: string | null | undefined): BankOption | null {
  if (!code) return null;
  return BY_CODE.get(code) ?? null;
}

export function getParserIdForBankCode(code: string | null | undefined): string {
  const opt = getBankOption(code);
  return opt?.parserId ?? GENERIC_PARSER_ID;
}

export function getBankLabel(code: string | null | undefined): string {
  const opt = getBankOption(code);
  return opt?.label ?? 'Generic / Other';
}

export function getParserLabel(code: string | null | undefined): string {
  const opt = getBankOption(code);
  return opt?.parserLabel ?? 'Generic';
}

export function isBankSupported(code: string | null | undefined): boolean {
  const opt = getBankOption(code);
  return opt?.supported ?? true;
}

export function listBankOptions(): BankOption[] {
  return [...BANK_OPTIONS];
}
