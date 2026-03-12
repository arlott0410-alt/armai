import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import {
  getParserIdForBankCode,
  getBankLabel,
  getParserLabel,
  listBankOptions,
  getBankOption,
} from '../../lib/bank-codes.js';
import { parseBankPayload } from '../../services/bank-webhook.js';
import { resolveParserProfile } from '../../services/parser-resolver.js';
import {
  runAccountScoping,
  loadPaymentAccountForScoping,
} from '../../services/account-scoping.js';
import type { NormalizedTransactionCandidate } from '@armai/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string };
}>();

/** GET /merchant/bank-sync — existing: transactions + matching results (non-breaking). */
app.get('/', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 100);
  const { data: transactions } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('transaction_at', { ascending: false })
    .limit(limit);
  const { data: matchings } = await supabase
    .from('matching_results')
    .select('*, orders(*), bank_transactions(*)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return c.json({ bankTransactions: transactions ?? [], matchingResults: matchings ?? [] });
});

/** GET /merchant/bank-sync/setup — merchant-facing bank sync setup summary. */
app.get('/setup', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');

  const [settingsRow, configRow, paymentAccounts, lastTx, countResult, scopeCounts] = await Promise.all([
    supabase.from('merchant_settings').select('bank_parser_id, webhook_verify_token').eq('merchant_id', merchantId).single(),
    supabase
      .from('bank_configs')
      .select('id, bank_code, payment_account_id, device_label, is_active, last_tested_at, parser_id, match_mode')
      .eq('merchant_id', merchantId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('merchant_payment_accounts')
      .select('id, bank_code, account_number, account_holder_name, is_primary, is_active')
      .eq('merchant_id', merchantId)
      .eq('is_active', true),
    supabase
      .from('bank_transactions')
      .select('transaction_at')
      .eq('merchant_id', merchantId)
      .order('transaction_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    supabase.from('bank_transactions').select('scope_status').eq('merchant_id', merchantId),
  ]);

  const settings = settingsRow.data;
  const config = configRow.data;
  const linkedAccountId = config?.payment_account_id ?? null;
  const accounts = paymentAccounts.data ?? [];
  const linkedAccount = linkedAccountId ? accounts.find((a) => a.id === linkedAccountId) : null;
  const lastReceivedAt = lastTx.data?.[0]?.transaction_at ?? null;
  const recentTransactionCount = countResult.count ?? 0;
  const scopeRows = scopeCounts.data ?? [];
  const scopedCount = scopeRows.filter((r: { scope_status: string | null }) => r.scope_status === 'scoped').length;
  const ambiguousCount = scopeRows.filter((r: { scope_status: string | null }) => r.scope_status === 'ambiguous').length;
  const outOfScopeCount = scopeRows.filter((r: { scope_status: string | null }) => r.scope_status === 'out_of_scope').length;

  const parserId = settings?.bank_parser_id ?? config?.parser_id ?? null;
  const bankCode = config?.bank_code ?? null;
  const bankLabel = getBankLabel(bankCode);
  const parserLabel = getParserLabel(bankCode ?? (parserId ? 'GENERIC' : null));

  const origin = getRequestOrigin(c);
  const webhookUrl = `${origin}/api/webhooks/bank/${merchantId}`;
  const isActive = config?.is_active ?? false;
  const hasToken = !!(settings?.webhook_verify_token?.trim());

  const paymentAccountSummary = linkedAccount
    ? {
        id: linkedAccount.id,
        bank_code: linkedAccount.bank_code,
        account_number_masked: maskAccountNumber(linkedAccount.account_number),
        account_holder_name: linkedAccount.account_holder_name,
        is_primary: linkedAccount.is_primary ?? false,
      }
    : null;

  const step1Complete = !!(bankCode && parserId);
  const step2Ready = step1Complete && hasToken;
  const step3Ready = step2Ready;
  const healthStatus = computeHealthStatus({
    bankCode,
    hasToken,
    hasPaymentAccount: !!linkedAccountId,
    isActive,
    parserId,
    lastTestedAt: config?.last_tested_at ?? null,
    lastReceivedAt,
  });

  const wizardState = healthStatus === 'healthy'
    ? 'healthy'
    : healthStatus === 'needs_setup'
      ? 'not_started'
      : step3Ready
        ? 'tested'
        : step2Ready
          ? 'configured'
          : step1Complete
            ? 'partially_configured'
            : 'not_started';

  return c.json({
    merchant_id: merchantId,
    bank_code: bankCode,
    bank_label: bankLabel,
    parser_label: parserLabel,
    payment_account_id: linkedAccountId,
    payment_account_summary: paymentAccountSummary,
    webhook_url: webhookUrl,
    webhook_verify_token: settings?.webhook_verify_token ?? null,
    is_active: isActive,
    device_label: config?.device_label ?? null,
    match_mode: config?.match_mode ?? 'strict',
    last_received_at: lastReceivedAt,
    last_tested_at: config?.last_tested_at ?? null,
    recent_transaction_count: recentTransactionCount,
    token_set: hasToken,
    bank_options: listBankOptions(),
    health_status: healthStatus,
    step1_complete: step1Complete,
    step2_ready: step2Ready,
    step3_ready: step3Ready,
    wizard_state: wizardState,
    scoping_scoped_count: scopedCount,
    scoping_ambiguous_count: ambiguousCount,
    scoping_out_of_scope_count: outOfScopeCount,
  });
});

function computeHealthStatus(p: {
  bankCode: string | null;
  hasToken: boolean;
  hasPaymentAccount: boolean;
  isActive: boolean;
  parserId: string | null;
  lastTestedAt: string | null;
  lastReceivedAt: string | null;
}): 'needs_setup' | 'partially_configured' | 'ready_for_test' | 'healthy' | 'needs_attention' {
  if (!p.bankCode && !p.parserId) return 'needs_setup';
  if (!p.hasToken) return p.parserId ? 'partially_configured' : 'needs_setup';
  if (!p.isActive && p.hasToken && p.parserId) return 'ready_for_test';
  if (!p.hasPaymentAccount && p.lastReceivedAt) return 'needs_attention';
  if (p.parserId && p.hasToken && p.isActive) return 'healthy';
  return 'partially_configured';
}

/** PATCH /merchant/bank-sync/setup — save bank sync configuration. */
app.patch('/setup', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

  const bankCode = body.bank_code as string | undefined;
  const paymentAccountId = body.payment_account_id as string | null | undefined;
  const deviceLabel = body.device_label as string | null | undefined;
  const isActive = body.is_active as boolean | undefined;
  const webhookVerifyToken = body.webhook_verify_token as string | null | undefined;
  const matchMode = body.match_mode as 'strict' | 'relaxed' | undefined;

  const parserId = bankCode !== undefined ? getParserIdForBankCode(bankCode) : undefined;

  const { data: existingConfig } = await supabase
    .from('bank_configs')
    .select('id')
    .eq('merchant_id', merchantId)
    .limit(1)
    .maybeSingle();

  const configUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (bankCode !== undefined) configUpdate.bank_code = bankCode;
  if (paymentAccountId !== undefined) configUpdate.payment_account_id = paymentAccountId || null;
  if (deviceLabel !== undefined) configUpdate.device_label = deviceLabel?.trim() || null;
  if (isActive !== undefined) configUpdate.is_active = isActive;
  if (parserId !== undefined) configUpdate.parser_id = parserId;
  if (matchMode !== undefined) configUpdate.match_mode = matchMode;

  if (existingConfig?.id) {
    const { error } = await supabase.from('bank_configs').update(configUpdate).eq('id', existingConfig.id).eq('merchant_id', merchantId);
    if (error) return c.json({ error: error.message }, 400);
  } else {
    const { error } = await supabase.from('bank_configs').insert({
      merchant_id: merchantId,
      parser_id: (configUpdate.parser_id as string) ?? getParserIdForBankCode('GENERIC'),
      display_name: (configUpdate.device_label as string) ?? 'Bank Sync',
      is_active: configUpdate.is_active ?? true,
      bank_code: (configUpdate.bank_code as string) ?? 'GENERIC',
      payment_account_id: configUpdate.payment_account_id ?? null,
      device_label: configUpdate.device_label ?? null,
      last_tested_at: null,
      match_mode: (configUpdate.match_mode as string) ?? 'strict',
    });
    if (error) return c.json({ error: error.message }, 400);
  }

  const settingsPayload: Record<string, unknown> = {
    merchant_id: merchantId,
    updated_at: new Date().toISOString(),
  };
  if (parserId !== undefined) settingsPayload.bank_parser_id = parserId;
  if (webhookVerifyToken !== undefined) settingsPayload.webhook_verify_token = webhookVerifyToken?.trim() || null;
  if (Object.keys(settingsPayload).length > 3) {
    const { error } = await supabase.from('merchant_settings').upsert(settingsPayload, { onConflict: 'merchant_id' });
    if (error) return c.json({ error: error.message }, 400);
  }

  return c.json({ ok: true });
});

/** GET /merchant/bank-sync/events — recent raw/processed bank events with scope status. */
app.get('/events', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 100);
  const { data: transactions } = await supabase
    .from('bank_transactions')
    .select('id, amount, sender_name, transaction_at, reference_code, scope_status, scope_confidence, ignored_reason, payment_account_id, created_at')
    .eq('merchant_id', merchantId)
    .order('transaction_at', { ascending: false })
    .limit(limit);
  const { data: rawEvents } = await supabase
    .from('bank_raw_notification_events')
    .select('id, processing_status, received_at, raw_message, notification_title')
    .eq('merchant_id', merchantId)
    .order('received_at', { ascending: false })
    .limit(limit);
  return c.json({
    bankTransactions: transactions ?? [],
    rawEvents: rawEvents ?? [],
  });
});

/** GET /merchant/bank-sync/processing-logs — decision log for debugging. */
app.get('/processing-logs', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 100);
  const { data: logs } = await supabase
    .from('bank_transaction_processing_logs')
    .select('id, raw_event_id, parser_profile_id, payment_account_id, bank_transaction_id, parse_status, scope_status, matching_eligibility, decision_reason, detail_json, created_at')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return c.json({ processingLogs: logs ?? [] });
});

/** POST /merchant/bank-sync/token/regenerate — generate new webhook verification token. */
app.post('/token/regenerate', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);

  const { error } = await supabase
    .from('merchant_settings')
    .upsert(
      { merchant_id: merchantId, webhook_verify_token: newToken, updated_at: new Date().toISOString() },
      { onConflict: 'merchant_id' }
    );

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ ok: true, webhook_verify_token: newToken });
});

/** POST /merchant/bank-sync/test — test connection / parser config; optional sample payload for parse + scoping test. */
app.post('/test', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const samplePayload = body.sample_payload as Record<string, unknown> | undefined;
  const useScopingTest = samplePayload != null && typeof samplePayload === 'object';

  const [settingsRow, configRow] = await Promise.all([
    supabase.from('merchant_settings').select('bank_parser_id').eq('merchant_id', merchantId).single(),
    supabase.from('bank_configs').select('id, parser_id, payment_account_id, bank_code, match_mode').eq('merchant_id', merchantId).limit(1).maybeSingle(),
  ]);

  const parserId = settingsRow.data?.bank_parser_id ?? configRow.data?.parser_id ?? getParserIdForBankCode('GENERIC');
  const bankCode = configRow.data?.bank_code ?? 'GENERIC';
  const hasPaymentAccount = !!configRow.data?.payment_account_id;
  const hasToken = await hasWebhookToken(supabase, merchantId);
  const matchMode = (configRow.data?.match_mode as 'strict' | 'relaxed') ?? 'strict';

  const messages: string[] = [];
  const result: {
    success: boolean;
    status: 'ok' | 'missing_setup' | 'missing_token' | 'missing_payment_account' | 'parse_failed' | 'unsupported_bank';
    message: string;
    parser_ready: boolean;
    config_status: 'ok' | 'missing' | 'incomplete';
    parser_status: 'ok' | 'missing' | 'unsupported';
    payment_account_status: 'ok' | 'missing' | 'optional';
    token_status: 'ok' | 'missing';
    test_parse_status: 'ok' | 'failed' | 'skipped';
    parsed_preview: { amount: number; sender_name: string | null; reference_code: string | null } | null;
    messages: string[];
    last_tested_at: string;
    test_only?: boolean;
    scope_status?: string | null;
    scope_confidence?: number | null;
    decision_reason?: string | null;
    extracted_fields?: Record<string, unknown> | null;
  } = {
    success: false,
    status: 'ok',
    message: '',
    parser_ready: false,
    config_status: 'ok',
    parser_status: 'ok',
    payment_account_status: hasPaymentAccount ? 'ok' : 'optional',
    token_status: hasToken ? 'ok' : 'missing',
    test_parse_status: 'skipped',
    parsed_preview: null,
    messages: [],
    last_tested_at: new Date().toISOString(),
  };

  if (!parserId) {
    result.status = 'missing_setup';
    result.message = 'Bank sync is not configured. Select a bank and save.';
    result.config_status = 'missing';
    result.parser_status = 'missing';
    result.messages = ['Select a bank in Step 1 and save your configuration.'];
    await updateLastTested(supabase, merchantId);
    return c.json({ ...result, messages: result.messages });
  }

  const opt = getBankOption(bankCode);
  if (opt && !opt.supported) {
    result.status = 'unsupported_bank';
    result.message = `"${opt.label}" uses generic parser. Bank-specific parsing may be added later.`;
    result.parser_ready = true;
    result.parser_status = 'unsupported';
    result.messages.push(`"${opt.label}" uses generic parser.`);
  }

  if (!hasToken && !useScopingTest) {
    result.status = 'missing_token';
    result.message = 'Webhook verification token is not set. Generate or enter a token.';
    result.token_status = 'missing';
    result.messages = ['Generate or paste a verification token in Step 2.', 'Then paste it into your Android notification app.'];
    await updateLastTested(supabase, merchantId);
    return c.json({ ...result, messages: result.messages });
  }

  if (!hasPaymentAccount) {
    result.payment_account_status = 'optional';
    result.messages.push('Link a payment account in Step 1 for better matching.');
  } else {
    result.messages.push('Payment account linked.');
  }

  const payloadToParse = useScopingTest ? samplePayload : {
    amount: 100.5,
    sender_name: 'Test Sender',
    datetime: new Date().toISOString(),
    reference_code: 'TEST-REF',
    transaction_id: 'test-' + Date.now(),
  };

  try {
    const normalized = parseBankPayload(parserId, payloadToParse);
    result.parser_ready = true;
    result.test_parse_status = 'ok';
    result.parsed_preview = {
      amount: normalized.amount,
      sender_name: normalized.sender_name,
      reference_code: normalized.reference_code,
    };
    result.extracted_fields = {
      amount: normalized.amount,
      sender_name: normalized.sender_name,
      reference_code: normalized.reference_code,
      datetime: normalized.datetime,
      bank_tx_id: normalized.bank_tx_id,
    };

    if (useScopingTest) {
      result.test_only = true;
      const resolution = await resolveParserProfile(supabase, { merchantId, bankCode });
      const candidate: NormalizedTransactionCandidate = {
        amount: normalized.amount,
        currency: null,
        sender_name: normalized.sender_name,
        reference_code: normalized.reference_code,
        transaction_time: normalized.datetime,
        receiver_account_number: (samplePayload?.receiver_account_number as string) ?? null,
        receiver_account_suffix: (samplePayload?.receiver_account_suffix as string) ?? null,
        receiver_account_name: (samplePayload?.receiver_account_name as string) ?? null,
        receiver_bank_code: (samplePayload?.receiver_bank_code as string) ?? null,
        parser_profile_id: resolution.parserProfileId,
        parse_confidence: 1,
        raw_parser_output_json: null,
        datetime: normalized.datetime,
        bank_tx_id: normalized.bank_tx_id,
        raw_parser_id: normalized.raw_parser_id,
      };
      const paymentAccountId = configRow.data?.payment_account_id ?? null;
      let paymentAccount = null;
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
      result.scope_status = scoping.scopeStatus;
      result.scope_confidence = scoping.scopeConfidence;
      result.decision_reason = scoping.decisionReason;
      result.messages.push(`Scoping: ${scoping.scopeStatus}. ${scoping.decisionReason}`);
    }

    result.success = true;
    result.status = 'ok';
    result.message = useScopingTest
      ? 'Parse and scoping test completed (test only — no real event).'
      : 'Configuration valid. Parser test passed (sample payload). Update your Android app with the webhook URL and token.';
    if (!useScopingTest) {
      result.messages.push('Parser test passed with sample payload.');
      result.messages.push('Connection is ready. Use the webhook URL and token in your Android app.');
    }
  } catch (e) {
    result.status = 'parse_failed';
    result.message = e instanceof Error ? e.message : 'Parser test failed.';
    result.test_parse_status = 'failed';
    result.messages.push(result.message);
  }

  await updateLastTested(supabase, merchantId);
  return c.json(result);
});

function getRequestOrigin(c: { req: { url: string } }): string {
  try {
    const u = new URL(c.req.url);
    return u.origin;
  } catch {
    return '';
  }
}

function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length <= 4) return '****';
  return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

async function hasWebhookToken(supabase: SupabaseClient, merchantId: string): Promise<boolean> {
  const { data } = await supabase
    .from('merchant_settings')
    .select('webhook_verify_token')
    .eq('merchant_id', merchantId)
    .single();
  const t = data?.webhook_verify_token;
  return typeof t === 'string' && t.trim().length > 0;
}

async function updateLastTested(supabase: SupabaseClient, merchantId: string): Promise<void> {
  const now = new Date().toISOString();
  const { data: config } = await supabase.from('bank_configs').select('id').eq('merchant_id', merchantId).limit(1).maybeSingle();
  if (config?.id) {
    await supabase.from('bank_configs').update({ last_tested_at: now, updated_at: now }).eq('id', config.id);
  } else {
    await supabase.from('bank_configs').insert({
      merchant_id: merchantId,
      parser_id: getParserIdForBankCode('GENERIC'),
      display_name: 'Bank Sync',
      is_active: true,
      bank_code: 'GENERIC',
      last_tested_at: now,
      match_mode: 'strict',
    });
  }
}

export default app;
