import React from 'react';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
};

export function Card({
  children,
  style,
  ...rest
}: { children: React.ReactNode; style?: React.CSSProperties } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{ ...cardStyle, ...style }} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, style }: { title: string; action?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...style }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>{title}</h3>
      {action}
    </div>
  );
}

export function CardBody({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ padding: 20, ...style }}>{children}</div>;
}
