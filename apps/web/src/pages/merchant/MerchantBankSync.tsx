import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { merchantApi, bankSyncSetupApi, paymentAccountsApi } from '../../lib/api';
import type {
  BankSyncSetupSummary,
  BankSyncHealthStatus,
  BankTransactionRow,
  MatchingResultRow,
  PaymentAccountRow,
  BankScopingMode,
  ScopingStatus,
} from '../../lib/api';
import type { BankSyncTestResult } from '../../lib/api';
import {
  PageShell,
  Section,
  EmptyState,
  CopyField,
  StatusBadge,
  WizardStepCard,
  SetupProgressBar,
  StatusChip,
  TestResultPanel,
  IntegrationOverviewCard,
  InlineInstructionList,
  ActionFooter,
} from '../../components/ui';
import { theme } from '../../theme';

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

const INSTRUCTION_STEPS = [
  'Open your Android notification listener app.',
  'Paste the webhook URL.',
  'Paste the verification token.',
  'Save the connection.',
  'Return here and run test connection.',
];

export default function MerchantBankSync() {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;

  const [summary, setSummary] = useState<BankSyncSetupSummary | null>(null);
  const [bankTransactions, setBankTransactions] = useState<BankTransactionRow[]>([]);
  const [matchingResults, setMatchingResults] = useState<MatchingResultRow[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<BankSyncTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [samplePayloadText, setSamplePayloadText] = useState('');
  const [parseTestResult, setParseTestResult] = useState<BankSyncTestResult | null>(null);
  const [parseTesting, setParseTesting] = useState(false);

  const load = () => {
    if (!token) return;
    setError(null);
    Promise.all([
      bankSyncSetupApi.getSetup(token),
      merchantApi.bankSync(token, 50),
      paymentAccountsApi.list(token, { activeOnly: true }),
    ])
      .then(([s, sync, accounts]) => {
        setSummary(s);
        setBankTransactions(sync.bankTransactions ?? []);
        setMatchingResults(sync.matchingResults ?? []);
        setPaymentAccounts(accounts.paymentAccounts ?? []);
        if (s.step1_complete && s.step2_ready) setCurrentStep(3);
        else if (s.step1_complete) setCurrentStep(2);
        else setCurrentStep(1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const healthStatus: BankSyncHealthStatus = summary?.health_status ?? 'needs_setup';

  const handleSave = async (payload: Parameters<typeof bankSyncSetupApi.updateSetup>[1]) => {
    if (!token) return;
    setSaveError(null);
    try {
      await bankSyncSetupApi.updateSetup(token, payload);
      const s = await bankSyncSetupApi.getSetup(token);
      setSummary(s);
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
      setSummary(s);
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
    if (!token) return;
    setShowRegenerateModal(false);
    setRegenerating(true);
    try {
      const res = await bankSyncSetupApi.regenerateToken(token);
      const s = await bankSyncSetupApi.getSetup(token);
      setSummary({ ...s, webhook_verify_token: res.webhook_verify_token });
    } finally {
      setRegenerating(false);
    }
  };

  if (error) {
    return (
      <PageShell title="Bank Sync" description="Connect your bank notification source to detect incoming payments automatically">
        <p style={{ color: theme.danger }}>{error}</p>
      </PageShell>
    );
  }
  if (loading) {
    return (
      <PageShell title="Bank Sync" description="Connect your bank notification source to detect incoming payments automatically">
        <p style={{ color: theme.textSecondary }}>Loading…</p>
      </PageShell>
    );
  }

  const webhookUrl = summary?.webhook_url ?? '';
  const step1Complete = summary?.step1_complete ?? false;
  const step2Ready = summary?.step2_ready ?? false;

  return (
    <PageShell
      title="Bank Sync"
      description="Connect your bank notification source to detect incoming payments automatically"
      actions={<StatusChip status={healthStatus} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Overview card */}
        <IntegrationOverviewCard summary={summary} healthStatus={healthStatus} />

        {/* Wizard progress */}
        <div>
          <div style={{ marginBottom: 12, fontSize: 12, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Setup wizard
          </div>
          <SetupProgressBar
            currentStep={currentStep}
            totalSteps={3}
            stepLabels={['Select bank & account', 'Copy connection details', 'Test & confirm']}
          />
        </div>

        {/* Step 1 — Select Bank and Payment Account */}
        <WizardStepCard
          stepNumber={1}
          title="Select bank and payment account"
          subtitle="Choose your bank and link the payment account that receives transfers"
          isActive={currentStep === 1}
          isComplete={step1Complete}
          isDisabled={currentStep > 1 && !step1Complete}
          action={currentStep > 1 && step1Complete && (
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: `1px solid ${theme.borderMuted}`,
                borderRadius: 4,
                color: theme.textSecondary,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
        >
          {currentStep === 1 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: theme.textSecondary }}>
                    Bank <span style={{ color: theme.danger }}>*</span>
                  </label>
                  <select
                    value={summary?.bank_code ?? 'GENERIC'}
                    onChange={(e) => handleSave({ bank_code: e.target.value })}
                    style={{
                      width: '100%',
                      maxWidth: 360,
                      padding: '10px 12px',
                      background: theme.surfaceElevated,
                      border: `1px solid ${theme.borderMuted}`,
                      borderRadius: 6,
                      color: theme.text,
                      fontSize: 13,
                    }}
                  >
                    {(summary?.bank_options ?? []).map((opt) => (
                      <option key={opt.code} value={opt.code}>{opt.label}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Select the bank that sends you notifications.</p>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: theme.textSecondary }}>
                    Linked payment account
                  </label>
                  <select
                    value={summary?.payment_account_id ?? ''}
                    onChange={(e) => handleSave({ payment_account_id: e.target.value || null })}
                    style={{
                      width: '100%',
                      maxWidth: 360,
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
                  <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Strongly recommended for correct matching.</p>
                  {paymentAccounts.length === 0 && (
                    <p style={{ fontSize: 12, color: theme.warning, marginTop: 8 }}>
                      No payment accounts yet.{' '}
                      <Link to="/merchant/payment-accounts" style={{ color: theme.primary }}>Add one</Link> to link here.
                    </p>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: theme.textSecondary }}>
                    Connection label (optional)
                  </label>
                  <input
                    type="text"
                    value={summary?.device_label ?? ''}
                    onChange={(e) => setSummary((s) => (s ? { ...s, device_label: e.target.value } : null))}
                    onBlur={() => handleSave({ device_label: summary?.device_label?.trim() || null })}
                    placeholder="e.g. Main phone"
                    style={{
                      width: '100%',
                      maxWidth: 360,
                      padding: '10px 12px',
                      background: theme.surfaceElevated,
                      border: `1px solid ${theme.borderMuted}`,
                      borderRadius: 6,
                      color: theme.text,
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: theme.textSecondary }}>
                    Match mode
                  </label>
                  <select
                    value={summary?.match_mode ?? 'strict'}
                    onChange={(e) => handleSave({ match_mode: e.target.value as BankScopingMode })}
                    style={{
                      width: '100%',
                      maxWidth: 360,
                      padding: '10px 12px',
                      background: theme.surfaceElevated,
                      border: `1px solid ${theme.borderMuted}`,
                      borderRadius: 6,
                      color: theme.text,
                      fontSize: 13,
                    }}
                  >
                    <option value="strict">Strict — require account/suffix match</option>
                    <option value="relaxed">Relaxed — allow device + name hints</option>
                  </select>
                  <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Strict is recommended for multiple accounts in one app (e.g. BCEL One).</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    id="bank-sync-active"
                    checked={summary?.is_active ?? false}
                    onChange={(e) => handleSave({ is_active: e.target.checked })}
                  />
                  <label htmlFor="bank-sync-active" style={{ fontSize: 13, color: theme.text }}>Active (accept incoming notifications)</label>
                </div>
                {saveError && <p style={{ color: theme.danger, fontSize: 13 }}>{saveError}</p>}
              </div>
              <ActionFooter
                primary={
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    disabled={!step1Complete}
                    style={{
                      padding: '10px 24px',
                      background: step1Complete ? theme.primary : theme.surfaceElevated,
                      color: step1Complete ? theme.background : theme.textMuted,
                      border: 0,
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: step1Complete ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Next: Copy connection details
                  </button>
                }
              />
            </>
          )}
        </WizardStepCard>

        {/* Step 2 — Copy Connection Details */}
        <WizardStepCard
          stepNumber={2}
          title="Copy connection details"
          subtitle="Use these in your Android notification listener app"
          isActive={currentStep === 2}
          isComplete={step2Ready}
          isDisabled={currentStep < 2 && !step1Complete}
          action={
            (currentStep === 2 || currentStep === 3) && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep === 2 ? 1 : 2)}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  border: `1px solid ${theme.borderMuted}`,
                  borderRadius: 4,
                  color: theme.textSecondary,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {currentStep === 2 ? 'Edit Step 1' : 'Edit Step 2'}
              </button>
            )
          }
        >
          {currentStep === 2 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <CopyField label="Webhook URL" value={webhookUrl} />
                <div>
                  <CopyField label="Verification token" value={summary?.webhook_verify_token ?? ''} masked={!!summary?.webhook_verify_token} />
                  <button
                    type="button"
                    onClick={() => setShowRegenerateModal(true)}
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
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, marginBottom: 8 }}>Instructions</div>
                  <InlineInstructionList steps={INSTRUCTION_STEPS} />
                </div>
              </div>
              <ActionFooter
                secondary={
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    style={{
                      padding: '8px 16px',
                      background: 'transparent',
                      border: `1px solid ${theme.borderMuted}`,
                      borderRadius: 6,
                      color: theme.textSecondary,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                }
                primary={
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    disabled={!summary?.token_set}
                    style={{
                      padding: '10px 24px',
                      background: summary?.token_set ? theme.primary : theme.surfaceElevated,
                      color: summary?.token_set ? theme.background : theme.textMuted,
                      border: 0,
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: summary?.token_set ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Next: Test connection
                  </button>
                }
              />
            </>
          )}
        </WizardStepCard>

        {/* Step 3 — Run Test and Confirm Status */}
        <WizardStepCard
          stepNumber={3}
          title="Run test and confirm status"
          subtitle="Validate configuration without sending a real bank notification"
          isActive={currentStep === 3}
          isComplete={!!(summary?.last_tested_at && testResult?.success)}
          isDisabled={currentStep < 3}
          action={
            currentStep === 3 && (
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  border: `1px solid ${theme.borderMuted}`,
                  borderRadius: 4,
                  color: theme.textSecondary,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Edit Step 2
              </button>
            )
          }
        >
          {currentStep === 3 && (
            <>
              <div style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  style={{
                    padding: '10px 24px',
                    background: theme.primary,
                    color: theme.background,
                    border: 0,
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: testing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {testing ? 'Testing…' : 'Test connection'}
                </button>
              </div>
              <TestResultPanel result={testResult} lastTestedAt={summary?.last_tested_at ?? null} />
              <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 12 }}>
                This uses a sample payload only. It does not send a real bank notification.
              </p>
              <ActionFooter
                primary={null}
                secondary={
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    style={{
                      padding: '8px 16px',
                      background: 'transparent',
                      border: `1px solid ${theme.borderMuted}`,
                      borderRadius: 6,
                      color: theme.textSecondary,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                }
              />
            </>
          )}
        </WizardStepCard>

        {/* Test parser & scoping — paste sample notification payload */}
        <Section
          title="Test parser & scoping"
          description="Paste a sample notification payload (JSON) to see extracted fields and scoping result. Test only — no real event is sent."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              placeholder='{"amount": 100, "sender_name": "John", "datetime": "2025-03-12T10:00:00Z", "reference_code": "REF-1"}'
              value={samplePayloadText}
              onChange={(e) => setSamplePayloadText(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                maxWidth: 560,
                padding: 10,
                background: theme.surfaceElevated,
                border: `1px solid ${theme.borderMuted}`,
                borderRadius: 6,
                color: theme.text,
                fontSize: 12,
                fontFamily: 'monospace',
              }}
            />
            <button
              type="button"
              disabled={parseTesting}
              onClick={async () => {
                if (!token) return;
                setParseTesting(true);
                setParseTestResult(null);
                try {
                  let body: { sample_payload?: Record<string, unknown> } = {};
                  if (samplePayloadText.trim()) {
                    try {
                      body.sample_payload = JSON.parse(samplePayloadText.trim()) as Record<string, unknown>;
                    } catch {
                      setParseTestResult({
                        success: false,
                        status: 'parse_failed',
                        message: 'Invalid JSON',
                        parser_ready: false,
                        last_tested_at: new Date().toISOString(),
                      });
                      return;
                    }
                  }
                  const res = await bankSyncSetupApi.testConnection(token, body);
                  setParseTestResult(res);
                } catch (e) {
                  setParseTestResult({
                    success: false,
                    status: 'parse_failed',
                    message: e instanceof Error ? e.message : 'Test failed',
                    parser_ready: false,
                    last_tested_at: new Date().toISOString(),
                  });
                } finally {
                  setParseTesting(false);
                }
              }}
              style={{
                padding: '10px 20px',
                background: theme.primary,
                color: theme.background,
                border: 0,
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: parseTesting ? 'not-allowed' : 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              {parseTesting ? 'Running test…' : 'Run parse & scoping test'}
            </button>
            {parseTestResult?.test_only && (
              <div
                style={{
                  padding: 14,
                  background: theme.surfaceElevated,
                  border: `1px solid ${theme.borderMuted}`,
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ marginBottom: 8, fontWeight: 600, color: theme.text }}>Test result (test only)</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span>Scope: <strong style={{ color: parseTestResult.scope_status === 'scoped' ? theme.success : parseTestResult.scope_status === 'out_of_scope' ? theme.textMuted : theme.warning }}>{parseTestResult.scope_status ?? '—'}</strong></span>
                  {parseTestResult.scope_confidence != null && <span>Confidence: {parseTestResult.scope_confidence}</span>}
                </div>
                {parseTestResult.decision_reason && (
                  <div style={{ color: theme.textSecondary, marginBottom: 8 }}>{parseTestResult.decision_reason}</div>
                )}
                {parseTestResult.extracted_fields && Object.keys(parseTestResult.extracted_fields).length > 0 && (
                  <div style={{ fontSize: 12, color: theme.textMuted }}>
                    Extracted: {JSON.stringify(parseTestResult.extracted_fields)}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* Monitoring: Recent transactions */}
        <Section title="Recent transactions" description="Incoming bank transactions from your connected device">
          {bankTransactions.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              description="After you complete the setup and connect your app, transactions will appear here."
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
                    <th style={{ padding: 12, textAlign: 'left', color: theme.textSecondary, fontWeight: 600 }}>Scope</th>
                  </tr>
                </thead>
                <tbody>
                  {bankTransactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: `1px solid ${theme.borderMuted}` }}>
                      <td style={{ padding: 12, color: theme.text }}>{tx.amount}</td>
                      <td style={{ padding: 12, color: theme.text }}>{tx.sender_name ?? '—'}</td>
                      <td style={{ padding: 12, color: theme.textSecondary }}>{formatDate(tx.transaction_at)}</td>
                      <td style={{ padding: 12, color: theme.textSecondary }}>{tx.reference_code ?? '—'}</td>
                      <td style={{ padding: 12 }}>
                        {tx.scope_status != null ? (
                          <span
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: tx.scope_status === 'scoped' ? theme.successMuted : tx.scope_status === 'out_of_scope' ? theme.dangerMuted : theme.warningMuted,
                              color: tx.scope_status === 'scoped' ? theme.success : tx.scope_status === 'out_of_scope' ? theme.danger : theme.warning,
                            }}
                          >
                            {(tx.scope_status as ScopingStatus) ?? '—'}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Monitoring: Matching results */}
        <Section title="Matching results" description="Bank transactions matched to orders">
          {matchingResults.length === 0 ? (
            <EmptyState
              title="No matching results yet"
              description="When incoming transactions are matched to orders, they will appear here."
            />
          ) : (
            <>
              <p style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>
                {matchingResults.length} result(s)
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

      {/* Regenerate token modal */}
      {showRegenerateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowRegenerateModal(false)}
        >
          <div
            style={{
              background: theme.surface,
              borderRadius: 10,
              border: `1px solid ${theme.borderMuted}`,
              padding: 24,
              maxWidth: 400,
              margin: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 16, color: theme.text }}>Regenerate verification token?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: theme.textSecondary }}>
              You must update your Android notification app with the new token. The old token will stop working.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowRegenerateModal(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: `1px solid ${theme.borderMuted}`,
                  borderRadius: 6,
                  color: theme.text,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRegenerateToken}
                disabled={regenerating}
                style={{
                  padding: '8px 16px',
                  background: theme.warning,
                  color: theme.background,
                  border: 0,
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: regenerating ? 'not-allowed' : 'pointer',
                }}
              >
                {regenerating ? 'Generating…' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
