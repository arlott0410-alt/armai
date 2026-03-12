import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../i18n/I18nProvider'
import { superApi } from '../../lib/api'
import { toast } from 'sonner'
import { PageShell, Card, CardHeader, CardBody, EmptyState } from '../../components/ui'
import { theme } from '../../theme'

const LAK_FMT = new Intl.NumberFormat('lo-LA', { maximumFractionDigits: 0 })

export default function SuperBilling() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [events, setEvents] = useState<unknown[]>([])
  const [pendingPayments, setPendingPayments] = useState<
    {
      id: string
      merchant_id: string
      merchant_name?: string
      amount: number
      currency: string
      status: string
      created_at: string
      payment_type?: 'monthly' | 'annual' | null
    }[]
  >([])
  const [error, setError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const token = user?.accessToken ?? null

  const load = () => {
    if (!token) return
    superApi
      .billingEvents(token)
      .then((r) => setEvents(r.events ?? []))
      .catch((e) => setError(e.message))
    superApi
      .pendingSubscriptionPayments(token)
      .then((r) => setPendingPayments(r.payments ?? []))
      .catch(() => setPendingPayments([]))
  }

  useEffect(() => {
    load()
  }, [token])

  const handleApprove = async (paymentId: string) => {
    if (!token) return
    setApprovingId(paymentId)
    try {
      await superApi.approveSubscriptionPayment(token, paymentId)
      toast.success('Subscription activated (expiry extended)')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setApprovingId(null)
    }
  }

  if (error) return <p style={{ color: theme.danger }}>{error}</p>

  return (
    <PageShell
      title={t('admin.billing')}
      description="Billing events and pending subscription payments"
    >
      {/* Pending subscription payments — approve → subscription active, expiry +1 month */}
      {pendingPayments.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Pending subscription payments" />
          <CardBody>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${theme.borderMuted}` }}>
                  <th
                    style={{
                      padding: '12px 16px',
                      color: theme.textMuted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Merchant
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      color: theme.textMuted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      color: theme.textMuted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Amount
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      color: theme.textMuted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Date
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      color: theme.textMuted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${theme.borderMuted}` }}>
                    <td style={{ padding: '12px 16px' }}>
                      {p.merchant_name ?? String(p.merchant_id).slice(0, 8)}…
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {p.payment_type === 'annual' ? 'Annual' : 'Monthly'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      ₭{LAK_FMT.format(p.amount)} {p.currency}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        type="button"
                        disabled={approvingId === p.id}
                        onClick={() => handleApprove(p.id)}
                        className="px-3 py-1 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {approvingId === p.id ? t('common.loading') : 'Approve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Recent billing events" />
        <CardBody>
          {events.length === 0 ? (
            <EmptyState
              title="No billing events"
              description="Events will appear when invoices or payments are recorded."
            />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${theme.borderMuted}` }}>
                  <th
                    style={{
                      padding: '12px 16px',
                      color: theme.textMuted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Merchant
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      color: theme.textMuted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      color: theme.textMuted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Amount
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      color: theme.textMuted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      color: theme.textMuted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 50).map((ev) => {
                  const e = ev as Record<string, unknown>
                  return (
                    <tr
                      key={String(e.id)}
                      style={{ borderBottom: `1px solid ${theme.borderMuted}` }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        {String(e.merchant_id ?? '—').slice(0, 8)}…
                      </td>
                      <td style={{ padding: '12px 16px' }}>{String(e.event_type ?? '—')}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {Number(e.amount ?? 0)} {String(e.currency ?? '')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{String(e.status ?? '—')}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {e.created_at ? new Date(String(e.created_at)).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </PageShell>
  )
}
