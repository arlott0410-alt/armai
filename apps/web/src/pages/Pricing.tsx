import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import {
  plansApi,
  subscribeApi,
  subscriptionApi,
  type PlanPublic,
  type SubscribeType,
} from '../lib/api'
import { useNow, getTrialDaysLeft } from '../hooks/useNow'

const LAK_FORMAT = new Intl.NumberFormat('lo-LA', { maximumFractionDigits: 0 })
const STANDARD_PLAN_CODE = 'standard'
const STANDARD_PRICE_LAK = 1_999_000
const STANDARD_ANNUAL_LAK = 19_999_000

const STANDARD_FEATURES = [
  'Core AI features',
  'Unlimited users',
  'Analytics',
  'Priority support',
  'All channels (Facebook, WhatsApp, Telegram)',
  'Bank sync & payment config',
  'Knowledge base & promotions',
]

export default function Pricing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [plan, setPlan] = useState<PlanPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState<{
    planCode: string
    nextBillingAt: string | null
    billingStatus: string
    trialEndsAt: string | null
  } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<SubscribeType | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const now = useNow()

  useEffect(() => {
    plansApi
      .list()
      .then((r) => {
        const p = r.plans.find((x) => x.code === STANDARD_PLAN_CODE)
        setPlan(
          p ?? {
            code: STANDARD_PLAN_CODE,
            name: 'Standard',
            priceLak: STANDARD_PRICE_LAK,
            features: STANDARD_FEATURES,
            maxUsers: null,
          }
        )
      })
      .catch(() =>
        setPlan({
          code: STANDARD_PLAN_CODE,
          name: 'Standard',
          priceLak: STANDARD_PRICE_LAK,
          features: STANDARD_FEATURES,
          maxUsers: null,
        })
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user?.accessToken) return
    subscriptionApi
      .get(user.accessToken)
      .then((r) => {
        if (r.subscription)
          setSub({
            planCode: r.subscription.planCode,
            nextBillingAt: r.subscription.nextBillingAt,
            billingStatus: r.subscription.billingStatus,
            trialEndsAt: r.subscription.trialEndsAt ?? null,
          })
      })
      .catch(() => {})
  }, [user?.accessToken])

  const openModal = (type: SubscribeType) => {
    if (!user?.accessToken) {
      navigate('/login')
      return
    }
    setError(null)
    setPendingMessage(null)
    setModalType(type)
    setModalOpen(true)
  }

  const handleModalConfirm = async () => {
    if (!user?.accessToken || !modalType) return
    setError(null)
    setSubmitLoading(true)
    const base = window.location.origin
    try {
      const res = await subscribeApi.subscribe(user.accessToken, {
        type: modalType,
        success_url: `${base}/pricing`,
        cancel_url: `${base}/pricing`,
        customer_email: user.email ?? undefined,
      })
      if (res.trial_started) {
        setPendingMessage('Trial started. You have 7 days.')
        setSub((prev) =>
          prev
            ? {
                ...prev,
                billingStatus: 'trialing',
                trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                nextBillingAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              }
            : null
        )
        setTimeout(() => setModalOpen(false), 1500)
      } else if (res.payment_id) {
        setPendingMessage(t('pricing.pendingPayment'))
      } else {
        setError('Request failed')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setSubmitLoading(false)
    }
  }

  const isActive =
    sub?.planCode === STANDARD_PLAN_CODE &&
    (sub.billingStatus === 'active' || sub.billingStatus === 'trialing')
  const isTrialing = sub?.billingStatus === 'trialing' && sub?.trialEndsAt
  const expiryDate = sub?.nextBillingAt
    ? new Date(sub.nextBillingAt).toLocaleDateString('lo-LA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : ''
  const trialDaysLeft = getTrialDaysLeft(
    sub?.billingStatus === 'trialing' ? (sub?.trialEndsAt ?? null) : null,
    now
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--armai-bg)]">
        <p className="text-[var(--armai-text-muted)]">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--armai-bg)] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-[var(--armai-text)] mb-2">
          {t('pricing.title')}
        </h1>
        <p className="text-[var(--armai-text-secondary)] mb-6">{t('pricing.subtitleSingle')}</p>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Single plan: 3 options */}
        <div className="rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] p-6 glass-card shadow-lg mb-6">
          <h2 className="text-lg font-semibold text-[var(--armai-text)] mb-1">
            {plan?.name ?? t('plan.standard')}
          </h2>
          <p className="text-sm text-[var(--armai-text-muted)] mb-4">
            ໄດ້ຮັບທຸກຟີເຈີ — All features included.
          </p>
          <ul className="space-y-2 mb-6">
            {(plan?.features ?? STANDARD_FEATURES).slice(0, 5).map((f, i) => (
              <li
                key={i}
                className="text-sm text-[var(--armai-text-secondary)] flex items-center gap-2"
              >
                <span className="text-accent">✓</span> {f}
              </li>
            ))}
          </ul>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Trial 7 days */}
            <button
              type="button"
              disabled={!!isActive}
              onClick={() => openModal('trial')}
              className="rounded-lg border-2 border-[var(--armai-border)] bg-[var(--armai-bg)] p-4 text-left hover:border-[var(--armai-primary)] hover:bg-[var(--armai-surface-elevated)] disabled:opacity-50 transition-colors"
            >
              <div className="font-semibold text-[var(--armai-text)]">
                {t('pricing.trial7Days')}
              </div>
              <div className="text-2xl font-bold text-[var(--armai-primary)] mt-1">₭0</div>
              <div className="text-xs text-[var(--armai-text-muted)] mt-1">7 ວັນ / 7 days</div>
            </button>
            {/* Monthly */}
            <button
              type="button"
              disabled={!!submitLoading}
              onClick={() => openModal('monthly')}
              className="rounded-lg border-2 border-[var(--armai-border)] bg-[var(--armai-bg)] p-4 text-left hover:border-[var(--armai-primary)] hover:bg-[var(--armai-surface-elevated)] disabled:opacity-50 transition-colors"
            >
              <div className="font-semibold text-[var(--armai-text)]">
                {t('pricing.payMonthly')}
              </div>
              <div className="text-2xl font-bold text-[var(--armai-text)] mt-1">
                ₭{LAK_FORMAT.format(STANDARD_PRICE_LAK)}
              </div>
              <div className="text-xs text-[var(--armai-text-muted)] mt-1">
                {t('plan.perMonth')}
              </div>
            </button>
            {/* Annual */}
            <button
              type="button"
              disabled={!!submitLoading}
              onClick={() => openModal('annual')}
              className="rounded-lg border-2 border-[var(--armai-primary)] bg-[var(--armai-primary)]/10 p-4 text-left hover:bg-[var(--armai-primary)]/20 relative"
            >
              <span className="absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                {t('pricing.annualDiscount')}
              </span>
              <div className="font-semibold text-[var(--armai-text)]">{t('pricing.payAnnual')}</div>
              <div className="text-2xl font-bold text-[var(--armai-primary)] mt-1">
                ₭{LAK_FORMAT.format(STANDARD_ANNUAL_LAK)}
              </div>
              <div className="text-xs text-[var(--armai-text-muted)] mt-1">
                {t('pricing.perYear')}
              </div>
            </button>
          </div>

          {isActive && (
            <div className="mt-6 pt-4 border-t border-[var(--armai-border)]">
              <p className="text-sm text-[var(--armai-text)]">
                {t('pricing.currentPlan')}: {t('plan.standard')}
                {isTrialing
                  ? ` (${t('pricing.trialDaysLeft').replace('{days}', String(trialDaysLeft))})`
                  : ` (${t('pricing.expiresAt')} ${expiryDate})`}
              </p>
              {!isTrialing && (
                <button
                  type="button"
                  disabled={!!submitLoading}
                  onClick={() => openModal('monthly')}
                  className="mt-2 text-sm font-medium text-[var(--armai-primary)] hover:underline"
                >
                  {t('pricing.renew')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal: confirm + slip (for monthly/annual) */}
        {modalOpen && modalType && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] shadow-xl p-6">
              {modalType === 'trial' ? (
                <>
                  <h2 className="text-lg font-semibold text-[var(--armai-text)] mb-2">
                    {t('pricing.trialConfirm')}
                  </h2>
                  <p className="text-sm text-[var(--armai-text-secondary)] mb-4">
                    ທ່ານຈະໄດ້ໃຊ້ງານຄົບທຸກຟີເຈີເປັນເວລາ 7 ວັນ ບໍ່ຕ້ອງອັບໂຫຼດສລິບ.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-[var(--armai-text)] mb-2">
                    {t('pricing.bankDetails')}
                  </h2>
                  <p className="text-sm text-[var(--armai-text-secondary)] mb-2">
                    {modalType === 'annual'
                      ? '₭19,999,000 / ປີ — ໂອນເຂົ້າບັນຊີຕາມລາຍລະອຽດດ້ານລຸ່ມ.'
                      : '₭1,999,000 / ເດືອນ — ໂອນເຂົ້າບັນຊີຕາມລາຍລະອຽດດ້ານລຸ່ມ.'}{' '}
                    ຫຼັງໂອນແລ້ວ ທີມງານຈະກວດສອບ ແລະ ເປີດໃຊ້ງານໃຫ້.
                  </p>
                  <div className="rounded-lg bg-[var(--armai-bg)] p-3 text-sm text-[var(--armai-text)] font-mono mb-3">
                    BCEL — ບັນຊີ ArmAI Subscription
                    <br />
                    ຫມາຍເຫດ: ຊື່ຮ້ານ / ເບີຕິດຕໍ່
                  </div>
                  <p className="text-xs text-[var(--armai-text-muted)]">
                    {t('pricing.uploadSlip')} — ອັບໂຫຼດສລິບສາມາດເຮັດໄດ້ຫຼັງຢືນຢັນການໂອນ.
                  </p>
                </>
              )}
              {pendingMessage && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">{pendingMessage}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false)
                    setModalType(null)
                  }}
                  className="flex-1 py-2 rounded-lg border border-[var(--armai-border)] text-[var(--armai-text)] hover:bg-[var(--armai-surface-elevated)]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={submitLoading}
                  onClick={handleModalConfirm}
                  className="flex-1 py-2 rounded-lg bg-[var(--armai-primary)] text-white font-medium disabled:opacity-50"
                >
                  {submitLoading
                    ? t('common.loading')
                    : modalType === 'trial'
                      ? 'Start trial'
                      : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
