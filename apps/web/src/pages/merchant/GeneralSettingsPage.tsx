import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../i18n/I18nProvider'
import {
  settingsApi,
  paymentMethodSettingsApi,
  subscriptionApi,
  type MerchantCodSettings,
} from '../../lib/api'
import { PageShell, PanelCard } from '../../components/ui'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { theme } from '../../theme'

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontWeight: 500,
  color: theme.textSecondary,
  fontSize: 13,
}

export default function GeneralSettingsPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const token = user?.accessToken ?? null

  const [sub, setSub] = useState<{
    planCode: string
    billingStatus: string
    nextBillingAt: string | null
    trialEndsAt: string | null
  } | null>(null)
  const [autoSendShippingConfirmation, setAutoSendShippingConfirmation] = useState(false)
  const [telegramNotifyOrderPaid, setTelegramNotifyOrderPaid] = useState(false)
  const [telegramAutoSendShipmentConfirmation, setTelegramAutoSendShipmentConfirmation] =
    useState(true)
  const [cod, setCod] = useState<MerchantCodSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [codSaving, setCodSaving] = useState(false)
  const [codSaveError, setCodSaveError] = useState<string | null>(null)
  const [codSaved, setCodSaved] = useState(false)

  useEffect(() => {
    if (!token) return
    subscriptionApi
      .get(token)
      .then((r) => {
        if (r.subscription)
          setSub({
            planCode: r.subscription.planCode,
            billingStatus: r.subscription.billingStatus,
            nextBillingAt: r.subscription.nextBillingAt,
            trialEndsAt: r.subscription.trialEndsAt ?? null,
          })
      })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token) return
    Promise.all([settingsApi.get(token), paymentMethodSettingsApi.get(token)])
      .then(([s, codSettings]) => {
        setAutoSendShippingConfirmation(s.auto_send_shipping_confirmation ?? false)
        setTelegramNotifyOrderPaid(s.telegram_notify_order_paid ?? false)
        setTelegramAutoSendShipmentConfirmation(s.telegram_auto_send_shipment_confirmation ?? true)
        setCod(codSettings)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaveError(null)
    setSaved(false)
    setSaving(true)
    try {
      await settingsApi.update(token, {
        auto_send_shipping_confirmation: autoSendShippingConfirmation,
        telegram_notify_order_paid: telegramNotifyOrderPaid,
        telegram_auto_send_shipment_confirmation: telegramAutoSendShipmentConfirmation,
      })
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCod = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !cod) return
    setCodSaveError(null)
    setCodSaved(false)
    setCodSaving(true)
    try {
      await paymentMethodSettingsApi.update(token, cod)
      setCodSaved(true)
    } catch (err) {
      setCodSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setCodSaving(false)
    }
  }

  return (
    <PageShell title={t('page.generalSettings.title')} description={t('nav.generalSettings')}>
      <div className="space-y-6">
        {/* Language & Store */}
        <PanelCard
          title={t('tabs.store')}
          subtitle={t('locale.lao') + ' / ' + t('locale.thai') + ' / ' + t('locale.english')}
          style={{
            border: '1px solid var(--armai-border)',
            boxShadow: '0 0 20px rgba(212,175,55,0.25)',
          }}
        >
          <div className="py-2">
            <label style={labelStyle}>Language / ภาษา / ພາສາ</label>
            <LanguageSwitcher inDropdown={false} />
          </div>
        </PanelCard>

        {/* Subscription */}
        <PanelCard
          title={t('tabs.subscription')}
          subtitle={t('general.subscription.description')}
          action={
            <Link
              to="/pricing"
              className="text-sm font-medium text-[var(--armai-primary)] hover:underline"
            >
              {sub?.nextBillingAt ? t('pricing.renew') : t('pricing.subscribeCta')}
            </Link>
          }
          style={{
            border: '1px solid var(--armai-border)',
            boxShadow: '0 0 20px rgba(212,175,55,0.25)',
          }}
        >
          {sub ? (
            <div className="py-2 text-sm">
              <p className="text-[var(--armai-text)]">
                {t('pricing.currentPlan')}: {t('plan.standard')}
                {sub.billingStatus === 'trialing' && sub.trialEndsAt
                  ? ` (${t('pricing.trialDaysLeft').replace('{days}', String(Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))))} ວັນ)`
                  : ''}
              </p>
              {sub.nextBillingAt && (
                <p className="text-[var(--armai-text-muted)] mt-1">
                  {sub.billingStatus === 'trialing'
                    ? t('pricing.expiresAt') + ' (trial): '
                    : t('pricing.expiresAt') + ': '}
                  {new Date(sub.nextBillingAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--armai-text-muted)] py-2">{t('common.loading')}</p>
          )}
        </PanelCard>

        {/* Notifications */}
        <PanelCard
          title={t('tabs.notifications')}
          subtitle={t('general.notifications.description')}
          style={{
            border: '1px solid var(--armai-border)',
            boxShadow: '0 0 20px rgba(212,175,55,0.25)',
          }}
        >
          {loading ? (
            <p className="text-sm text-[var(--armai-text-muted)] py-2">{t('common.loading')}</p>
          ) : (
            <form onSubmit={handleSaveNotifications} className="py-2 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSendShippingConfirmation}
                  onChange={(e) => setAutoSendShippingConfirmation(e.target.checked)}
                  className="rounded border-[var(--armai-border)]"
                />
                <span className="text-sm text-[var(--armai-text)]">
                  Auto send shipping confirmation
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramNotifyOrderPaid}
                  onChange={(e) => setTelegramNotifyOrderPaid(e.target.checked)}
                  className="rounded border-[var(--armai-border)]"
                />
                <span className="text-sm text-[var(--armai-text)]">
                  Telegram: notify when order paid
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramAutoSendShipmentConfirmation}
                  onChange={(e) => setTelegramAutoSendShipmentConfirmation(e.target.checked)}
                  className="rounded border-[var(--armai-border)]"
                />
                <span className="text-sm text-[var(--armai-text)]">
                  Telegram: auto send shipment confirmation
                </span>
              </label>
              {saveError && <p className="text-sm text-[var(--armai-danger)]">{saveError}</p>}
              {saved && <p className="text-sm text-[var(--armai-success)]">Saved.</p>}
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--armai-primary)] text-black hover:opacity-90 disabled:opacity-50 shadow-gold"
              >
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </form>
          )}
        </PanelCard>

        {/* COD (if available) */}
        {cod && (
          <PanelCard
            title="COD"
            subtitle="Cash on delivery settings"
            style={{
              border: '1px solid var(--armai-border)',
              boxShadow: '0 0 20px rgba(212,175,55,0.25)',
            }}
          >
            <form onSubmit={handleSaveCod} className="py-2 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cod.enable_cod ?? false}
                  onChange={(e) => setCod((c) => (c ? { ...c, enable_cod: e.target.checked } : c))}
                  className="rounded border-[var(--armai-border)]"
                />
                <span className="text-sm text-[var(--armai-text)]">COD enabled</span>
              </label>
              {codSaveError && <p className="text-sm text-[var(--armai-danger)]">{codSaveError}</p>}
              {codSaved && <p className="text-sm text-[var(--armai-success)]">Saved.</p>}
              <button
                type="submit"
                disabled={codSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--armai-primary)] text-black hover:opacity-90 disabled:opacity-50 shadow-gold"
              >
                {codSaving ? t('common.loading') : t('common.save')}
              </button>
            </form>
          </PanelCard>
        )}
      </div>
    </PageShell>
  )
}
