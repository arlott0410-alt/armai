import React from 'react';
import { theme, spacing, typography } from '../../theme';

/**
 * Form section with optional title and hint. Use for grouped fields in modals/settings.
 */
export function FormSection({
  title,
  hint,
  children,
  style,
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: spacing.lg, ...style }}>
      {title != null && (
        <div style={{ marginBottom: spacing.sm, color: theme.text, ...typography.sectionTitle }}>{title}</div>
      )}
      {hint != null && (
        <p style={{ margin: `0 0 ${spacing.sm}`, fontSize: 13, color: theme.textMuted }}>{hint}</p>
      )}
      {children}
    </div>
  );
}

/**
 * Inline hint or help text for a single field.
 */
export function FieldHint({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ margin: '4px 0 0', fontSize: 12, color: theme.textMuted, ...style }}>{children}</p>
  );
}
