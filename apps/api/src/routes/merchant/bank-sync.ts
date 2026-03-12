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

  const [settingsRow, configRow, paymentAccounts, lastTx, countResult] = await Promise.all([
    supabase.from('merchant_settings').select('bank_parser_id, webhook_verify_token').eq('merchant_id', merchantId).single(),
    supabase
      .from('bank_configs')
      .select('id, bank_code, payment_account_id, device_label, is_active, last_tested_at, parser_id')
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
  ]);

  const settings = settingsRow.data;
  const config = configRow.data;
  const linkedAccountId = config?.payment_account_id ?? null;
  const accounts = paymentAccounts.data ?? [];
  const linkedAccount = linkedAccountId ? accounts.find((a) => a.id === linkedAccountId) : null;
  const lastReceivedAt = lastTx.data?.[0]?.transaction_at ?? null;
  const recentTransactionCount = countResult.count ?? 0;

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
    last_received_at: lastReceivedAt,
    last_tested_at: config?.last_tested_at ?? null,
    recent_transaction_count: recentTransactionCount,
    token_set: hasToken,
    bank_options: listBankOptions(),
  });
});

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

/** POST /merchant/bank-sync/test — test connection / parser config without real webhook. */
app.post('/test', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');

  const [settingsRow, configRow] = await Promise.all([
    supabase.from('merchant_settings').select('bank_parser_id').eq('merchant_id', merchantId).single(),
    supabase.from('bank_configs').select('id, parser_id, payment_account_id, bank_code').eq('merchant_id', merchantId).limit(1).maybeSingle(),
  ]);

  const parserId = settingsRow.data?.bank_parser_id ?? configRow.data?.parser_id ?? getParserIdForBankCode('GENERIC');
  const bankCode = configRow.data?.bank_code ?? 'GENERIC';
  const hasPaymentAccount = !!configRow.data?.payment_account_id;
  const hasToken = await hasWebhookToken(supabase, merchantId);

  const result: {
    success: boolean;
    status: 'ok' | 'missing_setup' | 'missing_token' | 'missing_payment_account' | 'parse_failed' | 'unsupported_bank';
    message: string;
    parser_ready: boolean;
    parsed_preview?: { amount: number; sender_name: string | null; reference_code: string | null };
    last_tested_at: string;
  } = {
    success: false,
    status: 'ok',
    message: '',
    parser_ready: false,
    last_tested_at: new Date().toISOString(),
  };

  if (!parserId) {
    result.status = 'missing_setup';
    result.message = 'Bank sync is not configured. Select a bank and save.';
    await updateLastTested(supabase, merchantId);
    return c.json(result);
  }

  const opt = getBankOption(bankCode);
  if (opt && !opt.supported) {
    result.status = 'unsupported_bank';
    result.message = `"${opt.label}" uses generic parser. Bank-specific parsing may be added later.`;
    result.parser_ready = true;
  }

  if (!hasToken) {
    result.status = 'missing_token';
    result.message = 'Webhook verification token is not set. Generate or enter a token.';
    await updateLastTested(supabase, merchantId);
    return c.json(result);
  }

  if (!hasPaymentAccount) {
    result.status = 'missing_payment_account';
    result.message = 'No payment account linked. Link a payment account for better matching.';
  }

  try {
    const samplePayload = {
      amount: 100.5,
      sender_name: 'Test Sender',
      datetime: new Date().toISOString(),
      reference_code: 'TEST-REF',
      transaction_id: 'test-' + Date.now(),
    };
    const normalized = parseBankPayload(parserId, samplePayload);
    result.parser_ready = true;
    result.parsed_preview = {
      amount: normalized.amount,
      sender_name: normalized.sender_name,
      reference_code: normalized.reference_code,
    };
    result.success = true;
    result.status = 'ok';
    result.message = 'Configuration valid. Parser test passed (sample payload). Update your Android app with the webhook URL and token.';
  } catch (e) {
    result.status = 'parse_failed';
    result.message = e instanceof Error ? e.message : 'Parser test failed.';
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
    });
  }
}

export default app;
