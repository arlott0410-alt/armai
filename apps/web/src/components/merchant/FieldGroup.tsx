import React from 'react';
import { theme } from '../../theme';

export function FieldGroup({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 18, ...style }}>
      <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: theme.textSecondary, fontSize: 13 }}>
        {label}
      </label>
      {hint != null && (
        <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>{hint}</div>
      )}
      {children}
    </div>
  );
}
