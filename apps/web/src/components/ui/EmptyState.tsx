import React from 'react';

export function EmptyState({
  title,
  description,
  action,
  style,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: 48,
        textAlign: 'center',
        background: '#f9fafb',
        borderRadius: 8,
        border: '1px dashed #e5e7eb',
        color: '#6b7280',
        ...style,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 500, color: '#374151', marginBottom: 4 }}>{title}</div>
      {description != null && <div style={{ fontSize: 14, marginBottom: 16 }}>{description}</div>}
      {action}
    </div>
  );
}
