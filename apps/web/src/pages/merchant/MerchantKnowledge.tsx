import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  knowledgeApi,
  type FaqRow,
  type CreateFaqBody,
  type KnowledgeEntryRow,
  type CreateKnowledgeEntryBody,
} from '../../lib/api';
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

type Tab = 'faqs' | 'entries';

export default function MerchantKnowledge() {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;

  const [tab, setTab] = useState<Tab>('faqs');
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [entries, setEntries] = useState<KnowledgeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqRow | null>(null);
  const [faqForm, setFaqForm] = useState<CreateFaqBody>({ question: '', answer: '', keywords: null, sort_order: 0, is_active: true });
  const [faqSaving, setFaqSaving] = useState(false);
  const [faqFormError, setFaqFormError] = useState<string | null>(null);

  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntryRow | null>(null);
  const [entryForm, setEntryForm] = useState<CreateKnowledgeEntryBody>({ type: 'general', title: '', content: '', keywords: null, priority: 0, is_active: true });
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryFormError, setEntryFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      knowledgeApi.faqs(token, { activeOnly: false }),
      knowledgeApi.entries(token, { activeOnly: false }),
    ])
      .then(([f, e]) => {
        setFaqs(f.faqs);
        setEntries(e.entries);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openFaqCreate = () => {
    setEditingFaq(null);
    setFaqForm({ question: '', answer: '', keywords: null, sort_order: 0, is_active: true });
    setFaqFormError(null);
    setFaqModalOpen(true);
  };

  const openFaqEdit = (row: FaqRow) => {
    setEditingFaq(row);
    setFaqForm({
      question: row.question,
      answer: row.answer,
      keywords: row.keywords ?? null,
      sort_order: row.sort_order ?? 0,
      is_active: row.is_active,
    });
    setFaqFormError(null);
    setFaqModalOpen(true);
  };

  const saveFaq = async () => {
    setFaqFormError(null);
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      setFaqFormError('Question and answer are required.');
      return;
    }
    if (!token) return;
    setFaqSaving(true);
    try {
      if (editingFaq) {
        await knowledgeApi.updateFaq(token, editingFaq.id, faqForm);
      } else {
        await knowledgeApi.createFaq(token, faqForm);
      }
      setFaqModalOpen(false);
      setEditingFaq(null);
      load();
    } catch (e) {
      setFaqFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setFaqSaving(false);
    }
  };

  const openEntryCreate = () => {
    setEditingEntry(null);
    setEntryForm({ type: 'general', title: '', content: '', keywords: null, priority: 0, is_active: true });
    setEntryFormError(null);
    setEntryModalOpen(true);
  };

  const openEntryEdit = (row: KnowledgeEntryRow) => {
    setEditingEntry(row);
    setEntryForm({
      type: row.type,
      title: row.title,
      content: row.content,
      keywords: row.keywords ?? null,
      priority: row.priority ?? 0,
      is_active: row.is_active,
    });
    setEntryFormError(null);
    setEntryModalOpen(true);
  };

  const saveEntry = async () => {
    setEntryFormError(null);
    if (!entryForm.type.trim() || !entryForm.title.trim() || !entryForm.content.trim()) {
      setEntryFormError('Type, title, and content are required.');
      return;
    }
    if (!token) return;
    setEntrySaving(true);
    try {
      if (editingEntry) {
        await knowledgeApi.updateEntry(token, editingEntry.id, entryForm);
      } else {
        await knowledgeApi.createEntry(token, entryForm);
      }
      setEntryModalOpen(false);
      setEditingEntry(null);
      load();
    } catch (e) {
      setEntryFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setEntrySaving(false);
    }
  };

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (loading && faqs.length === 0 && entries.length === 0) return <p style={{ color: theme.textSecondary }}>Loading…</p>;

  const tabStyle = (t: Tab) => ({
    padding: '8px 16px',
    background: tab === t ? theme.primary : 'transparent',
    color: tab === t ? theme.background : theme.textSecondary,
    border: `1px solid ${tab === t ? theme.primary : theme.borderMuted}`,
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  });

  return (
    <PageShell
      title="Knowledge base"
      description="FAQs and knowledge entries for AI retrieval. No hardcoded answers."
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => setTab('faqs')} style={tabStyle('faqs')}>
            FAQs
          </button>
          <button type="button" onClick={() => setTab('entries')} style={tabStyle('entries')}>
            Entries
          </button>
          {tab === 'faqs' ? (
            <button
              type="button"
              onClick={openFaqCreate}
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
              Add FAQ
            </button>
          ) : (
            <button
              type="button"
              onClick={openEntryCreate}
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
              Add entry
            </button>
          )}
        </div>
      }
    >
      {tab === 'faqs' ? (
        <Card>
          <CardBody style={{ padding: 0 }}>
            {faqs.length === 0 ? (
              <EmptyState
                title="No FAQs yet"
                description="Add FAQs so the AI can answer common questions."
                action={
                  <button
                    type="button"
                    onClick={openFaqCreate}
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
                    Add FAQ
                  </button>
                }
              />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: `1px solid ${theme.borderMuted}` }}>
                    <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Question</th>
                    <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Order</th>
                    <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Active</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {faqs.map((f) => (
                    <tr key={f.id} style={{ borderBottom: `1px solid ${theme.borderMuted}` }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{f.question}</td>
                      <td style={{ padding: '12px 16px', color: theme.textSecondary }}>{f.sort_order}</td>
                      <td style={{ padding: '12px 16px' }}>{f.is_active ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          type="button"
                          onClick={() => openFaqEdit(f)}
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
      ) : (
        <Card>
          <CardBody style={{ padding: 0 }}>
            {entries.length === 0 ? (
              <EmptyState
                title="No knowledge entries yet"
                description="Add entries to give the AI more context."
                action={
                  <button
                    type="button"
                    onClick={openEntryCreate}
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
                    Add entry
                  </button>
                }
              />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: `1px solid ${theme.borderMuted}` }}>
                    <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Type</th>
                    <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Title</th>
                    <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Priority</th>
                    <th style={{ padding: '12px 16px', color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Active</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} style={{ borderBottom: `1px solid ${theme.borderMuted}` }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{e.type}</td>
                      <td style={{ padding: '12px 16px' }}>{e.title}</td>
                      <td style={{ padding: '12px 16px', color: theme.textSecondary }}>{e.priority}</td>
                      <td style={{ padding: '12px 16px' }}>{e.is_active ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          type="button"
                          onClick={() => openEntryEdit(e)}
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
      )}

      <FormModal
        open={faqModalOpen}
        onClose={() => { setFaqModalOpen(false); setEditingFaq(null); setFaqFormError(null); }}
        title={editingFaq ? 'Edit FAQ' : 'Add FAQ'}
        footer={<SaveCancelFooter onCancel={() => setFaqModalOpen(false)} onSave={saveFaq} saving={faqSaving} saveLabel={editingFaq ? 'Update' : 'Create'} />}
      >
        {faqFormError && <p style={{ color: theme.danger, marginBottom: 12, fontSize: 13 }}>{faqFormError}</p>}
        <FieldGroup label="Question" hint="Required.">
          <input
            type="text"
            value={faqForm.question}
            onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))}
            style={inputStyle}
            placeholder="Question"
          />
        </FieldGroup>
        <FieldGroup label="Answer" hint="Required.">
          <textarea
            value={faqForm.answer}
            onChange={(e) => setFaqForm((f) => ({ ...f, answer: e.target.value }))}
            style={{ ...inputStyle, minHeight: 80 }}
            placeholder="Answer"
          />
        </FieldGroup>
        <FieldGroup label="Keywords (optional, comma-separated)">
          <input
            type="text"
            value={faqForm.keywords ?? ''}
            onChange={(e) => setFaqForm((f) => ({ ...f, keywords: e.target.value || null }))}
            style={inputStyle}
            placeholder="keyword1, keyword2"
          />
        </FieldGroup>
        <FieldGroup label="Sort order">
          <input
            type="number"
            min={0}
            value={faqForm.sort_order ?? 0}
            onChange={(e) => setFaqForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
            style={inputStyle}
          />
        </FieldGroup>
        <FieldGroup label="Active">
          <input
            type="checkbox"
            checked={faqForm.is_active ?? true}
            onChange={(e) => setFaqForm((f) => ({ ...f, is_active: e.target.checked }))}
            style={{ marginRight: 8 }}
          />
          <span style={{ fontSize: 13, color: theme.textSecondary }}>Visible to AI</span>
        </FieldGroup>
      </FormModal>

      <FormModal
        open={entryModalOpen}
        onClose={() => { setEntryModalOpen(false); setEditingEntry(null); setEntryFormError(null); }}
        title={editingEntry ? 'Edit knowledge entry' : 'Add knowledge entry'}
        footer={<SaveCancelFooter onCancel={() => setEntryModalOpen(false)} onSave={saveEntry} saving={entrySaving} saveLabel={editingEntry ? 'Update' : 'Create'} />}
      >
        {entryFormError && <p style={{ color: theme.danger, marginBottom: 12, fontSize: 13 }}>{entryFormError}</p>}
        <FieldGroup label="Type" hint="e.g. general, policy, product_info.">
          <input
            type="text"
            value={entryForm.type}
            onChange={(e) => setEntryForm((f) => ({ ...f, type: e.target.value }))}
            style={inputStyle}
            placeholder="general"
          />
        </FieldGroup>
        <FieldGroup label="Title" hint="Required.">
          <input
            type="text"
            value={entryForm.title}
            onChange={(e) => setEntryForm((f) => ({ ...f, title: e.target.value }))}
            style={inputStyle}
            placeholder="Title"
          />
        </FieldGroup>
        <FieldGroup label="Content" hint="Required.">
          <textarea
            value={entryForm.content}
            onChange={(e) => setEntryForm((f) => ({ ...f, content: e.target.value }))}
            style={{ ...inputStyle, minHeight: 100 }}
            placeholder="Content"
          />
        </FieldGroup>
        <FieldGroup label="Keywords (optional)">
          <input
            type="text"
            value={entryForm.keywords ?? ''}
            onChange={(e) => setEntryForm((f) => ({ ...f, keywords: e.target.value || null }))}
            style={inputStyle}
            placeholder="keyword1, keyword2"
          />
        </FieldGroup>
        <FieldGroup label="Priority" hint="Higher = more weight.">
          <input
            type="number"
            min={0}
            value={entryForm.priority ?? 0}
            onChange={(e) => setEntryForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))}
            style={inputStyle}
          />
        </FieldGroup>
        <FieldGroup label="Active">
          <input
            type="checkbox"
            checked={entryForm.is_active ?? true}
            onChange={(e) => setEntryForm((f) => ({ ...f, is_active: e.target.checked }))}
            style={{ marginRight: 8 }}
          />
          <span style={{ fontSize: 13, color: theme.textSecondary }}>Visible to AI</span>
        </FieldGroup>
      </FormModal>
    </PageShell>
  );
}
