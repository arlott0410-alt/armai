import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import {
  plansApi,
  subscribeApi,
  subscriptionApi,
  subscriptionPaymentsApi,
  getSlipUrl,
  fetchSubscriptionBank,
  type PlanPublic,
  type SubscribeType,
} from '../lib/api'
import { getSupabase } from '../lib/supabase'
import { useNow, getTrialDaysLeft } from '../hooks/useNow'

const LAK_FORMAT = new Intl.NumberFormat('lo-LA', { maximumFractionDigits: 0 })
const STANDARD_PLAN_CODE = 'standard'
const STANDARD_PRICE_LAK = 1_999_000
const STANDARD_ANNUAL_LAK = 19_999_000

type BankSettings = {
  bank_name: string
  account_number: string
  account_holder: string
  qr_image_url: string | null
} | null

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
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [bank, setBank] = useState<BankSettings>(null)
  const [bankLoaded, setBankLoaded] = useState(false)
  const [bankError, setBankError] = useState<string | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [slipUploaded, setSlipUploaded] = useState(false)
  const [slipUploading, setSlipUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const now = useNow()

  /** Load subscription bank: try public API first (reads from DB), then Supabase direct so merchants always see latest. */
  const loadBankDetails = useCallback(async (cacheBust = true) => {
    setBankError(null)
    try {
      const fromApi = await fetchSubscriptionBank(cacheBust)
      if (fromApi && (fromApi.bank_name || fromApi.account_number)) {
        setBank(fromApi)
        setBankLoaded(true)
        return
      }
    } catch {
      // fallback to Supabase
    }
    const supabase = getSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'subscription_bank')
          .maybeSingle()
        if (error) {
          setBankError(error.message)
          setBank(null)
        } else if (data?.value && typeof data.value === 'object' && 'bank_name' in data.value) {
          const v = data.value as Record<string, unknown>
          setBank({
            bank_name: (v.bank_name as string) ?? '',
            account_number: (v.account_number as string) ?? '',
            account_holder: (v.account_holder as string) ?? '',
            qr_image_url: (v.qr_image_url as string | null) ?? null,
          })
        } else {
          setBank(null)
        }
      } catch {
        setBank(null)
      }
    } else {
      setBank(null)
    }
    setBankLoaded(true)
  }, [])

  useEffect(() => {
    loadBankDetails(false)
  }, [loadBankDetails])

  // Revalidate bank details when user returns to tab so they see updates after super admin saves
  useEffect(() => {
    const onFocus = () => loadBankDetails(true)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadBankDetails])

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

  const openModal = async (type: SubscribeType) => {
    if (!user?.accessToken) {
      navigate('/login')
      return
    }
    setError(null)
    setPendingMessage(null)
    setSlipUploaded(false)
    loadBankDetails(true)
    setPaymentId(null)
    if (type === 'trial') {
      setModalType(type)
      setModalOpen(true)
      return
    }
    // Monthly/annual: backend no longer creates pending payment here. Show modal "Upload slip" only.
    setSubmitLoading(true)
    const base = window.location.origin
    try {
      const res = await subscribeApi.subscribe(user.accessToken, {
        type,
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
      } else if (res.show_slip_modal && (res.type === 'monthly' || res.type === 'annual')) {
        setModalType(res.type)
        setModalOpen(true)
        setPendingMessage(null)
      } else if (res.payment_id) {
        setPaymentId(res.payment_id)
        setModalType(type)
        setModalOpen(true)
        setPendingMessage(null)
      } else {
        setError('Request failed')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
      toast.error(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.accessToken) return
    if (modalType !== 'monthly' && modalType !== 'annual') return
    setSlipUploading(true)
    setError(null)
    try {
      // New flow: upload slip first, then create pending payment (no payment record until slip is uploaded).
      if (!paymentId) {
        const { slip_url } = await subscriptionPaymentsApi.uploadSlipOnly(user.accessToken, file)
        await subscriptionPaymentsApi.createPending(user.accessToken, {
          slip_url,
          type: modalType,
        })
        setSlipUploaded(true)
        setPendingMessage(t('pricing.pendingPayment'))
        toast.success(t('pricing.pendingPayment'))
      } else {
        await subscriptionPaymentsApi.uploadSlip(user.accessToken, paymentId, file)
        setSlipUploaded(true)
        setPendingMessage(t('pricing.pendingPayment'))
        toast.success(t('pricing.pendingPayment'))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setSlipUploading(false)
    }
  }

  const handleModalConfirm = async () => {
    if (!user?.accessToken || !modalType) return
    if (modalType === 'monthly' || modalType === 'annual') {
      setModalOpen(false)
      setModalType(null)
      setPaymentId(null)
      return
    }
    setError(null)
    setSubmitLoading(true)
    const base = window.location.origin
    try {
      const res = await subscribeApi.subscribe(user.accessToken, {
        type: 'trial',
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
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-[var(--armai-text-secondary)] hover:text-[var(--armai-text)] mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('pricing.backButton')}
        </button>
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
              className="relative rounded-lg border-2 border-[var(--armai-primary)] bg-[var(--armai-primary)]/10 p-4 pt-5 text-left hover:bg-[var(--armai-primary)]/20"
            >
              <span className="absolute top-0 right-0 -translate-y-1/2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-1 rounded-b-lg text-sm font-medium shadow">
                {t('pricing.specialDiscountYearly')}
              </span>
              <div className="font-semibold text-[var(--armai-text)]">{t('pricing.payAnnual')}</div>
              <div className="text-2xl font-bold text-[var(--armai-primary)] mt-1">
                ₭{LAK_FORMAT.format(STANDARD_ANNUAL_LAK)}
              </div>
              <div className="text-xs text-[var(--armai-text-muted)] mt-1">
                {t('pricing.perYear')}
              </div>
              <div className="text-xs text-[var(--armai-text-muted)] mt-0.5">
                {t('pricing.perMonthEquivalent')}
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
                    ຫຼັງໂອນແລ້ວ ອັບໂຫຼດສະລິບດ້ານລຸ່ມ (ບັງຄັບ).
                  </p>
                  {bankError && (
                    <p className="text-sm text-red-500 dark:text-red-400 mb-3" role="alert">
                      {bankError}
                    </p>
                  )}
                  {!bank ? (
                    <p className="text-sm text-[var(--armai-text-muted)] mb-3">
                      {bankLoaded
                        ? 'ບໍ່ມີຂໍ້ມູນບັນຊີ — ກະລຸນາໃຫ້ຜູ້ດູແລລະບົບຕັ້ງຄ່າໃນ ຕັ້ງຄ່າ.'
                        : t('common.loading')}
                    </p>
                  ) : (
                    <div className="rounded-lg bg-[var(--armai-bg)] p-3 text-sm text-[var(--armai-text)] space-y-1 mb-3">
                      <div>
                        <span className="text-[var(--armai-text-muted)]">
                          {t('pricing.bankName')}:{' '}
                        </span>
                        {bank.bank_name || t('common.loading')}
                      </div>
                      <div>
                        <span className="text-[var(--armai-text-muted)]">
                          {t('pricing.accountNumber')}:{' '}
                        </span>
                        {bank.account_number}
                      </div>
                      <div>
                        <span className="text-[var(--armai-text-muted)]">
                          {t('pricing.accountHolder')}:{' '}
                        </span>
                        {bank.account_holder}
                      </div>
                      <p className="text-xs text-[var(--armai-text-muted)] mt-1">
                        ຫມາຍເຫດ: ຊື່ຮ້ານ / ເບີຕິດຕໍ່
                      </p>
                      {bank.qr_image_url ? (
                        <div className="mt-2">
                          <img
                            src={getSlipUrl(bank.qr_image_url)}
                            alt="QR Code for Payment"
                            className="w-48 h-48 object-contain border border-[var(--armai-border)] rounded mx-auto mt-4"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--armai-text-muted)] mt-2">
                          {t('pricing.qrImageSoon')}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-xs font-medium text-[var(--armai-text)] mb-1">
                    {t('pricing.uploadSlipRequired')}
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleSlipUpload}
                    disabled={slipUploading || slipUploaded}
                    className="block w-full text-sm text-[var(--armai-text-secondary)] mb-2"
                  />
                  {slipUploading && (
                    <p className="text-xs text-[var(--armai-text-muted)]">{t('common.loading')}</p>
                  )}
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
                    setPaymentId(null)
                  }}
                  className="flex-1 py-2 rounded-lg border border-[var(--armai-border)] text-[var(--armai-text)] hover:bg-[var(--armai-surface-elevated)]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={
                    submitLoading ||
                    ((modalType === 'monthly' || modalType === 'annual') && !slipUploaded)
                  }
                  onClick={handleModalConfirm}
                  className="flex-1 py-2 rounded-lg bg-[var(--armai-primary)] text-white font-medium disabled:opacity-50"
                >
                  {submitLoading
                    ? t('common.loading')
                    : modalType === 'trial'
                      ? 'Start trial'
                      : modalType === 'monthly' || modalType === 'annual'
                        ? slipUploaded
                          ? 'Done'
                          : t('pricing.uploadSlipRequired')
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
