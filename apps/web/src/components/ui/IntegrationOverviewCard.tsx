import React from 'react';
import { theme } from '../../theme';
import { StatusChip } from './StatusChip';
import type { BankSyncSetupSummary } from '../../lib/api';

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function IntegrationOverviewCard({
  summary,
  healthStatus,
  style,
}: {
  summary: BankSyncSetupSummary | null;
  healthStatus: string;
  style?: React.CSSProperties;
}) {
  if (!summary) return null;

  const matchModeLabel = summary.match_mode === 'relaxed' ? 'Relaxed' : 'Strict';
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Bank', value: summary.bank_label || 'Not selected' },
    { label: 'Parser', value: summary.parser_label },
    {
      label: 'Linked account',
      value: summary.payment_account_summary
        ? `${summary.payment_account_summary.account_number_masked} ${summary.payment_account_summary.is_primary ? '(Primary)' : ''}`
        : '—',
    },
    { label: 'Match mode', value: matchModeLabel },
    { label: 'Connection', value: summary.is_active ? 'Active' : 'Inactive' },
    { label: 'Token', value: summary.token_set ? 'Set' : 'Not set' },
    { label: 'Last transaction', value: formatDate(summary.last_received_at) },
    { label: 'Last test', value: formatDate(summary.last_tested_at) },
  ];
  const scoped = summary.scoping_scoped_count ?? 0;
  const ambiguous = summary.scoping_ambiguous_count ?? 0;
  const outOfScope = summary.scoping_out_of_scope_count ?? 0;
  const hasScoping = scoped + ambiguous + outOfScope > 0;

  return (
    <div
      style={{
        background: theme.surface,
        borderRadius: 10,
        border: `1px solid ${theme.borderMuted}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${theme.borderMuted}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Connection overview
        </span>
        <StatusChip status={healthStatus} />
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px 20px' }}>
        {rows.map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, color: theme.text }}>{value}</div>
          </div>
        ))}
      </div>
      {hasScoping && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: `1px solid ${theme.borderMuted}`,
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            fontSize: 12,
            color: theme.textSecondary,
          }}
        >
          <span><strong style={{ color: theme.success }}>{scoped}</strong> scoped</span>
          <span><strong style={{ color: theme.warning }}>{ambiguous}</strong> ambiguous</span>
          <span><strong style={{ color: theme.textMuted }}>{outOfScope}</strong> out of scope</span>
        </div>
      )}
    </div>
  );
}
