import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { settingsApi } from '../../lib/api';
import { PageShell, PanelCard } from '../../components/ui';
import { theme } from '../../theme';

const inputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 560,
  padding: '10px 12px',
  background: theme.surfaceElevated,
  border: `1px solid ${theme.borderMuted}`,
  borderRadius: 6,
  color: theme.text,
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontWeight: 500,
  color: theme.textSecondary,
  fontSize: 13,
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: theme.textMuted,
  marginTop: 4,
  marginBottom: 12,
};

export default function MerchantSettings() {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;

  const [aiPrompt, setAiPrompt] = useState('');
  const [bankParserId, setBankParserId] = useState('');
  const [webhookToken, setWebhookToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    settingsApi
      .get(token)
      .then((s) => {
        setAiPrompt(s.ai_system_prompt ?? '');
        setBankParserId(s.bank_parser_id ?? '');
        setWebhookToken(s.webhook_verify_token ?? '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      await settingsApi.update(token, {
        ai_system_prompt: aiPrompt.trim() || null,
        bank_parser_id: bankParserId.trim() || null,
        webhook_verify_token: webhookToken.trim() || null,
      });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (loading) return <p style={{ color: theme.textSecondary }}>Loading…</p>;

  return (
    <PageShell title="Settings" description="AI, bank parser, and webhook configuration">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PanelCard
          title="AI configuration"
          subtitle="Per-merchant system prompt for the chatbot. This shapes how the AI responds to customers."
        >
          <label style={labelStyle}>AI system prompt</label>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={6}
            style={{ ...inputStyle, minHeight: 120 }}
            placeholder="e.g. You are a helpful assistant for [Store Name]. Always be polite. When asked about payment, direct customers to transfer to our bank account..."
          />
          <div style={hintStyle}>
            Leave empty to use platform default. This prompt is included in every AI context for this merchant.
          </div>
        </PanelCard>

        <PanelCard
          title="Bank / parser configuration"
          subtitle="Optional bank statement parser. Used for slip verification and matching."
        >
          <label style={labelStyle}>Bank parser ID</label>
          <input
            type="text"
            value={bankParserId}
            onChange={(e) => setBankParserId(e.target.value)}
            style={inputStyle}
            placeholder="Optional: UUID of bank parser (if provided by admin)"
          />
          <div style={hintStyle}>
            If your admin has configured a bank parser, enter its ID here. Otherwise leave blank. Do not guess.
          </div>
        </PanelCard>

        <PanelCard
          title="Facebook / webhook configuration"
          subtitle="Used for Facebook Messenger webhook verification. Must match the value you set in Meta Developer Console."
        >
          <label style={labelStyle}>Webhook verify token</label>
          <input
            type="text"
            value={webhookToken}
            onChange={(e) => setWebhookToken(e.target.value)}
            style={inputStyle}
            placeholder="Optional: token you set in Facebook webhook settings"
          />
          <div style={hintStyle}>
            When Facebook sends a GET request to verify your webhook URL, this token is checked. Keep it secret.
          </div>
        </PanelCard>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {saveError && (
            <span style={{ color: theme.danger, fontSize: 13 }}>{saveError}</span>
          )}
          {saved && (
            <span style={{ color: theme.success, fontSize: 13, fontWeight: 500 }}>Settings saved.</span>
          )}
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '10px 24px',
              background: theme.primary,
              color: theme.background,
              border: 0,
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.8 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </form>
    </PageShell>
  );
}
