import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { telegramApi, type TelegramConnectionSummary, type TelegramAdminRow } from '../../lib/api';
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

export default function MerchantTelegram() {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;
  const [data, setData] = useState<{ connection: TelegramConnectionSummary | null; settings: Record<string, unknown> } | null>(null);
  const [admins, setAdmins] = useState<TelegramAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [botToken, setBotToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [newAdminUserId, setNewAdminUserId] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('operator');
  const [addingAdmin, setAddingAdmin] = useState(false);

  const load = () => {
    if (!token) return;
    Promise.all([telegramApi.get(token), telegramApi.admins(token)])
      .then(([res, adminsRes]) => {
        setData(res);
        setGroupId(res.connection?.telegram_group_id ?? '');
        setGroupTitle(res.connection?.telegram_group_title ?? '');
        setAdmins(adminsRes.admins ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      await telegramApi.update(token, {
        telegram_group_id: groupId.trim() || undefined,
        telegram_group_title: groupTitle.trim() || null,
        ...(botToken.trim() ? { bot_token_encrypted_or_bound_reference: botToken.trim() } : {}),
      });
      setSaved(true);
      setBotToken('');
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!token) return;
    setTestResult(null);
    setTesting(true);
    try {
      await telegramApi.test(token);
      setTestResult('Test message sent to your Telegram group.');
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!token || !newAdminUserId.trim()) return;
    setAddingAdmin(true);
    try {
      await telegramApi.addAdmin(token, { telegram_user_id: newAdminUserId.trim(), role: newAdminRole });
      setNewAdminUserId('');
      load();
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : 'Failed to add admin');
    } finally {
      setAddingAdmin(false);
    }
  };

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (loading) return <p style={{ color: theme.textSecondary }}>Loading…</p>;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const merchantId = (data as { merchantId?: string } | null)?.merchantId ?? data?.connection?.merchant_id ?? '';
  const webhookUrl = merchantId ? `${origin}/api/webhooks/telegram/${merchantId}` : '';

  return (
    <PageShell
      title="Telegram operations"
      description="Connect a Telegram group for order notifications, shipment slips, and AI escalations"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PanelCard
          title="Bot & group"
          subtitle="Create a bot with @BotFather, add it to your group, then set the group ID and bot token here."
        >
          <form onSubmit={handleSaveConnection} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Telegram group ID</label>
              <input
                type="text"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                style={inputStyle}
                placeholder="-1001234567890"
              />
              <div style={hintStyle}>
                Get the group ID by adding @userinfobot to the group or from the group invite link. Use the numeric ID (e.g. -100…).
              </div>
            </div>
            <div>
              <label style={labelStyle}>Group title (optional)</label>
              <input
                type="text"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                style={inputStyle}
                placeholder="Ops Team"
              />
            </div>
            <div>
              <label style={labelStyle}>Bot token</label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                style={inputStyle}
                placeholder={data?.connection?.has_bot_token ? '•••••••• (leave blank to keep current)' : '123456:ABC-DEF...'}
                autoComplete="off"
              />
              <div style={hintStyle}>From @BotFather. Stored securely; never shown again after save. Leave blank to keep existing token.</div>
            </div>
            {saveError && <p style={{ color: theme.danger, fontSize: 13 }}>{saveError}</p>}
            {saved && <p style={{ color: theme.success, fontSize: 13 }}>Saved.</p>}
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
                alignSelf: 'flex-start',
              }}
            >
              {saving ? 'Saving…' : 'Save connection'}
            </button>
          </form>
        </PanelCard>

        <PanelCard title="Webhook URL" subtitle="Set this in your bot via setWebhook so Telegram sends updates to ArmAI.">
          <CopyField value={webhookUrl} label="Webhook URL" />
          <div style={hintStyle}>POST updates to this URL. Your backend will route by merchant ID.</div>
        </PanelCard>

        <PanelCard title="Test connection" subtitle="Send a test message to your Telegram group.">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !data?.connection?.has_bot_token}
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
            {testing ? 'Sending…' : 'Send test message'}
          </button>
          {testResult && (
            <p style={{ marginTop: 12, fontSize: 13, color: testResult.includes('sent') ? theme.success : theme.danger }}>{testResult}</p>
          )}
        </PanelCard>

        <PanelCard
          title="Authorized admins"
          subtitle="Only these Telegram user IDs can trigger actions (e.g. link shipment image to order). Get user ID from @userinfobot."
        >
          <ul style={{ margin: 0, paddingLeft: 20, marginBottom: 16, fontSize: 13, color: theme.textSecondary }}>
            {admins.map((a) => (
              <li key={a.id} style={{ marginBottom: 6 }}>
                {a.telegram_user_id} {a.telegram_username ? `@${a.telegram_username}` : ''} — {a.role} {!a.is_active && '(inactive)'}
              </li>
            ))}
            {admins.length === 0 && <li>No admins yet. Add one below.</li>}
          </ul>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={newAdminUserId}
              onChange={(e) => setNewAdminUserId(e.target.value)}
              style={{ ...inputStyle, maxWidth: 200 }}
              placeholder="Telegram user ID"
            />
            <select
              value={newAdminRole}
              onChange={(e) => setNewAdminRole(e.target.value)}
              style={{ ...inputStyle, maxWidth: 120 }}
            >
              <option value="owner">owner</option>
              <option value="admin">admin</option>
              <option value="operator">operator</option>
            </select>
            <button
              type="button"
              onClick={handleAddAdmin}
              disabled={addingAdmin || !newAdminUserId.trim()}
              style={{
                padding: '8px 16px',
                background: theme.primary,
                color: theme.background,
                border: 0,
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: addingAdmin ? 'not-allowed' : 'pointer',
              }}
            >
              {addingAdmin ? 'Adding…' : 'Add admin'}
            </button>
          </div>
        </PanelCard>
      </div>
    </PageShell>
  );
}
