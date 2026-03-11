import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { superApi, type SuperMerchantDetailResponse } from '../../lib/api';
import { PageShell, Card, CardHeader, CardBody, Badge, Section, EmptyState } from '../../components/ui';

export default function SuperMerchantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<SuperMerchantDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const token = user?.accessToken ?? null;

  useEffect(() => {
    if (!token || !id) return;
    superApi.merchant(token, id).then(setData).catch((e) => setError(e.message));
  }, [token, id]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id || !note.trim()) return;
    setSavingNote(true);
    try {
      await superApi.addNote(token, id, { note: note.trim() });
      setNote('');
      const updated = await superApi.merchant(token, id);
      setData(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSavingNote(false);
    }
  };

  const handleSupport = async () => {
    if (!token || !id) return;
    try {
      await superApi.supportStart(token, id);
      navigate(`/super/support?merchantId=${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!data) return <p>Loading...</p>;

  const merchant = data.merchant as { id: string; name: string; slug: string; billing_status: string };
  const plan = data.plan as Record<string, unknown> | null;

  return (
    <PageShell
      title={merchant.name}
      description={merchant.slug}
      breadcrumb={<Link to="/super/merchants">Merchants</Link>}
      actions={
        <>
          <button type="button" onClick={handleSupport} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 4 }}>
            Open support (read-only)
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
        <Card>
          <CardHeader title="Summary" />
          <CardBody>
            <p style={{ margin: '0 0 8px' }}><strong>Slug:</strong> {merchant.slug}</p>
            <p style={{ margin: '0 0 8px' }}><strong>Status:</strong> <Badge variant={merchant.billing_status === 'active' ? 'success' : merchant.billing_status === 'past_due' ? 'danger' : 'warning'}>{merchant.billing_status}</Badge></p>
            <p style={{ margin: '0 0 8px' }}><strong>Products:</strong> {data.productCount}</p>
            <p style={{ margin: 0 }}><strong>Payment accounts:</strong> {data.paymentAccountCount}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Billing" />
          <CardBody>
            {plan != null ? (
              <>
                <p style={{ margin: '0 0 8px' }}><strong>Plan:</strong> {String(plan.plan_code ?? '—')}</p>
                <p style={{ margin: '0 0 8px' }}><strong>Monthly:</strong> ${Number(plan.monthly_price_usd ?? 0)}</p>
                <p style={{ margin: '0 0 8px' }}><strong>Next billing:</strong> {plan.next_billing_at ? new Date(String(plan.next_billing_at)).toLocaleDateString() : '—'}</p>
                <p style={{ margin: 0 }}><strong>Last paid:</strong> {plan.last_paid_at ? new Date(String(plan.last_paid_at)).toLocaleDateString() : '—'}</p>
              </>
            ) : (
              <p style={{ margin: 0, color: '#6b7280' }}>No plan record.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Section title="Internal notes" style={{ marginTop: 24 }}>
        <Card>
          <CardBody>
            <form onSubmit={handleAddNote} style={{ marginBottom: 16 }}>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add internal note…" rows={2} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 4 }} />
              <button type="submit" disabled={savingNote || !note.trim()} style={{ marginTop: 8, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 4 }}>Add note</button>
            </form>
            {data.notes.length === 0 ? (
              <EmptyState title="No notes" />
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                {data.notes.map((n) => (
                  <li key={n.id} style={{ marginBottom: 8 }}>{n.note} <span style={{ color: '#9ca3af' }}>— {new Date(n.created_at).toLocaleString()}</span></li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </Section>

      <Section title="Recent billing events">
        <Card>
          <CardBody>
            {data.billingEvents.length === 0 ? (
              <EmptyState title="No billing events" />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: 8 }}>Type</th>
                    <th style={{ padding: 8 }}>Amount</th>
                    <th style={{ padding: 8 }}>Status</th>
                    <th style={{ padding: 8 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.billingEvents as Record<string, unknown>[]).slice(0, 10).map((e) => (
                    <tr key={String(e.id)} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 8 }}>{String(e.event_type)}</td>
                      <td style={{ padding: 8 }}>{Number(e.amount)} {String(e.currency)}</td>
                      <td style={{ padding: 8 }}>{String(e.status)}</td>
                      <td style={{ padding: 8 }}>{e.created_at ? new Date(String(e.created_at)).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </Section>

      <Section title="Support access history">
        <Card>
          <CardBody>
            {data.supportAccessHistory.length === 0 ? (
              <EmptyState title="No support access" />
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                {(data.supportAccessHistory as { started_at: string }[]).slice(0, 10).map((s, i) => (
                  <li key={i}>{new Date(s.started_at).toLocaleString()}</li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </Section>
    </PageShell>
  );
}
