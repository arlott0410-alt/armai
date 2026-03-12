import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { useAuth } from '../../contexts/AuthContext'
import { superApi, type SuperDashboardResponse } from '../../lib/api'
import { formatLAK } from '../../lib/formatLAK'
import {
  PageShell,
  StatCard,
  Card,
  CardHeader,
  CardBody,
  Section,
  ActivityFeed,
  EmptyState,
} from '../../components/ui'
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton'
import { toast } from 'sonner'

const CHART_COLORS = ['var(--armai-primary)', 'var(--armai-accent)', 'var(--armai-warning)']

export default function SuperDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<SuperDashboardResponse | null>(null)
  const [channelMetrics, setChannelMetrics] = useState<{
    whatsappMerchantCount: number
    whatsappActiveConnections: number
    messagesByChannel: { facebook: number; whatsapp: number }
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const token = user?.accessToken ?? null

  useEffect(() => {
    if (!token) return
    superApi
      .dashboard(token)
      .then(setData)
      .catch((e) => {
        setError(e.message)
        toast.error(e.message)
      })
    superApi
      .channelMetrics(token)
      .then(setChannelMetrics)
      .catch(() => setChannelMetrics(null))
  }, [token])

  if (error) {
    return (
      <PageShell title="Overview" description="AI SaaS Command Center">
        <div
          className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </div>
      </PageShell>
    )
  }
  if (!data) return <DashboardSkeleton />

  const kpis = data.kpis
  const revenue = data.revenue
  const billingHealth = data.billingHealth
  const setupHealth = data.setupHealth ?? []
  const recentActivity = data.recentActivity ?? []

  const mrrValue = kpis?.mrrThisMonth ?? data.mrr ?? 0
  const nextBilling = revenue?.expectedNextBilling ?? 0

  const revenueLineData =
    revenue != null
      ? [
          { name: 'MRR', value: revenue.currentMonthMRR },
          { name: 'Next', value: revenue.expectedNextBilling },
        ]
      : []
  const revenueChartData =
    revenueLineData.length > 0
      ? revenueLineData
      : [
          { name: 'MRR', value: mrrValue },
          { name: 'Next', value: nextBilling || mrrValue },
        ]

  const messagingPieData =
    channelMetrics != null
      ? [
          {
            name: 'Facebook',
            value: channelMetrics.messagesByChannel.facebook,
            color: CHART_COLORS[0],
          },
          {
            name: 'WhatsApp',
            value: channelMetrics.messagesByChannel.whatsapp,
            color: CHART_COLORS[1],
          },
        ].filter((d) => d.value > 0)
      : []

  const activityItems = recentActivity.slice(0, 15).map((a) => ({
    id: a.id,
    type: a.type,
    at: a.at,
    title: a.type.replace(/_/g, ' '),
    meta: a.merchantId ? <Link to={`/super/merchants/${a.merchantId}`}>View</Link> : null,
  }))

  return (
    <PageShell title="Overview" description="AI SaaS Command Center">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 py-4">
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}>
          <StatCard label="MRR (this month)" value={formatLAK(mrrValue)} accent />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}>
          <StatCard label="Active merchants" value={data.activeMerchants} />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}>
          <StatCard label="Trialing" value={kpis?.trialingMerchants ?? 0} />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}>
          <StatCard label="Past due" value={kpis?.pastDueMerchants ?? 0} />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}>
          <StatCard label="Due in 7 days" value={kpis?.dueInNext7Days ?? 0} />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}>
          <StatCard label="New this month" value={kpis?.newMerchantsThisMonth ?? 0} />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}>
          <StatCard label="Activation ready" value={kpis?.activationReadyCount ?? 0} />
        </motion.div>
        {channelMetrics != null && (
          <>
            <motion.div
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <StatCard label="WhatsApp merchants" value={channelMetrics.whatsappMerchantCount} />
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <StatCard
                label="WhatsApp connections"
                value={channelMetrics.whatsappActiveConnections}
              />
            </motion.div>
          </>
        )}
      </div>

      {channelMetrics != null && (
        <Section title="Messaging by channel" description="Total messages in channel_messages">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <motion.div
              whileHover={{ scale: 1.01, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
              className="rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] p-4"
            >
              <Card>
                <CardBody>
                  <div className="text-xs text-[var(--armai-text-muted)] uppercase tracking-wider mb-1">
                    Facebook
                  </div>
                  <div className="text-xl font-semibold text-[var(--armai-text)]">
                    {channelMetrics.messagesByChannel.facebook}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.01, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
              className="rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] p-4"
            >
              <Card>
                <CardBody>
                  <div className="text-xs text-[var(--armai-text-muted)] uppercase tracking-wider mb-1">
                    WhatsApp
                  </div>
                  <div className="text-xl font-semibold text-[var(--armai-text)]">
                    {channelMetrics.messagesByChannel.whatsapp}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
            {messagingPieData.length > 0 && (
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="sm:col-span-2 rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] p-4"
              >
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={messagingPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {messagingPieData.map((entry, i) => (
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
              </motion.div>
            )}
          </div>
        </Section>
      )}

      {(revenue != null || mrrValue > 0 || nextBilling > 0) && (
        <Section title="Revenue" description="Current and expected billing (LAK)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 items-end">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardBody>
                    <div className="text-xs text-[var(--armai-text-muted)] uppercase tracking-wider mb-1">
                      Current month MRR
                    </div>
                    <div className="text-xl font-semibold text-[var(--armai-primary)]">
                      {formatLAK(revenue?.currentMonthMRR ?? mrrValue)}
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardBody>
                    <div className="text-xs text-[var(--armai-text-muted)] uppercase tracking-wider mb-1">
                      Expected next billing
                    </div>
                    <div className="text-xl font-semibold text-[var(--armai-text)]">
                      {formatLAK(revenue?.expectedNextBilling ?? nextBilling)}
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            </div>
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] p-4"
            >
              <div className="text-xs text-[var(--armai-text-muted)] mb-2">Revenue (LAK)</div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={revenueChartData}>
                  <XAxis dataKey="name" stroke="var(--armai-text-muted)" fontSize={12} />
                  <YAxis
                    stroke="var(--armai-text-muted)"
                    fontSize={12}
                    tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`}
                  />
                  <Tooltip
                    formatter={(value) =>
                      value != null ? [formatLAK(Number(value)), ''] : ['—', '']
                    }
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
            </motion.div>
          </div>
        </Section>
      )}

      {revenue == null && mrrValue === 0 && nextBilling === 0 && (
        <Section title="Revenue" description="Current and expected billing">
          <Card>
            <CardBody>
              <EmptyState
                title="No revenue data yet"
                description="Revenue will appear once billing is active."
              />
            </CardBody>
          </Card>
        </Section>
      )}

      {billingHealth != null &&
        (billingHealth.overdue?.length > 0 ||
          billingHealth.dueSoon?.length > 0 ||
          billingHealth.trialEndingSoon?.length > 0) && (
          <Section title="Merchant billing health">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
              {billingHealth.overdue?.length > 0 && (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <Card>
                    <CardHeader title="Overdue" />
                    <CardBody>
                      <ul className="m-0 pl-5 space-y-1">
                        {billingHealth.overdue.slice(0, 5).map((m) => (
                          <li key={m.merchantId}>
                            <Link
                              to={`/super/merchants/${m.merchantId}`}
                              className="text-[var(--armai-primary)] hover:underline"
                            >
                              {m.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardBody>
                  </Card>
                </motion.div>
              )}
              {billingHealth.dueSoon?.length > 0 && (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <Card>
                    <CardHeader title="Due soon" />
                    <CardBody>
                      <ul className="m-0 pl-5 space-y-1">
                        {billingHealth.dueSoon.slice(0, 5).map((m) => (
                          <li key={m.merchantId}>
                            <Link
                              to={`/super/merchants/${m.merchantId}`}
                              className="text-[var(--armai-primary)] hover:underline"
                            >
                              {m.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardBody>
                  </Card>
                </motion.div>
              )}
              {billingHealth.trialEndingSoon?.length > 0 && (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <Card>
                    <CardHeader title="Trial ending soon" />
                    <CardBody>
                      <ul className="m-0 pl-5 space-y-1">
                        {billingHealth.trialEndingSoon.slice(0, 5).map((m) => (
                          <li key={m.merchantId}>
                            <Link
                              to={`/super/merchants/${m.merchantId}`}
                              className="text-[var(--armai-primary)] hover:underline"
                            >
                              {m.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardBody>
                  </Card>
                </motion.div>
              )}
            </div>
          </Section>
        )}

      {setupHealth.filter((s) => s.incompleteSetup).length > 0 && (
        <Section title="Setup incomplete">
          <Card>
            <CardBody style={{ padding: 0 }}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left border-b border-[var(--armai-border-muted)]">
                    <th className="px-4 py-3 text-[var(--armai-text-muted)] font-semibold text-xs uppercase">
                      Merchant
                    </th>
                    <th className="px-4 py-3 text-[var(--armai-text-muted)] font-semibold text-xs uppercase">
                      Missing
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {setupHealth
                    .filter((s) => s.incompleteSetup)
                    .slice(0, 10)
                    .map((s) => (
                      <tr
                        key={s.merchantId}
                        className="border-b border-[var(--armai-border-muted)]"
                      >
                        <td className="px-4 py-3">
                          <Link
                            to={`/super/merchants/${s.merchantId}`}
                            className="text-[var(--armai-primary)] hover:underline"
                          >
                            {s.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-[var(--armai-text-secondary)]">
                          {[
                            s.missingProducts && 'Products',
                            s.noPaymentAccount && 'Payment account',
                            s.noAiPrompt && 'AI prompt',
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </Section>
      )}

      <Section title="Recent activity">
        <Card>
          <CardBody style={{ padding: 0 }}>
            <ActivityFeed items={activityItems} emptyMessage="No recent activity." />
          </CardBody>
        </Card>
      </Section>
    </PageShell>
  )
}
