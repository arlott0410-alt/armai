import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { superApi, type SuperDashboardResponse } from '../../lib/api';
import { PageShell, StatCard, Card, CardHeader, CardBody, Badge, Section } from '../../components/ui';

export default function SuperDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<SuperDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = user?.accessToken ?? null;

  useEffect(() => {
    if (!token) return;
    superApi.dashboard(token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!data) return <p>Loading...</p>;

  const kpis = data.kpis;
  const revenue = data.revenue;
  const billingHealth = data.billingHealth;
  const setupHealth = data.setupHealth ?? [];
  const recentActivity = data.recentActivity ?? [];

  return (
    <PageShell title="Overview" description="Super Admin command center">
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="MRR (this month)" value={kpis ? `$${kpis.mrrThisMonth}` : `$${data.mrr}`} />
        <StatCard label="Active merchants" value={data.activeMerchants} />
        <StatCard label="Trialing" value={kpis?.trialingMerchants ?? 0} />
        <StatCard label="Past due" value={kpis?.pastDueMerchants ?? 0} />
        <StatCard label="Due in 7 days" value={kpis?.dueInNext7Days ?? 0} />
        <StatCard label="New this month" value={kpis?.newMerchantsThisMonth ?? 0} />
        <StatCard label="Activation ready" value={kpis?.activationReadyCount ?? 0} />
      </div>

      {/* Revenue */}
      {revenue != null && (
        <Section title="Revenue">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            <Card><CardBody>Current month MRR: <strong>${revenue.currentMonthMRR}</strong></CardBody></Card>
            <Card><CardBody>Expected next billing: <strong>${revenue.expectedNextBilling}</strong></CardBody></Card>
          </div>
        </Section>
      )}

      {/* Billing health */}
      {billingHealth != null && (billingHealth.overdue?.length > 0 || billingHealth.dueSoon?.length > 0 || billingHealth.trialEndingSoon?.length > 0) && (
        <Section title="Merchant billing health">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {billingHealth.overdue?.length > 0 && (
              <Card>
                <CardHeader title="Overdue" />
                <CardBody>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {billingHealth.overdue.slice(0, 5).map((m) => (
                      <li key={m.merchantId}><Link to={`/super/merchants/${m.merchantId}`}>{m.name}</Link></li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
            {billingHealth.dueSoon?.length > 0 && (
              <Card>
                <CardHeader title="Due soon" />
                <CardBody>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {billingHealth.dueSoon.slice(0, 5).map((m) => (
                      <li key={m.merchantId}><Link to={`/super/merchants/${m.merchantId}`}>{m.name}</Link></li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
            {billingHealth.trialEndingSoon?.length > 0 && (
              <Card>
                <CardHeader title="Trial ending soon" />
                <CardBody>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {billingHealth.trialEndingSoon.slice(0, 5).map((m) => (
                      <li key={m.merchantId}><Link to={`/super/merchants/${m.merchantId}`}>{m.name}</Link></li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
          </div>
        </Section>
      )}

      {/* Setup health */}
      {setupHealth.filter((s) => s.incompleteSetup).length > 0 && (
        <Section title="Setup incomplete">
          <Card>
            <CardBody>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: 8 }}>Merchant</th>
                    <th style={{ padding: 8 }}>Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {setupHealth.filter((s) => s.incompleteSetup).slice(0, 10).map((s) => (
                    <tr key={s.merchantId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 8 }}><Link to={`/super/merchants/${s.merchantId}`}>{s.name}</Link></td>
                      <td style={{ padding: 8 }}>
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

      {/* Recent activity */}
      <Section title="Recent activity">
        <Card>
          <CardBody>
            {recentActivity.length === 0 ? (
              <p style={{ color: '#6b7280', margin: 0 }}>No recent activity.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                {recentActivity.slice(0, 15).map((a) => (
                  <li key={a.id} style={{ marginBottom: 4 }}>
                    <Badge variant="info">{a.type}</Badge> {new Date(a.at).toLocaleString()}
                    {a.merchantId && <span> — <Link to={`/super/merchants/${a.merchantId}`}>Merchant</Link></span>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </Section>
    </PageShell>
  );
}
