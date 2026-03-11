import React from 'react';

const variants: Record<string, React.CSSProperties> = {
  default: { background: '#f3f4f6', color: '#374151' },
  success: { background: '#d1fae5', color: '#065f46' },
  warning: { background: '#fef3c7', color: '#92400e' },
  danger: { background: '#fee2e2', color: '#991b1b' },
  info: { background: '#dbeafe', color: '#1e40af' },
};

export function Badge({
  children,
  variant = 'default',
  style,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        ...variants[variant] ?? variants.default,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
