import React from 'react';

export function PageShell({
  title,
  description,
  breadcrumb,
  actions,
  children,
  style,
}: {
  title: string;
  description?: string;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ ...style }}>
      {breadcrumb != null && <div style={{ marginBottom: 8, fontSize: 14, color: '#6b7280' }}>{breadcrumb}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: '#111827' }}>{title}</h1>
          {description != null && <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>{description}</p>}
        </div>
        {actions != null && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}
