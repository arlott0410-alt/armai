/**
 * Bank notification processing pipeline: raw intake → parser resolution → parse → normalize → scoping → ingest + match only if scoped.
 * Non-breaking: when scoping is skipped (no linked account), behavior matches legacy (all go to matching).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedTransaction } from '@armai/shared';
import type { NormalizedTransactionCandidate } from '@armai/shared';
import { parseBankPayload } from './bank-webhook.js';
import { resolveParserProfile } from './parser-resolver.js';
import {
  runAccountScoping,
  loadPaymentAccountForScoping,
  type PaymentAccountRow,
} from './account-scoping.js';
import { ingestBankTransaction } from './bank-webhook.js';
import { runMatchingForBankTransaction } from './matching.js';

export interface RawEventMeta {
  source_app_package?: string | null;
  source_app_label?: string | null;
  device_id?: string | null;
  device_label?: string | null;
  notification_title?: string | null;
  notification_subtitle?: string | null;
  raw_message?: string | null;
  locale?: string | null;
}

export interface PipelineResult {
  ok: boolean;
  bankTransactionId: string | null;
  scopeStatus: string | null;
  matchingRan: boolean;
  error?: string;
}

function normalizedToCandidate(
  n: NormalizedTransaction,
  parserProfileId: string,
  parseConfidence: number
): NormalizedTransactionCandidate {
  return {
    amount: n.amount,
    currency: null,
    sender_name: n.sender_name,
    reference_code: n.reference_code,
    transaction_time: n.datetime,
    receiver_account_number: null,
    receiver_account_suffix: null,
    receiver_account_name: null,
    receiver_bank_code: null,
    parser_profile_id: parserProfileId,
    parse_confidence: parseConfidence,
    raw_parser_output_json: null,
    datetime: n.datetime,
    bank_tx_id: n.bank_tx_id,
    raw_parser_id: n.raw_parser_id,
  };
}

/**
 * Persist raw event to bank_raw_notification_events. Returns raw_event_id or null if table missing.
 */
async function persistRawEvent(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    bankConnectionId: string | null;
    rawPayload: Record<string, unknown>;
    meta: RawEventMeta;
    processingStatus: string;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('bank_raw_notification_events')
    .insert({
      merchant_id: p.merchantId,
      bank_connection_id: p.bankConnectionId,
      source_app_package: p.meta.source_app_package ?? null,
      source_app_label: p.meta.source_app_label ?? null,
      device_id: p.meta.device_id ?? null,
      device_label: p.meta.device_label ?? null,
      notification_title: p.meta.notification_title ?? null,
      notification_subtitle: p.meta.notification_subtitle ?? null,
      raw_message: p.meta.raw_message ?? null,
      raw_payload_json: p.rawPayload,
      locale: p.meta.locale ?? null,
      processing_status: p.processingStatus,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) return null;
  return data?.id ?? null;
}

/**
 * Update raw event processing status.
 */
async function updateRawEventStatus(
  supabase: SupabaseClient,
  rawEventId: string,
  status: string
): Promise<void> {
  await supabase
    .from('bank_raw_notification_events')
    .update({ processing_status: status, updated_at: new Date().toISOString() })
    .eq('id', rawEventId);
}

/**
 * Insert processing log row.
 */
async function insertProcessingLog(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    rawEventId: string | null;
    parserProfileId: string | null;
    paymentAccountId: string | null;
    bankTransactionId: string | null;
    parseStatus: string;
    scopeStatus: string;
    matchingEligibility: boolean;
    decisionReason: string;
    detailJson: Record<string, unknown> | null;
  }
): Promise<void> {
  await supabase.from('bank_transaction_processing_logs').insert({
    merchant_id: p.merchantId,
    raw_event_id: p.rawEventId,
    parser_profile_id: p.parserProfileId,
    payment_account_id: p.paymentAccountId,
    bank_transaction_id: p.bankTransactionId,
    parse_status: p.parseStatus,
    scope_status: p.scopeStatus,
    matching_eligibility: p.matchingEligibility,
    decision_reason: p.decisionReason,
    detail_json: p.detailJson,
  });
}

/**
 * Full pipeline: raw intake, parse, scope, ingest, match only if scoped.
 */
export async function processBankNotification(
  supabase: SupabaseClient,
  payload: {
    merchantId: string;
    body: Record<string, unknown>;
    rawEventMeta?: RawEventMeta;
  }
): Promise<PipelineResult> {
  const { merchantId, body, rawEventMeta = {} } = payload;

  const bankConfig = await supabase
    .from('bank_configs')
    .select('id, bank_code, payment_account_id, match_mode')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const config = bankConfig.data;
  const bankCode = config?.bank_code ?? null;
  const paymentAccountId = config?.payment_account_id ?? null;
  const matchMode = (config?.match_mode as 'strict' | 'relaxed') ?? 'strict';

  const rawEventId = await persistRawEvent(supabase, {
    merchantId,
    bankConnectionId: null,
    rawPayload: body,
    meta: rawEventMeta,
    processingStatus: 'received',
  });

  let parserProfileId: string;
  let normalized: NormalizedTransaction;
  try {
    const resolution = await resolveParserProfile(supabase, {
      merchantId,
      bankCode,
      sourceAppPackage: rawEventMeta.source_app_package,
      locale: rawEventMeta.locale,
      rawMessage: rawEventMeta.raw_message,
    });
    parserProfileId = resolution.parserProfileId;
    normalized = parseBankPayload(resolution.parserId, body);
  } catch (e) {
    if (rawEventId) await updateRawEventStatus(supabase, rawEventId, 'failed');
    return {
      ok: false,
      bankTransactionId: null,
      scopeStatus: null,
      matchingRan: false,
      error: e instanceof Error ? e.message : 'Parse failed',
    };
  }

  if (rawEventId) await updateRawEventStatus(supabase, rawEventId, 'parsed');

  const candidate = normalizedToCandidate(normalized, parserProfileId, 1);

  let paymentAccount: PaymentAccountRow | null = null;
  if (paymentAccountId) {
    paymentAccount = await loadPaymentAccountForScoping(supabase, paymentAccountId, merchantId);
  }

  const scoping = runAccountScoping({
    merchantId,
    candidate,
    linkedPaymentAccountId: paymentAccountId,
    matchMode,
    paymentAccount,
  });

  if (rawEventId) {
    const nextStatus =
      scoping.scopeStatus === 'scoped' ? 'scoped' : scoping.scopeStatus === 'out_of_scope' ? 'out_of_scope' : 'ambiguous';
    await updateRawEventStatus(supabase, rawEventId, nextStatus);
  }

  await supabase.from('webhook_events').insert({
    merchant_id: merchantId,
    kind: 'bank_incoming',
    external_id: normalized.bank_tx_id ?? undefined,
    raw_payload: body,
    processed_at: new Date().toISOString(),
  });

  const insertPayload: Record<string, unknown> = {
    merchant_id: merchantId,
    bank_config_id: config?.id ?? null,
    amount: normalized.amount,
    sender_name: normalized.sender_name,
    transaction_at: normalized.datetime,
    reference_code: normalized.reference_code,
    bank_tx_id: normalized.bank_tx_id,
    raw_parser_id: normalized.raw_parser_id,
    raw_payload: body,
    payment_account_id: scoping.paymentAccountId,
    scope_status: scoping.scopeStatus,
    scope_confidence: scoping.scopeConfidence,
    ignored_reason: scoping.ignoredReason,
    parser_profile_id: parserProfileId,
    raw_event_id: rawEventId,
  };

  const { data: txRow, error: txErr } = await supabase
    .from('bank_transactions')
    .insert(insertPayload)
    .select('id')
    .single();

  if (txErr) {
    if (rawEventId) await updateRawEventStatus(supabase, rawEventId, 'failed');
    return {
      ok: false,
      bankTransactionId: null,
      scopeStatus: scoping.scopeStatus,
      matchingRan: false,
      error: txErr.message,
    };
  }

  const bankTransactionId = txRow!.id;

  await insertProcessingLog(supabase, {
    merchantId,
    rawEventId,
    parserProfileId,
    paymentAccountId: scoping.paymentAccountId,
    bankTransactionId,
    parseStatus: 'ok',
    scopeStatus: scoping.scopeStatus,
    matchingEligibility: scoping.scopeStatus === 'scoped',
    decisionReason: scoping.decisionReason,
    detailJson: { scopeConfidence: scoping.scopeConfidence, ignoredReason: scoping.ignoredReason },
  });

  let matchingRan = false;
  if (scoping.scopeStatus === 'scoped') {
    await runMatchingForBankTransaction(supabase, {
      merchantId,
      bankTransactionId,
      amount: normalized.amount,
      senderName: normalized.sender_name,
      datetime: normalized.datetime,
      referenceCode: normalized.reference_code,
      detectedAccountNumber: candidate.receiver_account_number ?? undefined,
    });
    matchingRan = true;
  }

  return {
    ok: true,
    bankTransactionId,
    scopeStatus: scoping.scopeStatus,
    matchingRan,
  };
}
