import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { merchantApi, bankSyncSetupApi, paymentAccountsApi } from '../../lib/api';
import type {
  BankSyncSetupSummary,
  BankTransactionRow,
  MatchingResultRow,
  PaymentAccountRow,
} from '../../lib/api';
import { PageShell, PanelCard, Section, EmptyState, CopyField, StatusBadge, Badge } from '../../components/ui';
import { theme } from '../../theme';
import type { BankSyncTestResult } from '../../lib/api';

type ConnectionHealth = 'healthy' | 'needs_setup' | 'needs_attention';

function getConnectionHealth(summary: BankSyncSetupSummary | null): ConnectionHealth {
  if (!summary) return 'needs_setup';
  if (!summary.bank_code && !summary.token_set) return 'needs_setup';
  if (!summary.token_set || (!summary.payment_account_id && summary.recent_transaction_count > 0))
    return 'needs_attention';
  return 'healthy';
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function MerchantBankSync() {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;

  const [setup, setSetup] = useState<BankSyncSetupSummary | null>(null);
  const [bankTransactions, setBankTransactions] = useState<BankTransactionRow[]>([]);
  const [matchingResults, setMatchingResults] = useState<MatchingResultRow[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<BankSyncTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = () => {
    if (!token) return;
    setError(null);
    Promise.all([
      bankSyncSetupApi.getSetup(token),
      merchantApi.bankSync(token, 50),
      paymentAccountsApi.list(token, { activeOnly: true }),
    ])
      .then(([s, sync, accounts]) => {
        setSetup(s);
        setBankTransactions(sync.bankTransactions ?? []);
        setMatchingResults(sync.matchingResults ?? []);
        setPaymentAccounts(accounts.paymentAccounts ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleSave = async (payload: Parameters<typeof bankSyncSetupApi.updateSetup>[1]) => {
    if (!token) return;
    setSaveError(null);
    try {
      await bankSyncSetupApi.updateSetup(token, payload);
      const s = await bankSyncSetupApi.getSetup(token);
      setSetup(s);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const handleTest = async () => {
    if (!token) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await bankSyncSetupApi.testConnection(token);
      setTestResult(result);
      const s = await bankSyncSetupApi.getSetup(token);
      setSetup(s);
    } catch (e) {
      setTestResult({
        success: false,
        status: 'parse_failed',
        message: e instanceof Error ? e.message : 'Test failed',
        parser_ready: false,
        last_tested_at: new Date().toISOString(),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!token || !window.confirm('Generate a new verification token? You must update your Android notification app with the new token. Continue?')) return;
    setRegenerating(true);
    try {
      const res = await bankSyncSetupApi.regenerateToken(token);
      const s = await bankSyncSetupApi.getSetup(token);
      setSetup({ ...s, webhook_verify_token: res.webhook_verify_token });
    } finally {
      setRegenerating(false);
    }
  };

  const health = getConnectionHealth(setup);

  if (error) {
    return (
      <PageShell title="Bank Sync" description="Configure and monitor bank notification integration">
        <p style={{ color: theme.danger }}>{error}</p>
      </PageShell>
    );
  }
  if (loading) {
    return (
      <PageShell title="Bank Sync" description="Configure and monitor bank notification integration">
        <p style={{ color: theme.textSecondary }}>Loading…</p>
      </PageShell>
    );
  }

  const webhookUrl = setup?.webhook_url ?? '';

  return (
    <PageShell
      title="Bank Sync"
      description="Configure bank notification integration and view incoming transactions"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* 1. Bank Sync Overview Card */}
        <PanelCard
          title="Connection overview"
          subtitle="Status and last activity for this bank sync connection"
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Status</span>
              <StatusBadge status={health} />
            </div>
            <div>
              <span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Connection</span>
              <StatusBadge status={setup?.is_active ? 'active' : 'inactive'} />
            </div>
            <div>
              <span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Bank</span>
              <span style={{ fontSize: 13, color: theme.text }}>{setup?.bank_label ?? 'Not selected'}</span>
            </div>
            <div>
              <span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Parser</span>
              <span style={{ fontSize: 13, color: theme.text }}>{setup?.parser_label ?? '—'}</span>
            </div>
            {setup?.payment_account_summary && (
              <div>
                <span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Payment account</span>
                <span style={{ fontSize: 13, color: theme.text }}>
                  {setup.payment_account_summary.account_number_masked}
                  {setup.payment_account_summary.is_primary && (
                    <Badge variant="gold" style={{ marginLeft: 6 }}>Primary</Badge>
                  )}
                </span>
              </div>
            )}
            <div>
              <span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Last transaction</span>
              <span style={{ fontSize: 13, color: theme.text }}>{formatDate(setup?.last_received_at ?? null)}</span>
            </div>
            <div>
              <span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Last test</span>
              <span style={{ fontSize: 13, color: theme.text }}>{formatDate(setup?.last_tested_at ?? null)}</span>
            </div>
          </div>
        </PanelCard>

        {/* 2. Integration Setup Card */}
        <PanelCard
          title="Integration setup"
          subtitle="Select bank, link payment account, and manage webhook URL and token"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: theme.textSecondary }}>Bank</label>
              <select
                value={setup?.bank_code ?? 'GENERIC'}
                onChange={(e) => handleSave({ bank_code: e.target.value })}
                style={{
                  width: '100%',
                  maxWidth: 320,
                  padding: '10px 12px',
                  background: theme.surfaceElevated,
                  border: `1px solid ${theme.borderMuted}`,
                  borderRadius: 6,
                  color: theme.text,
                  fontSize: 13,
                }}
              >
                {(setup?.bank_options ?? []).map((opt) => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: theme.textSecondary }}>Linked payment account</label>
              <select
                value={setup?.payment_account_id ?? ''}
                onChange={(e) => handleSave({ payment_account_id: e.target.value || null })}
                style={{
                  width: '100%',
                  maxWidth: 320,
                  padding: '10px 12px',
                  background: theme.surfaceElevated,
                  border: `1px solid ${theme.borderMuted}`,
                  borderRadius: 6,
                  color: theme.text,
                  fontSize: 13,
                }}
              >
                <option value="">None</option>
                {paymentAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_code} ••••{acc.account_number.slice(-4)} — {acc.account_holder_name}
                    {acc.is_primary ? ' (Primary)' : ''}
                  </option>
                ))}
              </select>
              {paymentAccounts.length === 0 && (
                <p style={{ fontSize: 12, color: theme.warning, marginTop: 6 }}>
                  No payment accounts yet. Add one in Payment Accounts to link here.
                </p>
              )}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: theme.textSecondary }}>Connection label (optional)</label>
              <input
                type="text"
                value={setup?.device_label ?? ''}
                onChange={(e) => setSetup((s) => (s ? { ...s, device_label: e.target.value } : null))}
                onBlur={() => handleSave({ device_label: setup?.device_label?.trim() || null })}
                placeholder="e.g. Main phone"
                style={{
                  width: '100%',
                  maxWidth: 320,
                  padding: '10px 12px',
                  background: theme.surfaceElevated,
                  border: `1px solid ${theme.borderMuted}`,
                  borderRadius: 6,
                  color: theme.text,
                  fontSize: 13,
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="checkbox"
                id="bank-sync-active"
                checked={setup?.is_active ?? false}
                onChange={(e) => handleSave({ is_active: e.target.checked })}
              />
              <label htmlFor="bank-sync-active" style={{ fontSize: 13, color: theme.text }}>Active (accept incoming notifications)</label>
            </div>
            <CopyField label="Webhook URL" value={webhookUrl} />
            <div>
              <CopyField label="Verification token" value={setup?.webhook_verify_token ?? ''} masked={!!setup?.webhook_verify_token} />
              <button
                type="button"
                onClick={handleRegenerateToken}
                disabled={regenerating}
                style={{
                  padding: '6px 12px',
                  background: theme.surfaceElevated,
                  border: `1px solid ${theme.borderMuted}`,
                  borderRadius: 4,
                  color: theme.warning,
                  fontSize: 12,
                  cursor: regenerating ? 'not-allowed' : 'pointer',
                }}
              >
                {regenerating ? 'Generating…' : 'Regenerate token'}
              </button>
              <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 6 }}>
                If you regenerate, update the token in your Android notification listener app.
              </p>
            </div>
            {saveError && <p style={{ color: theme.danger, fontSize: 13 }}>{saveError}</p>}
          </div>
        </PanelCard>

        {/* 3. Guided Setup Instructions */}
        <PanelCard title="Setup steps" subtitle="Follow these steps to connect your bank notifications">
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: theme.textSecondary, lineHeight: 1.8 }}>
            <li>Select your bank above.</li>
            <li>Select the payment account to link (optional but recommended).</li>
            <li>Copy the Webhook URL and Verification token above.</li>
            <li>Paste them into your Android notification listener app.</li>
            <li>Run &quot;Test connection&quot; below to confirm.</li>
            <li>Confirm status shows Healthy and you receive test data.</li>
          </ol>
        </PanelCard>

        {/* 4. Connection Test Card */}
        <PanelCard title="Test connection" subtitle="Validate configuration without sending a real bank notification">
          <div style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              style={{
                padding: '10px 20px',
                background: theme.primary,
                color: theme.background,
                border: 0,
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: testing ? 'not-allowed' : 'pointer',
              }}
            >
              {testing ? 'Testing…' : 'Run test'}
            </button>
          </div>
          {testResult && (
            <div
              style={{
                padding: 12,
                borderRadius: 6,
                background: testResult.success ? theme.successMuted : theme.dangerMuted,
                border: `1px solid ${testResult.success ? theme.success : theme.danger}`,
                color: theme.text,
                fontSize: 13,
              }}
            >
              <strong>{testResult.success ? 'Success' : 'Issue'}</strong> — {testResult.message}
              {testResult.parsed_preview && (
                <div style={{ marginTop: 8, fontSize: 12, color: theme.textSecondary }}>
                  Sample parse: amount {testResult.parsed_preview.amount}, ref {testResult.parsed_preview.reference_code ?? '—'}
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 11, color: theme.textMuted }}>Last tested: {formatDate(testResult.last_tested_at)}</div>
            </div>
          )}
        </PanelCard>

        {/* 5. Recent Transactions */}
        <Section
          title="Recent transactions"
          description="Incoming bank transactions from your connected device"
        >
          {bankTransactions.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              description="After you configure the webhook and connect your app, transactions will appear here."
            />
          ) : (
            <div style={{ overflowX: 'auto', border: `1px solid ${theme.borderMuted}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: theme.surface, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: theme.surfaceElevated, borderBottom: `1px solid ${theme.borderMuted}` }}>
                    <th style={{ padding: 12, textAlign: 'left', color: theme.textSecondary, fontWeight: 600 }}>Amount</th>
                    <th style={{ padding: 12, textAlign: 'left', color: theme.textSecondary, fontWeight: 600 }}>Sender</th>
                    <th style={{ padding: 12, textAlign: 'left', color: theme.textSecondary, fontWeight: 600 }}>Time</th>
                    <th style={{ padding: 12, textAlign: 'left', color: theme.textSecondary, fontWeight: 600 }}>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {bankTransactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: `1px solid ${theme.borderMuted}` }}>
                      <td style={{ padding: 12, color: theme.text }}>{tx.amount}</td>
                      <td style={{ padding: 12, color: theme.text }}>{tx.sender_name ?? '—'}</td>
                      <td style={{ padding: 12, color: theme.textSecondary }}>{formatDate(tx.transaction_at)}</td>
                      <td style={{ padding: 12, color: theme.textSecondary }}>{tx.reference_code ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* 6. Matching Results */}
        <Section
          title="Matching results"
          description="Bank transactions matched to orders"
        >
          {matchingResults.length === 0 ? (
            <EmptyState
              title="No matching results yet"
              description="When incoming transactions are matched to orders, they will appear here."
            />
          ) : (
            <>
              <p style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>
                {matchingResults.length} result(s). Status: unmatched, probable match, or confirmed.
              </p>
              <div style={{ overflowX: 'auto', border: `1px solid ${theme.borderMuted}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: theme.surface, fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: theme.surfaceElevated, borderBottom: `1px solid ${theme.borderMuted}` }}>
                      <th style={{ padding: 12, textAlign: 'left', color: theme.textSecondary, fontWeight: 600 }}>Status</th>
                      <th style={{ padding: 12, textAlign: 'left', color: theme.textSecondary, fontWeight: 600 }}>Score</th>
                      <th style={{ padding: 12, textAlign: 'left', color: theme.textSecondary, fontWeight: 600 }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchingResults.map((mr) => (
                      <tr key={mr.id} style={{ borderBottom: `1px solid ${theme.borderMuted}` }}>
                        <td style={{ padding: 12 }}><StatusBadge status={mr.status} /></td>
                        <td style={{ padding: 12, color: theme.text }}>{mr.score != null ? String(mr.score) : '—'}</td>
                        <td style={{ padding: 12, color: theme.textSecondary }}>{formatDate(mr.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Section>
      </div>
    </PageShell>
  );
}
