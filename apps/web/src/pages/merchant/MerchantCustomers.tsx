import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { customersApi, type MerchantCustomerRow } from '../../lib/api';
import { PageShell, PanelCard } from '../../components/ui';
import { theme } from '../../theme';

export default function MerchantCustomers() {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;
  const [customers, setCustomers] = useState<MerchantCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    customersApi.list(token).then((r) => setCustomers(r.customers ?? [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [token]);

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (loading) return <p style={{ color: theme.textSecondary }}>Loading…</p>;

  return (
    <PageShell
      title="Customers"
      description="Unified customer profiles across Facebook Messenger and WhatsApp. Link channel identities for a single view."
    >
      <PanelCard
        title="Customer profiles"
        subtitle="Merchant-scoped unified customers. Open a profile to see linked channels, orders, and link suggestions."
      >
        {customers.length === 0 ? (
          <p style={{ color: theme.textSecondary, margin: 0 }}>No customer profiles yet. Profiles are created when channel identities are linked (e.g. by phone match or manual link).</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${theme.borderMuted}` }}>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Name</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Phone</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Updated</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${theme.borderMuted}` }}>
                    <td style={{ padding: '12px 16px', color: theme.text }}>{c.primary_display_name ?? '—'}</td>
                    <td style={{ padding: '12px 16px', color: theme.textSecondary }}>{c.phone_number ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: c.status === 'active' ? theme.success : theme.textMuted, fontSize: 12 }}>{c.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: theme.textMuted, fontSize: 12 }}>{new Date(c.updated_at).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link to={`/merchant/customers/${c.id}`} style={{ color: theme.primary, textDecoration: 'none', fontWeight: 500 }}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>
    </PageShell>
  );
}
