import React from 'react';
import { Card } from './Card';

const labelStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 500 };
const valueStyle: React.CSSProperties = { fontSize: 24, fontWeight: 600, color: '#111827' };

export function StatCard({
  label,
  value,
  sub,
  style,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Card style={{ padding: 16, ...style }}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
      {sub != null && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}
