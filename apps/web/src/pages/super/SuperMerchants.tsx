import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { superApi, type MerchantListItem } from '../../lib/api';
import { PageShell, Card, CardBody, EmptyState, StatusBadge, MerchantTable } from '../../components/ui';
import { theme } from '../../theme';

const primaryBtn = {
  padding: '10px 18px',
  background: theme.primary,
  color: theme.background,
  border: 0,
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 13,
};
const secondaryBtn = {
  padding: '10px 18px',
  background: 'transparent',
  color: theme.textSecondary,
  border: `1px solid ${theme.borderMuted}`,
  borderRadius: 6,
  fontSize: 13,
};

export default function SuperMerchants() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [merchants, setMerchants] = useState<MerchantListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [defaultCountry, setDefaultCountry] = useState<string>('TH');
  const [defaultCurrency, setDefaultCurrency] = useState<string>('');
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
      await superApi.createMerchant(token!, {
        name,
        slug,
        admin_email: adminEmail,
        admin_password: adminPassword,
        default_country: defaultCountry || undefined,
        default_currency: defaultCurrency || undefined,
      });
      setAddOpen(false);
      setName('');
      setSlug('');
      setAdminEmail('');
      setAdminPassword('');
      setDefaultCountry('TH');
      setDefaultCurrency('');
      load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setAddLoading(false);
    }
  };

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;

  const columns = [
    { key: 'name', header: 'Name', render: (m: MerchantListItem) => <Link to={`/super/merchants/${m.id}`} style={{ fontWeight: 600, color: theme.highlight }}>{m.name}</Link> },
    { key: 'slug', header: 'Slug', render: (m: MerchantListItem) => m.slug },
    { key: 'admin_email', header: 'Admin email', render: (m: MerchantListItem) => m.admin_email ?? '—' },
    { key: 'plan_code', header: 'Plan', render: (m: MerchantListItem) => m.plan_code ?? '—' },
    { key: 'monthly_price_usd', header: 'Monthly', render: (m: MerchantListItem) => `$${m.monthly_price_usd ?? 0}` },
    { key: 'billing_status', header: 'Billing', render: (m: MerchantListItem) => <StatusBadge status={m.billing_status} /> },
    { key: 'next_billing_at', header: 'Next billing', render: (m: MerchantListItem) => m.next_billing_at ? new Date(m.next_billing_at).toLocaleDateString() : '—' },
    { key: 'setup_percent', header: 'Setup %', render: (m: MerchantListItem) => `${m.setup_percent ?? 0}%` },
    { key: 'product_count', header: 'Products', render: (m: MerchantListItem) => String(m.product_count ?? 0) },
    { key: 'payment_account_count', header: 'Payments', render: (m: MerchantListItem) => String(m.payment_account_count ?? 0) },
    {
      key: 'actions',
      header: 'Actions',
      render: (m: MerchantListItem) => (
        <>
          <Link to={`/super/merchants/${m.id}`} style={{ marginRight: 12, color: theme.primary }}>View</Link>
          <Link to={`/super/support?merchantId=${m.id}`} style={{ color: theme.primary }}>Support</Link>
        </>
      ),
    },
  ];

  return (
    <PageShell
      title="Merchants"
      description="Manage merchant tenants"
      actions={<button onClick={() => setAddOpen(true)} style={primaryBtn}>Add Merchant</button>}
    >
      {addOpen && (
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: theme.text, fontSize: 15 }}>Add Merchant</h3>
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, color: theme.textSecondary, fontSize: 13 }}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', maxWidth: 320, padding: 10 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, color: theme.textSecondary, fontSize: 13 }}>Slug</label>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="a-z0-9-" style={{ width: '100%', maxWidth: 320, padding: 10 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, color: theme.textSecondary, fontSize: 13 }}>Admin email</label>
                <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required style={{ width: '100%', maxWidth: 320, padding: 10 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, color: theme.textSecondary, fontSize: 13 }}>Admin password (min 6 characters)</label>
                <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={6} style={{ width: '100%', maxWidth: 320, padding: 10 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, color: theme.textSecondary, fontSize: 13 }}>Default country</label>
                <select value={defaultCountry} onChange={(e) => setDefaultCountry(e.target.value)} style={{ width: '100%', maxWidth: 320, padding: 10 }}>
                  <option value="TH">Thailand (TH)</option>
                  <option value="LA">Laos (LA)</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, color: theme.textSecondary, fontSize: 13 }}>Default currency (optional)</label>
                <input value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)} placeholder="e.g. THB, LAK (leave empty to use country default)" style={{ width: '100%', maxWidth: 320, padding: 10 }} />
              </div>
              {addError && <p style={{ color: theme.danger, marginBottom: 8 }}>{addError}</p>}
              <button type="submit" disabled={addLoading} style={primaryBtn}>Create</button>
              <button type="button" onClick={() => setAddOpen(false)} style={{ ...secondaryBtn, marginLeft: 8 }}>Cancel</button>
            </form>
          </CardBody>
        </Card>
      )}
      {loading ? (
        <p style={{ color: theme.textSecondary }}>Loading...</p>
      ) : merchants.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState title="No merchants yet" description="Add a merchant to get started." action={<button onClick={() => setAddOpen(true)} style={primaryBtn}>Add Merchant</button>} />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody style={{ padding: 0 }}>
            <MerchantTable
              columns={columns}
              data={merchants}
              onRowClick={(m) => navigate(`/super/merchants/${m.id}`)}
              emptyMessage="No merchants."
            />
          </CardBody>
        </Card>
      )}
    </PageShell>
  );
}
