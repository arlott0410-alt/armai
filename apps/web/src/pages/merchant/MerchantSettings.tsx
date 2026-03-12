import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { settingsApi, paymentMethodSettingsApi, type MerchantCodSettings } from '../../lib/api';
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
  const [autoSendShippingConfirmation, setAutoSendShippingConfirmation] = useState(false);
  const [telegramNotifyOrderPaid, setTelegramNotifyOrderPaid] = useState(false);
  const [telegramAllowShipmentConfirmation, setTelegramAllowShipmentConfirmation] = useState(false);
  const [telegramAllowAiEscalation, setTelegramAllowAiEscalation] = useState(false);
  const [telegramRequireAuthorizedAdmins, setTelegramRequireAuthorizedAdmins] = useState(true);
  const [telegramAutoSendShipmentConfirmation, setTelegramAutoSendShipmentConfirmation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [cod, setCod] = useState<MerchantCodSettings | null>(null);
  const [codSaving, setCodSaving] = useState(false);
  const [codSaveError, setCodSaveError] = useState<string | null>(null);
  const [codSaved, setCodSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([settingsApi.get(token), paymentMethodSettingsApi.get(token)])
      .then(([s, codSettings]) => {
        setAiPrompt(s.ai_system_prompt ?? '');
        setBankParserId(s.bank_parser_id ?? '');
        setWebhookToken(s.webhook_verify_token ?? '');
        setAutoSendShippingConfirmation(s.auto_send_shipping_confirmation ?? false);
        setTelegramNotifyOrderPaid(s.telegram_notify_order_paid ?? false);
        setTelegramAllowShipmentConfirmation(s.telegram_allow_shipment_confirmation ?? false);
        setTelegramAllowAiEscalation(s.telegram_allow_ai_escalation ?? false);
        setTelegramRequireAuthorizedAdmins(s.telegram_require_authorized_admins ?? true);
        setTelegramAutoSendShipmentConfirmation(s.telegram_auto_send_shipment_confirmation ?? true);
        setCod(codSettings);
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
        auto_send_shipping_confirmation: autoSendShippingConfirmation,
        telegram_notify_order_paid: telegramNotifyOrderPaid,
        telegram_allow_shipment_confirmation: telegramAllowShipmentConfirmation,
        telegram_allow_ai_escalation: telegramAllowAiEscalation,
        telegram_require_authorized_admins: telegramRequireAuthorizedAdmins,
        telegram_auto_send_shipment_confirmation: telegramAutoSendShipmentConfirmation,
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
          title="Telegram operations"
          subtitle="Configure Telegram group behavior. Set up the bot and group under Operations → Telegram."
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={telegramNotifyOrderPaid} onChange={(e) => setTelegramNotifyOrderPaid(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Notify Telegram when order is paid</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={telegramAllowShipmentConfirmation} onChange={(e) => setTelegramAllowShipmentConfirmation(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Allow shipment confirmation from Telegram (upload slip image)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={telegramAllowAiEscalation} onChange={(e) => setTelegramAllowAiEscalation(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Send AI escalations to Telegram</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={telegramRequireAuthorizedAdmins} onChange={(e) => setTelegramRequireAuthorizedAdmins(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Require authorized admins for Telegram actions</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={telegramAutoSendShipmentConfirmation} onChange={(e) => setTelegramAutoSendShipmentConfirmation(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Auto-send shipment confirmation to customer after image linked</span>
          </label>
          <div style={hintStyle}>
            Manage bot, group ID, and admins under <a href="/merchant/telegram" style={{ color: theme.primary }}>Telegram</a>.
          </div>
        </PanelCard>

        <PanelCard
          title="Fulfillment"
          subtitle="Automatic shipping confirmation. When enabled, the system sends a message to the customer with tracking details after you create a shipment."
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={autoSendShippingConfirmation}
              onChange={(e) => setAutoSendShippingConfirmation(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>Auto-send shipping confirmation to customer</span>
          </label>
          <div style={hintStyle}>
            If the order has a linked conversation, the customer will receive a message with courier and tracking info (or shipping note) when you save a shipment. AI only uses data you entered—no fabricated tracking.
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

        {cod != null && (
          <PanelCard
            title="Payment methods — COD"
            subtitle="Cash on Delivery. When enabled, customers can choose to pay on delivery. Product-level eligibility is set per product."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={cod.enable_cod}
                  onChange={(e) => setCod((c) => (c ? { ...c, enable_cod: e.target.checked } : c))}
                />
                <span style={{ fontSize: 13 }}>Enable COD</span>
              </label>
              <div>
                <label style={labelStyle}>Min order amount (optional)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={cod.cod_min_order_amount ?? ''}
                  onChange={(e) => setCod((c) => (c ? { ...c, cod_min_order_amount: e.target.value === '' ? null : Number(e.target.value) } : c))}
                  style={inputStyle}
                  placeholder="No minimum"
                />
              </div>
              <div>
                <label style={labelStyle}>Max order amount (optional)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={cod.cod_max_order_amount ?? ''}
                  onChange={(e) => setCod((c) => (c ? { ...c, cod_max_order_amount: e.target.value === '' ? null : Number(e.target.value) } : c))}
                  style={inputStyle}
                  placeholder="No maximum"
                />
              </div>
              <div>
                <label style={labelStyle}>COD fee amount</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={cod.cod_fee_amount}
                  onChange={(e) => setCod((c) => (c ? { ...c, cod_fee_amount: Number(e.target.value) || 0 } : c))}
                  style={inputStyle}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={cod.require_phone_for_cod}
                  onChange={(e) => setCod((c) => (c ? { ...c, require_phone_for_cod: e.target.checked } : c))}
                />
                <span style={{ fontSize: 13 }}>Require phone for COD</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={cod.require_full_address_for_cod}
                  onChange={(e) => setCod((c) => (c ? { ...c, require_full_address_for_cod: e.target.checked } : c))}
                />
                <span style={{ fontSize: 13 }}>Require full address for COD</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={cod.cod_requires_manual_confirmation}
                  onChange={(e) => setCod((c) => (c ? { ...c, cod_requires_manual_confirmation: e.target.checked } : c))}
                />
                <span style={{ fontSize: 13 }}>COD requires manual confirmation</span>
              </label>
              <div>
                <label style={labelStyle}>Notes for AI (optional)</label>
                <textarea
                  value={cod.cod_notes_for_ai ?? ''}
                  onChange={(e) => setCod((c) => (c ? { ...c, cod_notes_for_ai: e.target.value || null } : c))}
                  rows={2}
                  style={{ ...inputStyle, minHeight: 60 }}
                  placeholder="e.g. COD available in Bangkok only."
                />
              </div>
              {codSaveError && <p style={{ color: theme.danger, fontSize: 13 }}>{codSaveError}</p>}
              {codSaved && <p style={{ color: theme.success, fontSize: 13 }}>COD settings saved.</p>}
              <button
                type="button"
                disabled={codSaving}
                onClick={async () => {
                  if (!token || !cod) return;
                  setCodSaveError(null);
                  setCodSaved(false);
                  setCodSaving(true);
                  try {
                    const updated = await paymentMethodSettingsApi.update(token, cod);
                    setCod(updated);
                    setCodSaved(true);
                  } catch (err) {
                    setCodSaveError(err instanceof Error ? err.message : 'Failed to save');
                  } finally {
                    setCodSaving(false);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  background: theme.primary,
                  color: theme.background,
                  border: 0,
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: codSaving ? 'not-allowed' : 'pointer',
                  alignSelf: 'flex-start',
                }}
              >
                {codSaving ? 'Saving…' : 'Save COD settings'}
              </button>
            </div>
          </PanelCard>
        )}

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
