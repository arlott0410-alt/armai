import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { superApi } from '../../lib/api';
import { PageShell, Card, CardHeader, CardBody, EmptyState } from '../../components/ui';

export default function SuperBilling() {
  const { user } = useAuth();
  const [events, setEvents] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const token = user?.accessToken ?? null;

  useEffect(() => {
    if (!token) return;
    superApi.billingEvents(token).then((r) => setEvents(r.events ?? [])).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>;

  return (
    <PageShell title="Billing" description="Billing events across merchants">
      <Card>
        <CardHeader title="Recent billing events" />
        <CardBody>
          {events.length === 0 ? (
            <EmptyState title="No billing events" description="Events will appear when invoices or payments are recorded." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: 8 }}>Merchant</th>
                  <th style={{ padding: 8 }}>Type</th>
                  <th style={{ padding: 8 }}>Amount</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 50).map((ev) => {
                  const e = ev as Record<string, unknown>;
                  return (
                    <tr key={String(e.id)} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 8 }}>{String(e.merchant_id ?? '—').slice(0, 8)}…</td>
                      <td style={{ padding: 8 }}>{String(e.event_type ?? '—')}</td>
                      <td style={{ padding: 8 }}>{Number(e.amount ?? 0)} {String(e.currency ?? '')}</td>
                      <td style={{ padding: 8 }}>{String(e.status ?? '—')}</td>
                      <td style={{ padding: 8 }}>{e.created_at ? new Date(String(e.created_at)).toLocaleDateString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </PageShell>
  );
}
