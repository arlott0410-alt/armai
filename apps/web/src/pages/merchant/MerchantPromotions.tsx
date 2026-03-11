import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { promotionsApi, type PromotionRow, type CreatePromotionBody } from '../../lib/api';
import { PageShell, Card, CardBody, EmptyState } from '../../components/ui';
import { FormModal, SaveCancelFooter, FieldGroup } from '../../components/merchant';
import { theme } from '../../theme';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: theme.surfaceElevated,
  border: `1px solid ${theme.borderMuted}`,
  borderRadius: 6,
  color: theme.text,
  fontSize: 13,
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

function fromDatetimeLocal(s: string): string | null {
  if (!s.trim()) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export default function MerchantPromotions() {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;

  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<CreatePromotionBody>({
    title: '',
    content: null,
    valid_from: null,
    valid_until: null,
    keywords: null,
    is_active: true,
  });

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    promotionsApi
      .list(token, { activeOnly: false })
      .then((r) => setPromotions(r.promotions))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      content: null,
      valid_from: null,
      valid_until: null,
      keywords: null,
      is_active: true,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (p: PromotionRow) => {
    setEditing(p);
    setForm({
      title: p.title,
      content: p.content ?? null,
      valid_from: p.valid_from ?? null,
      valid_until: p.valid_until ?? null,
      keywords: p.keywords ?? null,
      is_active: p.is_active,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!token) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        content: form.content || null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        keywords: form.keywords || null,
      };
      if (editing) {
        await promotionsApi.update(token, editing.id, body);
      } else {
        await promotionsApi.create(token, body);
      }
      closeModal();
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (loading && promotions.length === 0) return <p style={{ color: theme.textSecondary }}>Loading…</p>;

  return (
    <PageShell
      title="Promotions"
      description="Active promotions for AI to use in context."
      actions={
        <button
          type="button"
          onClick={openCreate}
          style={{
            padding: '8px 16px',
            background: theme.primary,
            color: theme.background,
            border: 0,
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Create promotion
        </button>
      }
    >
      <Card>
        <CardBody style={{ padding: 0 }}>
          {promotions.length === 0 ? (
            <EmptyState
              title="No promotions yet"
              description="Add promotions so the AI can share them with customers."
              action={
                <button
                  type="button"
                  onClick={openCreate}
                  style={{
                    padding: '8px 16px',
                    background: theme.primary,
                    color: theme.background,
                    border: 0,
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Create promotion
                </button>
              }
            />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${theme.borderMuted}` }}>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Title</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Valid from</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Valid until</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Active</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${theme.borderMuted}` }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{p.title}</td>
                    <td style={{ padding: '12px 16px', color: theme.textSecondary }}>{p.valid_from ? new Date(p.valid_from).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '12px 16px', color: theme.textSecondary }}>{p.valid_until ? new Date(p.valid_until).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{p.is_active ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        style={{ background: 'none', border: 0, color: theme.primary, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <FormModal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit promotion' : 'Create promotion'}
        footer={<SaveCancelFooter onCancel={closeModal} onSave={handleSave} saving={saving} saveLabel={editing ? 'Update' : 'Create'} />}
      >
        {formError && <p style={{ color: theme.danger, marginBottom: 12, fontSize: 13 }}>{formError}</p>}
        <FieldGroup label="Title" hint="Required.">
          <input
            type="text"
            value={form.title ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            style={inputStyle}
            placeholder="Promotion title"
          />
        </FieldGroup>
        <FieldGroup label="Content (optional)">
          <textarea
            value={form.content ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value || null }))}
            style={{ ...inputStyle, minHeight: 80 }}
            placeholder="Description or terms"
          />
        </FieldGroup>
        <FieldGroup label="Valid from (optional, ISO datetime)">
          <input
            type="datetime-local"
            value={toDatetimeLocal(form.valid_from ?? null)}
            onChange={(e) => setForm((f) => ({ ...f, valid_from: fromDatetimeLocal(e.target.value) }))}
            style={inputStyle}
          />
        </FieldGroup>
        <FieldGroup label="Valid until (optional, ISO datetime)">
          <input
            type="datetime-local"
            value={toDatetimeLocal(form.valid_until ?? null)}
            onChange={(e) => setForm((f) => ({ ...f, valid_until: fromDatetimeLocal(e.target.value) }))}
            style={inputStyle}
          />
        </FieldGroup>
        <FieldGroup label="Keywords (optional)">
          <input
            type="text"
            value={form.keywords ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value || null }))}
            style={inputStyle}
            placeholder="keyword1, keyword2"
          />
        </FieldGroup>
        <FieldGroup label="Active">
          <input
            type="checkbox"
            checked={form.is_active ?? true}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            style={{ marginRight: 8 }}
          />
          <span style={{ fontSize: 13, color: theme.textSecondary }}>Visible to AI</span>
        </FieldGroup>
      </FormModal>
    </PageShell>
  );
}
