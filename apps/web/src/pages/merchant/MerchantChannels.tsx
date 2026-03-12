import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { channelsApi, whatsappApi, type WhatsAppConnectionRow, type ChannelsSummaryResponse } from '../../lib/api';
import { PageShell, PanelCard, CopyField } from '../../components/ui';
import { theme } from '../../theme';

const inputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
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

const hintStyle: React.CSSProperties = { fontSize: 12, color: theme.textMuted, marginTop: 4, marginBottom: 12 };

export default function MerchantChannels() {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;
  const [summary, setSummary] = useState<ChannelsSummaryResponse | null>(null);
  const [whatsappList, setWhatsappList] = useState<WhatsAppConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    Promise.all([channelsApi.summary(token), whatsappApi.list(token)])
      .then(([s, wa]) => {
        setSummary(s);
        setWhatsappList(wa.connections ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleAddWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !phoneNumberId.trim()) return;
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      await whatsappApi.create(token, {
        phone_number_id: phoneNumberId.trim(),
        webhook_verify_token: webhookVerifyToken.trim() || null,
        business_account_name: businessName.trim() || null,
        is_active: true,
      });
      setSaved(true);
      setPhoneNumberId('');
      setWebhookVerifyToken('');
      setBusinessName('');
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to add connection');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!token) return;
    setTestResult(null);
    setTesting(true);
    try {
      const res = await whatsappApi.test(token);
      setTestResult(res.message ?? 'Connection verified.');
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (loading) return <p style={{ color: theme.textSecondary }}>Loading…</p>;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const whatsappWebhookUrl = `${origin}/api/webhooks/whatsapp`;

  return (
    <PageShell
      title="Messaging channels"
      description="Facebook Messenger and WhatsApp Business. Connect channels to receive and send customer messages."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PanelCard
          title="Channel status"
          subtitle="Active channels for receiving and sending messages"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, background: theme.surfaceElevated, borderRadius: 8, border: `1px solid ${theme.borderMuted}` }}>
              <div style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Facebook Messenger</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: theme.text }}>
                {summary?.facebook?.pageCount ?? 0} page{summary?.facebook?.pageCount !== 1 ? 's' : ''} connected
              </div>
              <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>
                Configure in Meta for Developers and set webhook to your ArmAI endpoint.
              </div>
            </div>
            <div style={{ padding: 16, background: theme.surfaceElevated, borderRadius: 8, border: `1px solid ${theme.borderMuted}` }}>
              <div style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>WhatsApp</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: theme.text }}>
                {whatsappList.length} connection{whatsappList.length !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>
                Add a WhatsApp Business API connection below.
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard
          title="Connect WhatsApp"
          subtitle="WhatsApp Business Platform (Cloud API). Add Phone Number ID and webhook verify token. Access token is configured server-side only."
        >
          <form onSubmit={handleAddWhatsApp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Phone Number ID</label>
              <input
                type="text"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                style={inputStyle}
                placeholder="e.g. 123456789012345"
              />
              <div style={hintStyle}>From Meta Business Suite → WhatsApp → API Setup.</div>
            </div>
            <div>
              <label style={labelStyle}>Webhook verify token (optional)</label>
              <input
                type="text"
                value={webhookVerifyToken}
                onChange={(e) => setWebhookVerifyToken(e.target.value)}
                style={inputStyle}
                placeholder="String to match in webhook verification"
              />
            </div>
            <div>
              <label style={labelStyle}>Business account name (optional)</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                style={inputStyle}
                placeholder="My Business"
              />
            </div>
            {saveError && <p style={{ color: theme.danger, fontSize: 13 }}>{saveError}</p>}
            {saved && <p style={{ color: theme.success, fontSize: 13 }}>Connection added.</p>}
            <button
              type="submit"
              disabled={saving || !phoneNumberId.trim()}
              style={{
                padding: '10px 24px',
                background: theme.primary,
                color: theme.background,
                border: 0,
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: saving ? 'not-allowed' : 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              {saving ? 'Adding…' : 'Add WhatsApp connection'}
            </button>
          </form>
        </PanelCard>

        <PanelCard title="WhatsApp webhook URL" subtitle="Set this in Meta Developer Console for your WhatsApp app.">
          <CopyField value={whatsappWebhookUrl} label="Webhook URL" />
          <div style={hintStyle}>GET for verification; POST for incoming messages. Same URL for all merchants; routing is by Phone Number ID.</div>
        </PanelCard>

        <PanelCard title="Test WhatsApp connection" subtitle="Verify that your connection is configured. Send a message from WhatsApp to your business number to start a session.">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            style={{
              padding: '10px 24px',
              background: theme.surfaceElevated,
              border: `1px solid ${theme.borderMuted}`,
              borderRadius: 6,
              color: theme.text,
              fontWeight: 600,
              fontSize: 13,
              cursor: testing ? 'not-allowed' : 'pointer',
            }}
          >
            {testing ? 'Checking…' : 'Test connection'}
          </button>
          {testResult && (
            <p style={{ marginTop: 12, fontSize: 13, color: testResult.includes('configured') || testResult.includes('verified') ? theme.success : theme.danger }}>{testResult}</p>
          )}
        </PanelCard>

        {whatsappList.length > 0 && (
          <PanelCard title="WhatsApp connections" subtitle="Phone numbers connected to this merchant">
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: theme.textSecondary }}>
              {whatsappList.map((conn) => (
                <li key={conn.id} style={{ marginBottom: 8 }}>
                  <strong style={{ color: theme.text }}>{conn.phone_number_id}</strong>
                  {conn.business_account_name && ` — ${conn.business_account_name}`}
                  {conn.is_active ? (
                    <span style={{ marginLeft: 8, color: theme.success, fontSize: 12 }}>Active</span>
                  ) : (
                    <span style={{ marginLeft: 8, color: theme.textMuted, fontSize: 12 }}>Inactive</span>
                  )}
                </li>
              ))}
            </ul>
          </PanelCard>
        )}
      </div>
    </PageShell>
  );
}
