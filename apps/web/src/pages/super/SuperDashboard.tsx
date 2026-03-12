import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { superApi, type SuperDashboardResponse } from '../../lib/api';
import { PageShell, StatCard, Card, CardHeader, CardBody, Section, ActivityFeed, RevenueChart } from '../../components/ui';
import { theme } from '../../theme';

export default function SuperDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<SuperDashboardResponse | null>(null);
  const [channelMetrics, setChannelMetrics] = useState<{
    whatsappMerchantCount: number;
    whatsappActiveConnections: number;
    messagesByChannel: { facebook: number; whatsapp: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = user?.accessToken ?? null;

  useEffect(() => {
    if (!token) return;
    superApi.dashboard(token).then(setData).catch((e) => setError(e.message));
    superApi.channelMetrics(token).then(setChannelMetrics).catch(() => setChannelMetrics(null));
  }, [token]);

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (!data) return <p style={{ color: theme.textSecondary }}>Loading...</p>;

  const kpis = data.kpis;
  const revenue = data.revenue;
  const billingHealth = data.billingHealth;
  const setupHealth = data.setupHealth ?? [];
  const recentActivity = data.recentActivity ?? [];

  const chartData = revenue != null
    ? [
        { label: 'MRR', value: revenue.currentMonthMRR },
        { label: 'Next', value: revenue.expectedNextBilling },
      ]
    : [];

  const activityItems = recentActivity.slice(0, 15).map((a) => ({
    id: a.id,
    type: a.type,
    at: a.at,
    title: a.type.replace(/_/g, ' '),
    meta: a.merchantId ? <Link to={`/super/merchants/${a.merchantId}`}>View</Link> : null,
  }));

  return (
    <PageShell title="Overview" description="AI SaaS Command Center">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="MRR (this month)" value={kpis ? `$${kpis.mrrThisMonth}` : `$${data.mrr}`} accent />
        <StatCard label="Active merchants" value={data.activeMerchants} />
        <StatCard label="Trialing" value={kpis?.trialingMerchants ?? 0} />
        <StatCard label="Past due" value={kpis?.pastDueMerchants ?? 0} />
        <StatCard label="Due in 7 days" value={kpis?.dueInNext7Days ?? 0} />
        <StatCard label="New this month" value={kpis?.newMerchantsThisMonth ?? 0} />
        <StatCard label="Activation ready" value={kpis?.activationReadyCount ?? 0} />
        {channelMetrics != null && (
          <>
            <StatCard label="WhatsApp merchants" value={channelMetrics.whatsappMerchantCount} />
            <StatCard label="WhatsApp connections" value={channelMetrics.whatsappActiveConnections} />
          </>
        )}
      </div>

      {channelMetrics != null && (
        <Section title="Messaging by channel" description="Total messages in channel_messages">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            <Card>
              <CardBody>
                <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Facebook</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: theme.text }}>{channelMetrics.messagesByChannel.facebook}</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>WhatsApp</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: theme.text }}>{channelMetrics.messagesByChannel.whatsapp}</div>
              </CardBody>
            </Card>
          </div>
        </Section>
      )}

      {revenue != null && (
        <Section title="Revenue" description="Current and expected billing">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 24, alignItems: 'end' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <Card>
                <CardBody>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current month MRR</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: theme.highlight }}>${revenue.currentMonthMRR}</div>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Expected next billing</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: theme.text }}>${revenue.expectedNextBilling}</div>
                </CardBody>
              </Card>
            </div>
            {chartData.length > 0 && (
              <Card>
                <CardBody style={{ paddingBottom: 12 }}>
                  <RevenueChart data={chartData} height={80} />
                </CardBody>
              </Card>
            )}
          </div>
        </Section>
      )}

      {billingHealth != null && (billingHealth.overdue?.length > 0 || billingHealth.dueSoon?.length > 0 || billingHealth.trialEndingSoon?.length > 0) && (
        <Section title="Merchant billing health">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {billingHealth.overdue?.length > 0 && (
              <Card>
                <CardHeader title="Overdue" />
                <CardBody>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {billingHealth.overdue.slice(0, 5).map((m) => (
                      <li key={m.merchantId} style={{ marginBottom: 6 }}><Link to={`/super/merchants/${m.merchantId}`}>{m.name}</Link></li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
            {billingHealth.dueSoon?.length > 0 && (
              <Card>
                <CardHeader title="Due soon" />
                <CardBody>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {billingHealth.dueSoon.slice(0, 5).map((m) => (
                      <li key={m.merchantId} style={{ marginBottom: 6 }}><Link to={`/super/merchants/${m.merchantId}`}>{m.name}</Link></li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
            {billingHealth.trialEndingSoon?.length > 0 && (
              <Card>
                <CardHeader title="Trial ending soon" />
                <CardBody>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {billingHealth.trialEndingSoon.slice(0, 5).map((m) => (
                      <li key={m.merchantId} style={{ marginBottom: 6 }}><Link to={`/super/merchants/${m.merchantId}`}>{m.name}</Link></li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
          </div>
        </Section>
      )}

      {setupHealth.filter((s) => s.incompleteSetup).length > 0 && (
        <Section title="Setup incomplete">
          <Card>
            <CardBody style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: `1px solid ${theme.borderMuted}` }}>
                    <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Merchant</th>
                    <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {setupHealth.filter((s) => s.incompleteSetup).slice(0, 10).map((s) => (
                    <tr key={s.merchantId} style={{ borderBottom: `1px solid ${theme.borderMuted}` }}>
                      <td style={{ padding: '12px 16px' }}><Link to={`/super/merchants/${s.merchantId}`}>{s.name}</Link></td>
                      <td style={{ padding: '12px 16px', color: theme.textSecondary }}>
                        {[s.missingProducts && 'Products', s.noPaymentAccount && 'Payment account', s.noAiPrompt && 'AI prompt'].filter(Boolean).join(', ')}
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
  );
}
