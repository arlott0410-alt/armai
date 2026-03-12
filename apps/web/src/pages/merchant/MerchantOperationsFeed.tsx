import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { operationsFeedApi, type OperationsFeedResponse } from '../../lib/api';
import { PageShell, PanelCard } from '../../components/ui';
import { theme } from '../../theme';

export default function MerchantOperationsFeed() {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;
  const [data, setData] = useState<OperationsFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    operationsFeedApi
      .getFeed(token, 50)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (loading) return <p style={{ color: theme.textSecondary }}>Loading…</p>;

  const events = data?.events ?? [];
  const ambiguous = data?.ambiguous_shipment_images ?? [];
  const awaiting = data?.awaiting_order_reference ?? [];

  return (
    <PageShell
      title="Operations feed"
      description="Telegram events, escalations, and shipment images awaiting order link"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {(ambiguous.length > 0 || awaiting.length > 0) && (
          <PanelCard
            title="Shipment images needing attention"
            subtitle="Ambiguous or awaiting order reference. Reply in Telegram with order number to link."
          >
            {ambiguous.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.warning, marginBottom: 8 }}>Ambiguous ({ambiguous.length})</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: theme.textSecondary }}>
                  {ambiguous.slice(0, 10).map((img) => (
                    <li key={img.id}>
                      {img.id.slice(0, 8)}… — {new Date(img.created_at).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {awaiting.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.info, marginBottom: 8 }}>Awaiting order reference ({awaiting.length})</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: theme.textSecondary }}>
                  {awaiting.slice(0, 10).map((img) => (
                    <li key={img.id}>
                      {img.id.slice(0, 8)}… — {new Date(img.created_at).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </PanelCard>
        )}

        <PanelCard title="Recent events" subtitle="Telegram operation event log">
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: theme.textSecondary }}>
            {events.length === 0 && <li>No events yet.</li>}
            {events.slice(0, 30).map((ev) => (
              <li key={ev.id} style={{ marginBottom: 6 }}>
                <span style={{ color: theme.primary, fontWeight: 500 }}>{ev.event_type}</span>
                {ev.event_note && ` — ${ev.event_note}`} — {new Date(ev.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </PanelCard>
      </div>
    </PageShell>
  );
}
