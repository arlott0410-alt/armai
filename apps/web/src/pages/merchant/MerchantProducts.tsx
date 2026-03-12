import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  merchantApi,
  productsApi,
  categoriesApi,
  type ProductRow,
  type CreateProductBody,
  type CategoryRow,
} from '../../lib/api';
import { getMerchantDefaultCurrency, FALLBACK_CURRENCY } from '@armai/shared';
import { PageShell, Card, CardBody, StatusBadge, EmptyState } from '../../components/ui';
import { FormModal, SaveCancelFooter, FieldGroup } from '../../components/merchant';
import { theme } from '../../theme';

const productStatusOptions = ['active', 'inactive', 'archived'] as const;
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: theme.surfaceElevated,
  border: `1px solid ${theme.borderMuted}`,
  borderRadius: 6,
  color: theme.text,
  fontSize: 13,
};
const selectStyle = { ...inputStyle, cursor: 'pointer' };

export default function MerchantProducts() {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;

  const [defaultCurrency, setDefaultCurrency] = useState<string>(FALLBACK_CURRENCY);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateProductBody>({
    name: '',
    slug: '',
    description: null,
    base_price: 0,
    sale_price: null,
    currency: defaultCurrency,
    sku: null,
    status: 'active',
    requires_manual_confirmation: false,
    ai_visible: true,
    is_cod_allowed: true,
    requires_manual_cod_confirmation: false,
  });

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const params = statusFilter ? { status: statusFilter } : undefined;
    productsApi
      .list(token, params)
      .then((r) => setProducts(r.products))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    categoriesApi
      .list(token, { activeOnly: false })
      .then((r) => setCategories(r.categories))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    merchantApi
      .dashboard(token)
      .then((r) => {
        const currency = r.merchant
          ? getMerchantDefaultCurrency(r.merchant.default_currency, r.merchant.default_country)
          : FALLBACK_CURRENCY;
        setDefaultCurrency(currency);
      })
      .catch(() => {});
  }, [token]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      category_id: null,
      name: '',
      slug: '',
      description: null,
      base_price: 0,
      sale_price: null,
      currency: defaultCurrency,
      sku: null,
      status: 'active',
      requires_manual_confirmation: false,
      ai_visible: true,
      is_cod_allowed: true,
      requires_manual_cod_confirmation: false,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (p: ProductRow) => {
    setEditing(p);
    setForm({
      category_id: p.category_id ?? undefined,
      name: p.name,
      slug: p.slug,
      description: p.description ?? undefined,
      base_price: p.base_price,
      sale_price: p.sale_price ?? undefined,
      currency: p.currency ?? defaultCurrency,
      sku: p.sku ?? undefined,
      status: p.status,
      requires_manual_confirmation: p.requires_manual_confirmation,
      ai_visible: p.ai_visible,
      is_cod_allowed: p.is_cod_allowed ?? true,
      requires_manual_cod_confirmation: p.requires_manual_cod_confirmation ?? false,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Name is required.';
    if (!form.slug.trim()) return 'Slug is required.';
    if (!/^[a-z0-9-]+$/.test(form.slug)) return 'Slug must be lowercase letters, numbers, and hyphens only.';
    if (form.base_price < 0) return 'Base price must be ≥ 0.';
    if (form.sale_price != null && form.sale_price < 0) return 'Sale price must be ≥ 0.';
    if (form.currency && form.currency.length !== 3) return 'Currency must be 3 characters (e.g. LAK, THB).';
    return null;
  };

  const handleSave = async () => {
    setFormError(null);
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    if (!token) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        description: form.description || null,
        sale_price: form.sale_price ?? null,
        sku: form.sku || null,
        currency: form.currency || undefined,
      };
      if (editing) {
        await productsApi.update(token, editing.id, body);
      } else {
        await productsApi.create(token, body);
      }
      closeModal();
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.slug ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (loading && products.length === 0) return <p style={{ color: theme.textSecondary }}>Loading…</p>;

  return (
    <PageShell
      title="Products"
      description="Product catalog. AI uses active, AI-visible products."
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
          Create product
        </button>
      }
    >
      <Card>
        <CardBody style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.borderMuted}`, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by name, slug, SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, maxWidth: 260 }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ ...selectStyle, width: 140 }}
            >
              <option value="">All statuses</option>
              {productStatusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title={products.length === 0 ? 'No products yet' : 'No matching products'}
              description={products.length === 0 ? 'Add products and categories so the AI can answer accurately.' : 'Try a different search or filter.'}
              action={
                products.length === 0 ? (
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
                    Create product
                  </button>
                ) : undefined
              }
            />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${theme.borderMuted}` }}>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Name</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Price</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>AI visible</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${theme.borderMuted}` }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '12px 16px' }}>{p.sale_price ?? p.base_price} {p.currency ?? defaultCurrency}</td>
                    <td style={{ padding: '12px 16px' }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: '12px 16px' }}>{p.ai_visible ? <StatusBadge status="ready" label="Yes" /> : <span style={{ color: theme.textMuted }}>No</span>}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
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
        title={editing ? 'Edit product' : 'Create product'}
        footer={
          <SaveCancelFooter onCancel={closeModal} onSave={handleSave} saving={saving} saveLabel={editing ? 'Update' : 'Create'} />
        }
      >
        {formError && <p style={{ color: theme.danger, marginBottom: 12, fontSize: 13 }}>{formError}</p>}
        <FieldGroup label="Category">
          <select
            value={form.category_id ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value || null }))}
            style={selectStyle}
          >
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="Name" hint="Required.">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={inputStyle}
            placeholder="Product name"
          />
        </FieldGroup>
        <FieldGroup label="Slug" hint="Lowercase letters, numbers, hyphens only (e.g. my-product).">
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
            style={inputStyle}
            placeholder="product-slug"
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
        <FieldGroup label="Base price">
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.base_price}
            onChange={(e) => setForm((f) => ({ ...f, base_price: Number(e.target.value) || 0 }))}
            style={inputStyle}
          />
        </FieldGroup>
        <FieldGroup label="Sale price (optional)">
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.sale_price ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value === '' ? null : Number(e.target.value) }))}
            style={inputStyle}
          />
        </FieldGroup>
        <FieldGroup label="Currency (3 chars, optional)">
          <input
            type="text"
            maxLength={3}
            value={form.currency ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() || undefined }))}
            style={inputStyle}
            placeholder={defaultCurrency}
          />
        </FieldGroup>
        <FieldGroup label="SKU (optional)">
          <input
            type="text"
            value={form.sku ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value || null }))}
            style={inputStyle}
            placeholder="SKU"
          />
        </FieldGroup>
        <FieldGroup label="Status">
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'active' | 'inactive' | 'archived' }))}
            style={selectStyle}
          >
            {productStatusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="Requires manual confirmation">
          <input
            type="checkbox"
            checked={form.requires_manual_confirmation ?? false}
            onChange={(e) => setForm((f) => ({ ...f, requires_manual_confirmation: e.target.checked }))}
            style={{ marginRight: 8 }}
          />
          <span style={{ fontSize: 13, color: theme.textSecondary }}>Yes</span>
        </FieldGroup>
        <FieldGroup label="AI visible">
          <input
            type="checkbox"
            checked={form.ai_visible ?? true}
            onChange={(e) => setForm((f) => ({ ...f, ai_visible: e.target.checked }))}
            style={{ marginRight: 8 }}
          />
          <span style={{ fontSize: 13, color: theme.textSecondary }}>Show to AI</span>
        </FieldGroup>
        <FieldGroup label="COD allowed">
          <input
            type="checkbox"
            checked={form.is_cod_allowed ?? true}
            onChange={(e) => setForm((f) => ({ ...f, is_cod_allowed: e.target.checked }))}
            style={{ marginRight: 8 }}
          />
          <span style={{ fontSize: 13, color: theme.textSecondary }}>Allow Cash on Delivery for this product</span>
        </FieldGroup>
        <FieldGroup label="COD requires manual confirmation">
          <input
            type="checkbox"
            checked={form.requires_manual_cod_confirmation ?? false}
            onChange={(e) => setForm((f) => ({ ...f, requires_manual_cod_confirmation: e.target.checked }))}
            style={{ marginRight: 8 }}
          />
          <span style={{ fontSize: 13, color: theme.textSecondary }}>Merchant must confirm before COD is ready to ship</span>
        </FieldGroup>
      </FormModal>
    </PageShell>
  );
}
