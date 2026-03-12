import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  customersApi,
  customerIdentitiesApi,
  type MerchantCustomerDetailResponse,
  type CustomerChannelIdentityRow,
} from '../../lib/api';
import { PageShell, PanelCard } from '../../components/ui';
import { theme } from '../../theme';

const inputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 400,
  padding: '10px 12px',
  background: theme.surfaceElevated,
  border: `1px solid ${theme.borderMuted}`,
  borderRadius: 6,
  color: theme.text,
  fontSize: 13,
};
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 6, fontWeight: 500, color: theme.textSecondary, fontSize: 13 };

export default function MerchantCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = user?.accessToken ?? null;
  const [data, setData] = useState<MerchantCustomerDetailResponse | null>(null);
  const [suggestions, setSuggestions] = useState<CustomerChannelIdentityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState(false);
  const [notes, setNotes] = useState('');

  const load = () => {
    if (!token || !id) return;
    customersApi.get(token, id).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
    customerIdentitiesApi.suggestions(token, id).then((r) => setSuggestions(r.suggestions ?? [])).catch(() => setSuggestions([]));
  };

  useEffect(() => {
    load();
  }, [token, id]);

  useEffect(() => {
    if (data?.customer) setNotes((data.customer as { notes?: string | null }).notes ?? '');
  }, [data?.customer]);

  const handleLink = async (channelIdentityId: string) => {
    if (!token || !id) return;
    setLinking(channelIdentityId);
    try {
      await customerIdentitiesApi.link(token, { channel_identity_id: channelIdentityId, merchant_customer_id: id });
      load();
    } finally {
      setLinking(null);
    }
  };

  const handleUnlink = async (channelIdentityId: string) => {
    if (!token || !id) return;
    if (!confirm('Unlink this channel identity from this customer? The identity will remain but no longer link to this profile.')) return;
    setUnlinking(channelIdentityId);
    try {
      await customerIdentitiesApi.unlink(token, { channel_identity_id: channelIdentityId });
      load();
    } finally {
      setUnlinking(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!token || !id) return;
    setSaveNote(true);
    try {
      await customersApi.update(token, id, { notes: notes || null });
      load();
    } finally {
      setSaveNote(false);
    }
  };

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (loading || !data) return <p style={{ color: theme.textSecondary }}>Loading…</p>;

  const customer = data.customer as MerchantCustomerDetailResponse['customer'] & { notes?: string | null };

  return (
    <PageShell
      title={customer.primary_display_name ?? 'Customer profile'}
      description="Unified profile across channels. Link or unlink identities safely."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PanelCard title="Customer summary" subtitle="Display name, phone, status">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={labelStyle}>Display name</div>
              <div style={{ color: theme.text }}>{customer.primary_display_name ?? '—'}</div>
            </div>
            <div>
              <div style={labelStyle}>Phone</div>
              <div style={{ color: theme.text }}>{customer.phone_number ?? '—'}</div>
            </div>
            <div>
              <div style={labelStyle}>Status</div>
              <span style={{ color: customer.status === 'active' ? theme.success : theme.textMuted }}>{customer.status}</span>
            </div>
            <div>
              <div style={labelStyle}>Orders</div>
              <div style={{ color: theme.text }}>{data.orderCount}</div>
            </div>
          </div>
          <button type="button" onClick={() => navigate('/merchant/customers')} style={{ padding: '8px 16px', background: theme.surfaceElevated, border: `1px solid ${theme.borderMuted}`, borderRadius: 6, color: theme.text, fontSize: 13, cursor: 'pointer' }}>
            ← Back to customers
          </button>
        </PanelCard>

        <PanelCard title="Linked channels" subtitle="Channel identities linked to this customer">
          {data.identities.length === 0 ? (
            <p style={{ color: theme.textSecondary, margin: 0 }}>No linked channel identities yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20, color: theme.textSecondary }}>
              {data.identities.map((ident) => (
                <li key={ident.id} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: theme.text }}><strong>{ident.channel_type}</strong> — {ident.channel_display_name ?? ident.external_user_id}</span>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>Last seen {new Date(ident.last_seen_at).toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => handleUnlink(ident.id)}
                    disabled={unlinking === ident.id}
                    style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', color: theme.danger, border: `1px solid ${theme.danger}`, borderRadius: 4, cursor: 'pointer' }}
                  >
                    {unlinking === ident.id ? 'Unlinking…' : 'Unlink'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        {suggestions.length > 0 && (
          <PanelCard title="Identity link suggestions" subtitle="Unlinked identities with matching phone. Confirm to link.">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {suggestions.map((s) => (
                <li key={s.id} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: theme.text }}>{s.channel_type} — {s.channel_display_name ?? s.external_user_id}</span>
                  <span style={{ fontSize: 12, color: theme.success }}>Same phone (high confidence)</span>
                  <button
                    type="button"
                    onClick={() => handleLink(s.id)}
                    disabled={linking === s.id}
                    style={{ padding: '4px 12px', fontSize: 12, background: theme.primary, color: theme.background, border: 0, borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                  >
                    {linking === s.id ? 'Linking…' : 'Link to this customer'}
                  </button>
                </li>
              ))}
            </ul>
          </PanelCard>
        )}

        <PanelCard title="Orders" subtitle="Orders associated with this customer">
          {data.orders.length === 0 ? (
            <p style={{ color: theme.textSecondary, margin: 0 }}>No orders yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {data.orders.map((o) => (
                <li key={o.id} style={{ marginBottom: 6 }}>
                  <a href={`/merchant/orders/${o.id}`} style={{ color: theme.primary }}>Order {o.id.slice(0, 8)}…</a>
                  {' '}<span style={{ color: theme.textSecondary }}>{o.status} · {o.payment_status} · {o.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard title="Recent conversations" subtitle="Last messages from linked channels">
          {data.recentMessages.length === 0 ? (
            <p style={{ color: theme.textSecondary, margin: 0 }}>No recent messages.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'none' }}>
              {data.recentMessages.slice(0, 10).map((m) => (
                <li key={m.id} style={{ marginBottom: 8, padding: 8, background: theme.surfaceElevated, borderRadius: 6 }}>
                  <span style={{ fontSize: 11, color: theme.textMuted }}>{m.channel_type} · {m.direction} · {new Date(m.created_at).toLocaleString()}</span>
                  <div style={{ color: theme.text, marginTop: 4 }}>{m.text_content?.slice(0, 200) ?? '(media)'}</div>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard title="Internal notes" subtitle="Merchant-only notes for this customer">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ ...inputStyle, minHeight: 80 }}
            placeholder="Notes…"
          />
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={saveNote}
            style={{ marginTop: 8, padding: '8px 16px', background: theme.primary, color: theme.background, border: 0, borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {saveNote ? 'Saving…' : 'Save notes'}
          </button>
        </PanelCard>

        <PanelCard title="Identity audit" subtitle="Recent link/unlink events">
          {data.identityEvents.length === 0 ? (
            <p style={{ color: theme.textSecondary, margin: 0 }}>No events yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: theme.textSecondary }}>
              {data.identityEvents.map((ev) => (
                <li key={ev.id} style={{ marginBottom: 4 }}>
                  {ev.event_type} by {ev.actor_type} at {new Date(ev.created_at).toLocaleString()}{ev.reason ? ` — ${ev.reason}` : ''}
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>
    </PageShell>
  );
}
