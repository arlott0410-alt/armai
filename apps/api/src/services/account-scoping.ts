/**
 * Account scoping: determine whether a parsed bank notification belongs to the merchant payment account.
 * Only scoped transactions proceed to matching. Strict vs relaxed mode.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedTransactionCandidate } from '@armai/shared';
import type { BankScopeStatus } from '@armai/shared';

export interface PaymentAccountRow {
  id: string;
  account_number: string | null;
  account_number_normalized: string | null;
  account_suffix: string | null;
  account_holder_name: string | null;
  account_aliases_json: unknown;
  bank_code: string | null;
  is_active: boolean;
}

export interface ScopingInput {
  merchantId: string;
  candidate: NormalizedTransactionCandidate;
  /** When event came from a known connection bound to this payment account */
  linkedPaymentAccountId: string | null;
  matchMode: 'strict' | 'relaxed';
  /** Optional: payment account row when linked */
  paymentAccount: PaymentAccountRow | null;
}

export interface ScopingResult {
  scopeStatus: BankScopeStatus;
  paymentAccountId: string | null;
  scopeConfidence: number;
  ignoredReason: string | null;
  decisionReason: string;
}

function normalizeAccountNumber(s: string | null | undefined): string {
  if (s == null || s === '') return '';
  return s.replace(/\D/g, '');
}

function suffixOf(s: string, len: number): string {
  if (s.length <= len) return s;
  return s.slice(-len);
}

function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  if (a == null || a === '' || b == null || b === '') return 0;
  const na = a.toLowerCase().replace(/\s+/g, ' ').trim();
  const nb = b.toLowerCase().replace(/\s+/g, ' ').trim();
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.7;
  const ta = new Set(na.split(/\s+/).filter(Boolean));
  const tb = new Set(nb.split(/\s+/).filter(Boolean));
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) inter++;
  }
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Run account scoping. Returns scope_status, payment_account_id, confidence, reason.
 */
export function runAccountScoping(input: ScopingInput): ScopingResult {
  const { candidate, linkedPaymentAccountId, matchMode, paymentAccount } = input;
  const relaxed = matchMode === 'relaxed';

  if (!paymentAccount && !linkedPaymentAccountId) {
    return {
      scopeStatus: 'scoped',
      paymentAccountId: null,
      scopeConfidence: 0.5,
      ignoredReason: null,
      decisionReason: 'Legacy: no payment account linked; treated as eligible for matching.',
    };
  }

  if (!paymentAccount) {
    return {
      scopeStatus: 'ambiguous',
      paymentAccountId: linkedPaymentAccountId,
      scopeConfidence: relaxed ? 0.5 : 0,
      ignoredReason: relaxed ? null : 'payment_account_not_loaded',
      decisionReason: 'Connection has linked account but account details not available.',
    };
  }

  if (!paymentAccount.is_active) {
    return {
      scopeStatus: 'out_of_scope',
      paymentAccountId: null,
      scopeConfidence: 0,
      ignoredReason: 'linked_account_inactive',
      decisionReason: 'Linked payment account is inactive.',
    };
  }

  const recvAccount = candidate.receiver_account_number ?? null;
  const recvSuffix = candidate.receiver_account_suffix ?? null;
  const recvName = candidate.receiver_account_name ?? null;
  const recvBank = candidate.receiver_bank_code ?? null;

  const expectedNormalized = paymentAccount.account_number_normalized ?? normalizeAccountNumber(paymentAccount.account_number);
  const expectedSuffix = paymentAccount.account_suffix ?? (paymentAccount.account_number ? suffixOf(paymentAccount.account_number.replace(/\D/g, ''), 4) : null);
  const expectedName = paymentAccount.account_holder_name ?? null;
  const expectedBank = paymentAccount.bank_code ?? null;

  // A. Exact account number match
  if (recvAccount) {
    const recvNorm = normalizeAccountNumber(recvAccount);
    if (recvNorm && expectedNormalized && recvNorm === expectedNormalized) {
      return {
        scopeStatus: 'scoped',
        paymentAccountId: paymentAccount.id,
        scopeConfidence: 1,
        ignoredReason: null,
        decisionReason: 'Exact receiver account number match.',
      };
    }
    if (recvNorm && expectedNormalized && recvNorm !== expectedNormalized) {
      return {
        scopeStatus: 'out_of_scope',
        paymentAccountId: null,
        scopeConfidence: 0,
        ignoredReason: 'receiver_account_mismatch',
        decisionReason: 'Receiver account number does not match linked account.',
      };
    }
  }

  // B. Suffix / masked match
  if (recvSuffix || (recvAccount && expectedSuffix)) {
    const recvS = recvSuffix ?? (recvAccount ? suffixOf(normalizeAccountNumber(recvAccount), expectedSuffix?.length ?? 4) : null);
    if (recvS && expectedSuffix && recvS === expectedSuffix) {
      return {
        scopeStatus: 'scoped',
        paymentAccountId: paymentAccount.id,
        scopeConfidence: 0.9,
        ignoredReason: null,
        decisionReason: 'Receiver account suffix match.',
      };
    }
    if (recvS && expectedSuffix && recvS !== expectedSuffix) {
      return {
        scopeStatus: 'out_of_scope',
        paymentAccountId: null,
        scopeConfidence: 0,
        ignoredReason: 'receiver_suffix_mismatch',
        decisionReason: 'Receiver account suffix does not match linked account.',
      };
    }
  }

  // C. Device-bound connection: in relaxed mode we can accept with lower confidence
  if (linkedPaymentAccountId === paymentAccount.id && relaxed) {
    const nameScore = nameSimilarity(recvName, expectedName);
    const bankMatch = !recvBank || !expectedBank || recvBank === expectedBank;
    if (nameScore >= 0.5 && bankMatch) {
      return {
        scopeStatus: 'scoped',
        paymentAccountId: paymentAccount.id,
        scopeConfidence: 0.6 + nameScore * 0.2,
        ignoredReason: null,
        decisionReason: 'Relaxed: device-bound connection + account holder name hint.',
      };
    }
    if (nameScore > 0 || bankMatch) {
      return {
        scopeStatus: 'ambiguous',
        paymentAccountId: paymentAccount.id,
        scopeConfidence: 0.4,
        ignoredReason: null,
        decisionReason: 'Relaxed: weak account holder/bank hint; marked ambiguous.',
      };
    }
  }

  // D. Strict: no strong evidence
  if (!relaxed) {
    return {
      scopeStatus: 'out_of_scope',
      paymentAccountId: null,
      scopeConfidence: 0,
      ignoredReason: 'strict_no_receiver_evidence',
      decisionReason: 'Strict mode: no receiver account or suffix match; not scoped.',
    };
  }

  // E. Fallback: ambiguous
  return {
    scopeStatus: 'ambiguous',
    paymentAccountId: null,
    scopeConfidence: 0.3,
    ignoredReason: 'insufficient_evidence',
    decisionReason: 'Could not determine if notification belongs to linked account.',
  };
}

/**
 * Load payment account row for scoping (with normalized/suffix/aliases).
 */
export async function loadPaymentAccountForScoping(
  supabase: SupabaseClient,
  paymentAccountId: string,
  merchantId: string
): Promise<PaymentAccountRow | null> {
  const { data } = await supabase
    .from('merchant_payment_accounts')
    .select('id, account_number, account_number_normalized, account_suffix, account_holder_name, account_aliases_json, bank_code, is_active')
    .eq('id', paymentAccountId)
    .eq('merchant_id', merchantId)
    .single();
  return data as PaymentAccountRow | null;
}
