import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { categoriesApi, type CategoryRow, type CreateCategoryBody } from '../../lib/api';
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

export default function MerchantCategories() {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateCategoryBody>({
    name: '',
    description: null,
    sort_order: 0,
    is_active: true,
  });

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    categoriesApi
      .list(token, { activeOnly: false })
      .then((r) => setCategories(r.categories))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: null, sort_order: 0, is_active: true });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (c: CategoryRow) => {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description ?? null,
      sort_order: c.sort_order ?? 0,
      is_active: c.is_active,
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
    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }
    if (!token) return;
    setSaving(true);
    try {
      if (editing) {
        await categoriesApi.update(token, editing.id, form);
      } else {
        await categoriesApi.create(token, form);
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
  if (loading && categories.length === 0) return <p style={{ color: theme.textSecondary }}>Loading…</p>;

  return (
    <PageShell
      title="Categories"
      description="Product categories for catalog and AI context."
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
          Create category
        </button>
      }
    >
      <Card>
        <CardBody style={{ padding: 0 }}>
          {categories.length === 0 ? (
            <EmptyState
              title="No categories yet"
              description="Create categories to organize your products."
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
                  Create category
                </button>
              }
            />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${theme.borderMuted}` }}>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Name</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Order</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Active</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${theme.borderMuted}` }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: '12px 16px', color: theme.textSecondary }}>{c.sort_order}</td>
                    <td style={{ padding: '12px 16px' }}>{c.is_active ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        style={{
                          background: 'none',
                          border: 0,
                          color: theme.primary,
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 500,
                        }}
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
        title={editing ? 'Edit category' : 'Create category'}
        footer={<SaveCancelFooter onCancel={closeModal} onSave={handleSave} saving={saving} saveLabel={editing ? 'Update' : 'Create'} />}
      >
        {formError && <p style={{ color: theme.danger, marginBottom: 12, fontSize: 13 }}>{formError}</p>}
        <FieldGroup label="Name" hint="Required.">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={inputStyle}
            placeholder="Category name"
          />
        </FieldGroup>
        <FieldGroup label="Description (optional)">
          <textarea
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))}
            style={{ ...inputStyle, minHeight: 60 }}
            placeholder="Description"
          />
        </FieldGroup>
        <FieldGroup label="Sort order" hint="Lower numbers appear first.">
          <input
            type="number"
            min={0}
            value={form.sort_order ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
            style={inputStyle}
          />
        </FieldGroup>
        <FieldGroup label="Active">
          <input
            type="checkbox"
            checked={form.is_active ?? true}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            style={{ marginRight: 8 }}
          />
          <span style={{ fontSize: 13, color: theme.textSecondary }}>Visible and usable</span>
        </FieldGroup>
      </FormModal>
    </PageShell>
  );
}
