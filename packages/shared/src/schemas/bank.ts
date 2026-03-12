import { z } from 'zod';

/** Bank webhook incoming payload - structure depends on parser; validate after parser selection. */
export const bankWebhookHeadersSchema = z.object({
  'x-bank-source': z.string().min(1).max(64).optional(),
  'x-idempotency-key': z.string().uuid().optional(),
});

/** Generic normalized transaction for matching. */
export const normalizedTransactionSchema = z.object({
  amount: z.number().positive(),
  sender_name: z.string().nullable(),
  datetime: z.string(),
  reference_code: z.string().nullable(),
  bank_tx_id: z.string().nullable(),
  raw_parser_id: z.string(),
});

export type NormalizedTransaction = z.infer<typeof normalizedTransactionSchema>;

/** Normalized candidate after parsing (receiver fields for scoping). */
export const normalizedTransactionCandidateSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().nullable().optional(),
  sender_name: z.string().nullable(),
  reference_code: z.string().nullable(),
  transaction_time: z.string(),
  receiver_account_number: z.string().nullable().optional(),
  receiver_account_suffix: z.string().nullable().optional(),
  receiver_account_name: z.string().nullable().optional(),
  receiver_bank_code: z.string().nullable().optional(),
  parser_profile_id: z.string().uuid().nullable().optional(),
  parse_confidence: z.number().min(0).max(1).optional(),
  raw_parser_output_json: z.record(z.unknown()).nullable().optional(),
  datetime: z.string(),
  bank_tx_id: z.string().nullable().optional(),
  raw_parser_id: z.string(),
});
