/**
 * Shared domain types. Align with DB schema and API contracts.
 */

import type { ORDER_STATUS, MATCHING_RESULT_STATUS, ROLE, PAYMENT_METHOD, PAYMENT_STATUS, ORDER_COD_STATUS, PAYMENT_SWITCH_RESULT, PAYMENT_SWITCH_REQUESTED_BY } from './constants.js';

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export type MatchingResultStatus = (typeof MATCHING_RESULT_STATUS)[keyof typeof MATCHING_RESULT_STATUS];
export type Role = (typeof ROLE)[keyof typeof ROLE];
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export type OrderCodStatus = (typeof ORDER_COD_STATUS)[keyof typeof ORDER_COD_STATUS];
export type PaymentSwitchResult = (typeof PAYMENT_SWITCH_RESULT)[keyof typeof PAYMENT_SWITCH_RESULT];
export type PaymentSwitchRequestedBy = (typeof PAYMENT_SWITCH_REQUESTED_BY)[keyof typeof PAYMENT_SWITCH_REQUESTED_BY];

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface MerchantMember {
  id: string;
  merchant_id: string;
  user_id: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Merchant {
  id: string;
  name: string;
  slug: string;
  billing_status: 'active' | 'past_due' | 'trialing' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface MerchantSettings {
  merchant_id: string;
  ai_system_prompt: string | null;
  bank_parser_id: string | null;
  webhook_verify_token: string | null;
  created_at: string;
  updated_at: string;
}

/** Normalized slip extraction from AI. Includes receiver when visible. */
export interface SlipExtraction {
  amount: number | null;
  sender_name: string | null;
  datetime: string | null;
  reference_code: string | null;
  confidence_score: number;
  raw_json: string;
  /** Account-aware: receiver account number when visible on slip. */
  receiver_account?: string | null;
  receiver_bank?: string | null;
  receiver_name?: string | null;
}

/** Normalized bank transaction from parser. */
export interface BankTransactionNormalized {
  amount: number;
  sender_name: string | null;
  datetime: string;
  reference_code: string | null;
  bank_tx_id: string | null;
  raw_parser_id: string;
}

/** Normalized transaction candidate after parsing, before scoping. Includes receiver hints for account scoping. */
export interface NormalizedTransactionCandidate {
  amount: number;
  currency: string | null;
  sender_name: string | null;
  reference_code: string | null;
  transaction_time: string;
  receiver_account_number: string | null;
  receiver_account_suffix: string | null;
  receiver_account_name: string | null;
  receiver_bank_code: string | null;
  parser_profile_id: string | null;
  parse_confidence: number;
  raw_parser_output_json: Record<string, unknown> | null;
  /** For backward compat with matching: same as transaction_time, bank_tx_id, raw_parser_id */
  datetime: string;
  bank_tx_id: string | null;
  raw_parser_id: string;
}

/** Scope outcome for a bank notification. Only 'scoped' is eligible for auto-matching. */
export type BankScopeStatus = 'scoped' | 'ambiguous' | 'out_of_scope' | 'manual_review';

/** Match mode for a bank connection: strict = require strong account evidence; relaxed = allow heuristics. */
export type BankConnectionMatchMode = 'strict' | 'relaxed';

export interface ApiErrorBody {
  error: string;
  code?: string;
  correlationId?: string;
}
