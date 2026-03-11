import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { merchantApi, type MerchantDashboardResponse } from '../../lib/api';
import { PageShell, StatCard, Card, CardBody, Badge, Section, EmptyState } from '../../components/ui';

export default function MerchantDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<MerchantDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = user?.accessToken ?? null;

  useEffect(() => {
    if (!token) return;
    merchantApi.dashboard(token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!data) return <p>Loading...</p>;

  const summary = data.summary;
  const readiness = data.readiness ?? [];
  const readyCount = readiness.filter((r) => r.status === 'ready').length;
  const totalSteps = readiness.length;

  return (
    <PageShell title="Overview" description="Store overview and setup status">
      {summary != null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
          <StatCard label="Orders today" value={summary.ordersToday} />
          <StatCard label="Pending payment" value={summary.pendingPayment} />
          <StatCard label="Paid today" value={summary.paidToday} />
          <StatCard label="Manual review" value={summary.manualReviewCount} />
          <StatCard label="Probable match" value={summary.probableMatchCount} />
          <StatCard label="Active products" value={summary.activeProductsCount} />
          <StatCard label="Payment accounts" value={summary.activePaymentAccountsCount} />
        </div>
      )}

      <Section
        title="Setup readiness"
        description={totalSteps > 0 ? `${readyCount} of ${totalSteps} steps complete` : 'Complete setup to start selling.'}
      >
        <Card>
          <CardBody>
            {readiness.length === 0 ? (
              <EmptyState title="Loading setup status…" />
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'none' }}>
                {readiness.map((r) => (
                  <li key={r.key} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge variant={r.status === 'ready' ? 'success' : r.status === 'in_progress' ? 'warning' : 'default'}>
                      {r.status === 'ready' ? 'Ready' : r.status === 'in_progress' ? 'In progress' : 'Not started'}
                    </Badge>
                    <span>{r.label}</span>
                    {r.detail != null && <span style={{ color: '#6b7280', fontSize: 13 }}>{r.detail}</span>}
                    {r.status !== 'ready' && (
                      <Link
                        to={
                          r.key === 'products' ? '/merchant/products' :
                          r.key === 'categories' ? '/merchant/categories' :
                          r.key === 'payment_account' || r.key === 'primary_payment' ? '/merchant/payment-accounts' :
                          r.key === 'ai_prompt' ? '/merchant/settings' :
                          r.key === 'faq_knowledge' ? '/merchant/knowledge' :
                          r.key === 'bank_parser' ? '/merchant/settings' : '/merchant/settings'
                        }
                        style={{ marginLeft: 'auto', fontSize: 14, color: '#2563eb' }}
                      >
                        Set up
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </Section>

      {!summary && !data.settings && (
        <Card>
          <CardBody>
            <p style={{ color: '#6b7280', margin: 0 }}>Merchant ID: {data.merchantId}. Complete setup above to enable full dashboard.</p>
          </CardBody>
        </Card>
      )}
    </PageShell>
  );
}
