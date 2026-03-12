import React from 'react';
import { theme } from '../../theme';

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: theme.success, bg: theme.successMuted },
  trialing: { label: 'Trialing', color: theme.highlight, bg: 'rgba(212, 175, 55, 0.2)' },
  past_due: { label: 'Past due', color: theme.danger, bg: theme.dangerMuted },
  cancelled: { label: 'Cancelled', color: theme.textMuted, bg: 'rgba(255,255,255,0.06)' },
  pending: { label: 'Pending', color: theme.warning, bg: theme.warningMuted },
  paid: { label: 'Paid', color: theme.success, bg: theme.successMuted },
  manual_review: { label: 'Manual review', color: theme.warning, bg: theme.warningMuted },
  probable_match: { label: 'Probable match', color: theme.info, bg: theme.infoMuted },
  ready: { label: 'Ready', color: theme.success, bg: theme.successMuted },
  in_progress: { label: 'In progress', color: theme.warning, bg: theme.warningMuted },
  not_started: { label: 'Not started', color: theme.textMuted, bg: 'rgba(255,255,255,0.06)' },
  inactive: { label: 'Inactive', color: theme.textMuted, bg: 'rgba(255,255,255,0.06)' },
  archived: { label: 'Archived', color: theme.textMuted, bg: 'rgba(255,255,255,0.06)' },
  healthy: { label: 'Healthy', color: theme.success, bg: theme.successMuted },
  needs_setup: { label: 'Needs setup', color: theme.warning, bg: theme.warningMuted },
  needs_attention: { label: 'Needs attention', color: theme.warning, bg: theme.warningMuted },
  configured: { label: 'Configured', color: theme.info, bg: theme.infoMuted },
  unmatched: { label: 'Unmatched', color: theme.textMuted, bg: 'rgba(255,255,255,0.06)' },
};

export function StatusBadge({
  status,
  label,
  style,
}: {
  status: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  const config = statusMap[status] ?? { label: status, color: theme.textSecondary, bg: 'rgba(255,255,255,0.1)' };
  const displayLabel = label ?? config.label;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: config.color,
        background: config.bg,
        ...style,
      }}
    >
      {displayLabel}
    </span>
  );
}
