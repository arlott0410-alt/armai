import React, { useEffect } from 'react';
import { theme } from '../../theme';

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 24,
};

const panelStyle: React.CSSProperties = {
  background: theme.surface,
  borderRadius: 10,
  border: `1px solid ${theme.borderMuted}`,
  maxWidth: 560,
  width: '100%',
  maxHeight: '90vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
};

const headerStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: `1px solid ${theme.borderMuted}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const bodyStyle: React.CSSProperties = {
  padding: 20,
  overflowY: 'auto',
  flex: 1,
};

const footerStyle: React.CSSProperties = {
  padding: '14px 20px',
  borderTop: `1px solid ${theme.borderMuted}`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
};

export function FormModal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-modal-title"
    >
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 id="form-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.text }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 0,
              color: theme.textMuted,
              cursor: 'pointer',
              padding: 4,
              fontSize: 18,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div style={bodyStyle}>{children}</div>
        {footer != null && <div style={footerStyle}>{footer}</div>}
      </div>
    </div>
  );
}
