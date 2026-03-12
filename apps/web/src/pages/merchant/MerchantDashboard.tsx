import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNow, getTrialDaysLeft } from '../../hooks/useNow'
import { merchantApi, subscriptionApi, type MerchantDashboardResponse } from '../../lib/api'
import {
  PageShell,
  StatCard,
  Card,
  CardBody,
  Section,
  EmptyState,
  StatusBadge,
  PanelCard,
} from '../../components/ui'
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton'
import { theme } from '../../theme'
import { useI18n } from '../../i18n/I18nProvider'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

export default function MerchantDashboard() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [data, setData] = useState<MerchantDashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sub, setSub] = useState<{ billingStatus: string; trialEndsAt: string | null } | null>(null)
  const token = user?.accessToken ?? null
  const now = useNow(60_000)

  useEffect(() => {
    if (!token) return
    merchantApi
      .dashboard(token)
      .then(setData)
      .catch((e) => setError(e.message))
  }, [token])

  useEffect(() => {
    if (!token) return
    subscriptionApi
      .get(token)
      .then(
        (r) =>
          r.subscription &&
          setSub({
            billingStatus: r.subscription.billingStatus,
            trialEndsAt: r.subscription.trialEndsAt ?? null,
          })
      )
      .catch(() => {})
  }, [token])

  if (error) return <p style={{ color: theme.danger }}>{error}</p>
  if (!data) return <DashboardSkeleton />

  const summary = data.summary
  const readiness = data.readiness ?? []
  const readyCount = readiness.filter((r) => r.status === 'ready').length
  const totalSteps = readiness.length
  const progressPct = totalSteps > 0 ? Math.round((readyCount / totalSteps) * 100) : 0

  const revenueData = summary
    ? [
        { name: 'Mon', value: summary.paidToday ?? 0 },
        { name: 'Tue', value: Math.round((summary.paidToday ?? 0) * 0.8) },
        { name: 'Wed', value: Math.round((summary.paidToday ?? 0) * 1.2) },
        { name: 'Thu', value: Math.round((summary.paidToday ?? 0) * 0.9) },
        { name: 'Fri', value: summary.paidToday ?? 0 },
        { name: 'Today', value: summary.paidToday ?? 0 },
      ]
    : []
  const messagingData = [
    { name: 'Orders', value: summary?.ordersToday ?? 0, color: 'var(--armai-primary)' },
    { name: 'Pending', value: summary?.pendingPayment ?? 0, color: 'var(--armai-warning)' },
    { name: 'Paid', value: summary?.paidToday ?? 0, color: 'var(--armai-accent)' },
  ].filter((d) => d.value > 0)

  const isTrialing = sub?.billingStatus === 'trialing' && sub?.trialEndsAt
  const trialDaysLeft = getTrialDaysLeft(sub?.trialEndsAt ?? null, now)

  return (
    <PageShell
      title={t('merchant.overview.title')}
      description={t('merchant.overview.description')}
    >
      {isTrialing && (
        <div
          className="mb-4 rounded-lg border border-[var(--armai-primary)]/40 bg-[var(--armai-primary)]/10 px-4 py-3 text-sm text-[var(--armai-text)]"
          role="status"
        >
          <span className="font-medium">
            {t('trial.banner').replace('{days}', String(trialDaysLeft))}
          </span>
          <Link
            to="/pricing"
            className="ml-2 font-medium text-[var(--armai-primary)] hover:underline"
          >
            {t('pricing.subscribeCta')}
          </Link>
        </div>
      )}
      {summary != null && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mb-6"
        >
          <StatCard
            label={t('kpi.ordersToday')}
            value={summary.ordersToday}
            accent={summary.ordersToday > 0}
          />
          <StatCard label={t('kpi.pendingPayment')} value={summary.pendingPayment} />
          <StatCard label={t('kpi.paidToday')} value={summary.paidToday} />
          <StatCard label={t('kpi.manualReview')} value={summary.manualReviewCount} />
          <StatCard label={t('kpi.probableMatch')} value={summary.probableMatchCount} />
          <StatCard label={t('kpi.readyToShip')} value={summary.readyToShipCount ?? 0} />
          <StatCard label={t('kpi.activeProducts')} value={summary.activeProductsCount} />
          <StatCard label={t('kpi.paymentAccounts')} value={summary.activePaymentAccountsCount} />
        </motion.div>
      )}

      {summary != null && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid md:grid-cols-2 gap-6 mb-8"
        >
          <div className="rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] p-4 glass-card">
            <h3 className="text-sm font-medium text-[var(--armai-text-secondary)] mb-4">
              Revenue (sample)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenueData}>
                <XAxis dataKey="name" stroke="var(--armai-text-muted)" fontSize={12} />
                <YAxis stroke="var(--armai-text-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--armai-surface-elevated)',
                    border: '1px solid var(--armai-border)',
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--armai-primary)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--armai-primary)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] p-4 glass-card">
            <h3 className="text-sm font-medium text-[var(--armai-text-secondary)] mb-4">
              Orders / Payment
            </h3>
            {messagingData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={messagingData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {messagingData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--armai-surface-elevated)',
                      border: '1px solid var(--armai-border)',
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-[var(--armai-text-muted)] text-sm">
                No data
              </div>
            )}
          </div>
        </motion.div>
      )}

      <Section
        title={t('merchant.setupReadiness.title')}
        description={
          totalSteps > 0 ? `${readyCount} / ${totalSteps}` : t('merchant.setupReadiness.subtitle')
        }
      >
        <PanelCard
          title="Setup checklist"
          subtitle={totalSteps > 0 ? `${progressPct}% complete` : undefined}
        >
          {readiness.length === 0 ? (
            <EmptyState title={t('merchant.setupReadiness.empty')} />
          ) : (
            <>
              <div
                style={{
                  marginBottom: 16,
                  height: 6,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progressPct}%`,
                    height: '100%',
                    background: theme.primary,
                    borderRadius: 3,
                  }}
                />
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {readiness.map((r) => (
                  <li
                    key={r.key}
                    style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <StatusBadge status={r.status} />
                    <span style={{ color: theme.text }}>{r.label}</span>
                    {r.detail != null && (
                      <span style={{ color: theme.textMuted, fontSize: 12 }}>{r.detail}</span>
                    )}
                    {r.status !== 'ready' && (
                      <Link
                        to={
                          r.key === 'products'
                            ? '/merchant/products'
                            : r.key === 'categories'
                              ? '/merchant/categories'
                              : r.key === 'payment_account' || r.key === 'primary_payment'
                                ? '/merchant/payment-accounts'
                                : r.key === 'ai_prompt'
                                  ? '/merchant/settings'
                                  : r.key === 'faq_knowledge'
                                    ? '/merchant/knowledge'
                                    : r.key === 'bank_parser'
                                      ? '/merchant/settings'
                                      : '/merchant/settings'
                        }
                        style={{
                          marginLeft: 'auto',
                          fontSize: 13,
                          color: theme.primary,
                          fontWeight: 500,
                        }}
                      >
                        {t('action.setUpArrow')}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </PanelCard>
      </Section>

      {!summary && !data.settings && (
        <Card>
          <CardBody>
            <p style={{ color: theme.textMuted, margin: 0 }}>
              Merchant ID: {data.merchantId}. Complete setup above to enable full dashboard.
            </p>
          </CardBody>
        </Card>
      )}
    </PageShell>
  )
}
