import React from 'react';
import { theme, spacing } from '../../theme';

/**
 * Wraps a table with consistent toolbar area, loading/empty handling.
 * Use for enterprise list pages (orders, products, etc.).
 */
export function DataTableShell({
  toolbar,
  loading,
  empty,
  children,
  style,
}: {
  toolbar?: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ ...style }}>
      {toolbar != null && (
        <div
          style={{
            display: 'flex',
            gap: spacing.md,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: `${spacing.md} ${spacing.lg}`,
            borderBottom: `1px solid ${theme.borderMuted}`,
          }}
        >
          {toolbar}
        </div>
      )}
      {loading === true && (
        <div style={{ padding: spacing.xl, textAlign: 'center', color: theme.textSecondary }}>
          Loading…
        </div>
      )}
      {empty === true && !loading && (
        <div style={{ padding: spacing.xl, textAlign: 'center', color: theme.textMuted }}>
          No items
        </div>
      )}
      {!loading && !empty && children}
    </div>
  );
}
