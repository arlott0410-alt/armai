import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { merchantApi, paymentAccountsApi, type PaymentAccountRow, type CreatePaymentAccountBody } from '../../lib/api';
import { getMerchantDefaultCurrency, FALLBACK_CURRENCY } from '@armai/shared';
import { PageShell, Card, CardBody, EmptyState } from '../../components/ui';
import { FormModal, SaveCancelFooter, FieldGroup } from '../../components/merchant';
import { Badge } from '../../components/ui';
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

export default function MerchantPaymentAccounts() {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;

  const [defaultCurrency, setDefaultCurrency] = useState<string>(FALLBACK_CURRENCY);
  const [accounts, setAccounts] = useState<PaymentAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentAccountRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<CreatePaymentAccountBody>({
    bank_code: '',
    account_name: null,
    account_number: '',
    account_holder_name: '',
    currency: defaultCurrency,
    qr_image_path: null,
    qr_image_object_key: null,
    is_primary: false,
    is_active: true,
    sort_order: 0,
    notes: null,
  });

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    paymentAccountsApi
      .list(token, { activeOnly: false })
      .then((r) => setAccounts(r.paymentAccounts))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

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
      bank_code: '',
      account_name: null,
      account_number: '',
      account_holder_name: '',
      currency: defaultCurrency,
      qr_image_path: null,
      qr_image_object_key: null,
      is_primary: false,
      is_active: true,
      sort_order: 0,
      notes: null,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (a: PaymentAccountRow) => {
    setEditing(a);
    setForm({
      bank_code: a.bank_code,
      account_name: a.account_name ?? null,
      account_number: a.account_number,
      account_holder_name: a.account_holder_name,
      currency: a.currency ?? defaultCurrency,
      qr_image_path: a.qr_image_path ?? null,
      qr_image_object_key: a.qr_image_object_key ?? null,
      is_primary: a.is_primary,
      is_active: a.is_active,
      sort_order: a.sort_order ?? 0,
      notes: a.notes ?? null,
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
    if (!form.bank_code?.trim()) return 'Bank code is required.';
    if (!form.account_number?.trim()) return 'Account number is required.';
    if (!form.account_holder_name?.trim()) return 'Account holder name is required.';
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
        account_name: form.account_name || null,
        currency: form.currency || undefined,
        qr_image_path: form.qr_image_path || null,
        qr_image_object_key: form.qr_image_object_key || null,
        notes: form.notes || null,
      };
      if (editing) {
        await paymentAccountsApi.update(token, editing.id, body);
      } else {
        await paymentAccountsApi.create(token, body);
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
  if (loading && accounts.length === 0) return <p style={{ color: theme.textSecondary }}>Loading…</p>;

  return (
    <PageShell
      title="Payment accounts"
      description="Bank/payment accounts the AI can send to customers. No hardcoded accounts."
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
          Add payment account
        </button>
      }
    >
      <Card>
        <CardBody style={{ padding: 0 }}>
          {accounts.length === 0 ? (
            <EmptyState
              title="No payment accounts"
              description="Add at least one payment account (and mark one as primary) so the system can assign payment targets to orders. Orders cannot be completed without a primary account."
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
                  Add payment account
                </button>
              }
            />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${theme.borderMuted}` }}>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Account</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Number</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Bank</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Primary</th>
                  <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Active</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} style={{ borderBottom: `1px solid ${theme.borderMuted}` }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{a.account_name ?? a.account_number}</td>
                    <td style={{ padding: '12px 16px' }}>{a.account_number}</td>
                    <td style={{ padding: '12px 16px' }}>{a.bank_code}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {a.is_primary ? <Badge variant="gold">Primary</Badge> : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {a.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="default">Inactive</Badge>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
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
        title={editing ? 'Edit payment account' : 'Add payment account'}
        footer={<SaveCancelFooter onCancel={closeModal} onSave={handleSave} saving={saving} saveLabel={editing ? 'Update' : 'Create'} />}
      >
        {formError && <p style={{ color: theme.danger, marginBottom: 12, fontSize: 13 }}>{formError}</p>}
        <FieldGroup label="Bank code" hint="Required (e.g. SCB, BBL).">
          <input
            type="text"
            value={form.bank_code ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, bank_code: e.target.value }))}
            style={inputStyle}
            placeholder="SCB"
          />
        </FieldGroup>
        <FieldGroup label="Account name (optional)">
          <input
            type="text"
            value={form.account_name ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value || null }))}
            style={inputStyle}
            placeholder="Display name"
          />
        </FieldGroup>
        <FieldGroup label="Account number" hint="Required.">
          <input
            type="text"
            value={form.account_number ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
            style={inputStyle}
            placeholder="Account number"
          />
        </FieldGroup>
        <FieldGroup label="Account holder name" hint="Required.">
          <input
            type="text"
            value={form.account_holder_name ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, account_holder_name: e.target.value }))}
            style={inputStyle}
            placeholder="Holder name"
          />
        </FieldGroup>
        <FieldGroup label="Currency (3 chars)">
          <input
            type="text"
            maxLength={3}
            value={form.currency ?? defaultCurrency}
            onChange={(e) => setForm((f) => ({ ...f, currency: (e.target.value.toUpperCase() || defaultCurrency).slice(0, 3) }))}
            style={inputStyle}
            placeholder={defaultCurrency}
          />
        </FieldGroup>
        <FieldGroup label="QR image path (optional)">
          <input
            type="text"
            value={form.qr_image_path ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, qr_image_path: e.target.value || null }))}
            style={inputStyle}
            placeholder="URL or path"
          />
        </FieldGroup>
        <FieldGroup label="QR image object key (optional)">
          <input
            type="text"
            value={form.qr_image_object_key ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, qr_image_object_key: e.target.value || null }))}
            style={inputStyle}
            placeholder="Storage key"
          />
        </FieldGroup>
        <FieldGroup label="Sort order">
          <input
            type="number"
            min={0}
            value={form.sort_order ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
            style={inputStyle}
          />
        </FieldGroup>
        <FieldGroup label="Notes (optional)">
          <input
            type="text"
            value={form.notes ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
            style={inputStyle}
            placeholder="Internal notes"
          />
        </FieldGroup>
        <FieldGroup label="Primary">
          <input
            type="checkbox"
            checked={form.is_primary ?? false}
            onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
            style={{ marginRight: 8 }}
          />
          <span style={{ fontSize: 13, color: theme.textSecondary }}>Use as default for new orders</span>
        </FieldGroup>
        <FieldGroup label="Active">
          <input
            type="checkbox"
            checked={form.is_active ?? true}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            style={{ marginRight: 8 }}
          />
          <span style={{ fontSize: 13, color: theme.textSecondary }}>Available for use</span>
        </FieldGroup>
      </FormModal>
    </PageShell>
  );
}
