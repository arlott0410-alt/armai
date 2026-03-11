import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { superApi } from '../../lib/api';
import { PageShell, Card, CardHeader, CardBody, EmptyState } from '../../components/ui';

export default function SuperAudit() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const token = user?.accessToken ?? null;

  useEffect(() => {
    if (!token) return;
    superApi.auditLogs(token, 50).then((r) => setLogs(r.logs ?? [])).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>;

  return (
    <PageShell title="Audit" description="Activity log for super admin actions">
      <Card>
        <CardHeader title="Audit log" />
        <CardBody>
          {logs.length === 0 ? (
            <EmptyState title="No audit entries" description="Actions will appear here." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: 8 }}>Time</th>
                  <th style={{ padding: 8 }}>Action</th>
                  <th style={{ padding: 8 }}>Resource</th>
                  <th style={{ padding: 8 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const row = l as Record<string, unknown>;
                  return (
                  <tr key={String(row.id)} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 8 }}>{row.created_at ? new Date(String(row.created_at)).toLocaleString() : '—'}</td>
                    <td style={{ padding: 8 }}>{String(row.action ?? '—')}</td>
                    <td style={{ padding: 8 }}>{String(row.resource_type ?? '—')} {row.resource_id ? String(row.resource_id).slice(0, 8) + '…' : ''}</td>
                    <td style={{ padding: 8 }}>{row.details ? JSON.stringify(row.details).slice(0, 60) + '…' : '—'}</td>
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
