import React from 'react';
import { theme } from '../../theme';

const cancelStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  color: theme.textSecondary,
  border: `1px solid ${theme.borderMuted}`,
  borderRadius: 6,
  fontWeight: 500,
  fontSize: 13,
  cursor: 'pointer',
};

const saveStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: theme.primary,
  color: theme.background,
  border: 0,
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

export function SaveCancelFooter({
  onCancel,
  onSave,
  saving,
  saveLabel = 'Save',
}: {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
}) {
  const saveButtonStyle: React.CSSProperties = {
    ...saveStyle,
    opacity: saving ? 0.7 : 1,
    cursor: saving ? 'not-allowed' : 'pointer',
  };
  return (
    <>
      <button type="button" onClick={onCancel} style={cancelStyle} disabled={saving}>
        Cancel
      </button>
      <button type="button" onClick={onSave} style={saveButtonStyle} disabled={saving}>
        {saving ? 'Saving...' : saveLabel}
      </button>
    </>
  );
}
