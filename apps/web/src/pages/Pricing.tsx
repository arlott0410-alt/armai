import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import { plansApi, subscribeApi, subscriptionApi, type PlanPublic } from '../lib/api'

const KIP_FORMAT = new Intl.NumberFormat('lo-LA', { maximumFractionDigits: 0 })

export default function Pricing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [plans, setPlans] = useState<PlanPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState<{ planCode: string; nextBillingAt: string | null } | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    plansApi
      .list()
      .then((r) => setPlans(r.plans))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user?.accessToken) return
    subscriptionApi
      .get(user.accessToken)
      .then((r) => {
        if (r.subscription)
          setSub({ planCode: r.subscription.planCode, nextBillingAt: r.subscription.nextBillingAt })
      })
      .catch(() => {})
  }, [user?.accessToken])

  const handleChoosePlan = async (planCode: 'basic' | 'pro') => {
    if (!user?.accessToken) {
      navigate('/login')
      return
    }
    setError(null)
    setCheckoutLoading(planCode)
    const base = window.location.origin
    try {
      const res = await subscribeApi.createCheckout(user.accessToken, {
        plan_code: planCode,
        success_url: `${base}/checkout/success?plan=${planCode}`,
        cancel_url: `${base}/pricing`,
        customer_email: user.email ?? undefined,
      })
      if (res.checkout_url) {
        window.location.href = res.checkout_url
        return
      }
      setError('Could not start checkout')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setCheckoutLoading(null)
    }
  }

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
        <p className="text-[var(--armai-text-secondary)] mb-8">{t('pricing.subtitle')}</p>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((plan) => {
            const isCurrent = sub?.planCode === plan.code
            return (
              <div
                key={plan.code}
                className="rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] p-6 flex flex-col"
              >
                <h2 className="text-lg font-semibold text-[var(--armai-text)] mb-1">
                  {plan.code === 'basic' ? t('plan.basic') : t('plan.pro')}
                </h2>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold text-[var(--armai-primary)]">
                    ${plan.monthlyPriceUsd}
                  </span>
                  <span className="text-[var(--armai-text-muted)]">{t('plan.perMonth')}</span>
                </div>
                <p className="text-sm text-[var(--armai-text-muted)] mb-4">
                  ≈ {KIP_FORMAT.format(plan.monthlyPriceKip)} ກີບ
                </p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <li
                      key={i}
                      className="text-sm text-[var(--armai-text-secondary)] flex items-center gap-2"
                    >
                      <span className="text-accent">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={!!checkoutLoading || isCurrent}
                  onClick={() => handleChoosePlan(plan.code)}
                  className="w-full py-2.5 px-4 rounded-lg font-medium bg-[var(--armai-primary)] text-white hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)] focus-visible:ring-offset-2"
                >
                  {checkoutLoading === plan.code
                    ? t('common.loading')
                    : isCurrent
                      ? t('pricing.currentPlan')
                      : t('pricing.choosePlan')}
                </button>
                {isCurrent && sub?.nextBillingAt && (
                  <p className="mt-2 text-xs text-[var(--armai-text-muted)]">
                    {t('pricing.expiresAt')}: {new Date(sub.nextBillingAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
