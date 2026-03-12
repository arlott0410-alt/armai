import React, { useState } from 'react';
import { theme } from '../../theme';

export function CopyField({
  value,
  label,
  masked,
  onCopy,
  style,
}: {
  value: string;
  label?: string;
  masked?: boolean;
  onCopy?: () => void;
  style?: React.CSSProperties;
}) {
  const [copied, setCopied] = useState(false);
  const display = masked && value.length > 8 ? '••••••••' + value.slice(-4) : value;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div style={{ marginBottom: 12, ...style }}>
      {label != null && (
        <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4, fontWeight: 500 }}>{label}</div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          background: theme.surfaceElevated,
          border: `1px solid ${theme.borderMuted}`,
          borderRadius: 6,
          fontFamily: 'monospace',
          fontSize: 13,
          color: theme.text,
          wordBreak: 'break-all',
        }}
      >
        <span style={{ flex: 1 }}>{display || '—'}</span>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!value}
          style={{
            padding: '6px 12px',
            background: copied ? theme.success : theme.primary,
            color: theme.background,
            border: 0,
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: value ? 'pointer' : 'not-allowed',
            opacity: value ? 1 : 0.6,
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
