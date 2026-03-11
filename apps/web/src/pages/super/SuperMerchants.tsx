import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { superApi, type MerchantListItem } from '../../lib/api';
import { PageShell, Card, CardBody, Badge, EmptyState } from '../../components/ui';

export default function SuperMerchants() {
  const { user } = useAuth();
  const [merchants, setMerchants] = useState<MerchantListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const token = user?.accessToken ?? null;

  const load = () => {
    if (!token) return;
    setLoading(true);
    superApi.merchants(token).then((r) => { setMerchants(r.merchants); setLoading(false); }).catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, [token]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);
    try {
      await superApi.createMerchant(token!, { name, slug, admin_email: adminEmail, admin_password: adminPassword });
      setAddOpen(false);
      setName('');
      setSlug('');
      setAdminEmail('');
      setAdminPassword('');
      load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setAddLoading(false);
    }
  };

  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>;

  return (
    <PageShell
      title="Merchants"
      description="Manage merchant tenants"
      actions={
        <button onClick={() => setAddOpen(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 4 }}>
          Add Merchant
        </button>
      }
    >
      {addOpen && (
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <h3 style={{ marginTop: 0 }}>Add Merchant</h3>
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4 }}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', maxWidth: 320, padding: 8, border: '1px solid #e5e7eb', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4 }}>Slug</label>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="a-z0-9-" style={{ width: '100%', maxWidth: 320, padding: 8, border: '1px solid #e5e7eb', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4 }}>Admin email</label>
                <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required style={{ width: '100%', maxWidth: 320, padding: 8, border: '1px solid #e5e7eb', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4 }}>รหัสผ่านแอดมิน (อย่างน้อย 6 ตัว)</label>
                <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={6} placeholder="ตั้งรหัสผ่านสำหรับล็อกอิน" style={{ width: '100%', maxWidth: 320, padding: 8, border: '1px solid #e5e7eb', borderRadius: 4 }} />
              </div>
              {addError && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{addError}</p>}
              <button type="submit" disabled={addLoading} style={{ marginRight: 8, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 4 }}>Create</button>
              <button type="button" onClick={() => setAddOpen(false)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 4 }}>Cancel</button>
            </form>
          </CardBody>
        </Card>
      )}
      {loading ? (
        <p>Loading...</p>
      ) : merchants.length === 0 ? (
        <Card><CardBody><EmptyState title="No merchants yet" description="Add a merchant to get started." action={<button onClick={() => setAddOpen(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 4 }}>Add Merchant</button>} /></CardBody></Card>
      ) : (
        <Card>
          <CardBody style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: 12 }}>Name</th>
                  <th style={{ padding: 12 }}>Slug</th>
                  <th style={{ padding: 12 }}>Admin email</th>
                  <th style={{ padding: 12 }}>Plan</th>
                  <th style={{ padding: 12 }}>Monthly</th>
                  <th style={{ padding: 12 }}>Billing</th>
                  <th style={{ padding: 12 }}>Next billing</th>
                  <th style={{ padding: 12 }}>Setup %</th>
                  <th style={{ padding: 12 }}>Products</th>
                  <th style={{ padding: 12 }}>Payments</th>
                  <th style={{ padding: 12 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 12 }}><Link to={`/super/merchants/${m.id}`} style={{ fontWeight: 500, color: '#2563eb' }}>{m.name}</Link></td>
                    <td style={{ padding: 12 }}>{m.slug}</td>
                    <td style={{ padding: 12 }}>{m.admin_email ?? '—'}</td>
                    <td style={{ padding: 12 }}>{m.plan_code ?? '—'}</td>
                    <td style={{ padding: 12 }}>${m.monthly_price_usd ?? 0}</td>
                    <td style={{ padding: 12 }}><Badge variant={m.billing_status === 'active' ? 'success' : m.billing_status === 'past_due' ? 'danger' : 'warning'}>{m.billing_status}</Badge></td>
                    <td style={{ padding: 12 }}>{m.next_billing_at ? new Date(m.next_billing_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: 12 }}>{m.setup_percent ?? 0}%</td>
                    <td style={{ padding: 12 }}>{m.product_count ?? 0}</td>
                    <td style={{ padding: 12 }}>{m.payment_account_count ?? 0}</td>
                    <td style={{ padding: 12 }}><Link to={`/super/merchants/${m.id}`} style={{ marginRight: 8, color: '#2563eb' }}>View</Link><Link to={`/super/support?merchantId=${m.id}`} style={{ color: '#2563eb' }}>Support</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </PageShell>
  );
}
