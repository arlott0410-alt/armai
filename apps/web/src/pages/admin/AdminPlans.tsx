import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../i18n/I18nProvider'
import { superApi, type AdminPlanRow } from '../../lib/api'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const LAK_FORMAT = new Intl.NumberFormat('lo-LA', { maximumFractionDigits: 0 })

export default function AdminPlans() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [plans, setPlans] = useState<AdminPlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AdminPlanRow | null>(null)
  const [creating, setCreating] = useState(false)
  const token = user?.accessToken ?? null

  const load = () => {
    if (!token) return
    superApi
      .plans(token)
      .then((r) => setPlans(r.plans))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [token])

  const handleDelete = async (id: string) => {
    if (!token || !confirm(t('common.cancel') + '? Delete plan?')) return
    try {
      await superApi.deletePlan(token, id)
      toast.success('Plan deleted')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-[var(--armai-surface-elevated)] rounded animate-pulse" />
        <div className="h-64 bg-[var(--armai-surface-elevated)] rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--armai-text)]">{t('admin.plans')}</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--armai-primary)] text-white font-medium hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
        >
          <Plus className="h-4 w-4" />
          Add plan
        </button>
      </div>

      <div className="rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] overflow-hidden glass-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--armai-border-muted)] bg-[var(--armai-surface-elevated)]">
              <th className="text-left px-4 py-3 font-medium text-[var(--armai-text)]">Name</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--armai-text)]">Code</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--armai-text)]">
                Price (LAK)
              </th>
              <th className="text-left px-4 py-3 font-medium text-[var(--armai-text)]">
                Max users
              </th>
              <th className="text-left px-4 py-3 font-medium text-[var(--armai-text)]">Active</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr
                key={plan.id}
                className="border-b border-[var(--armai-border-muted)] hover:bg-[var(--armai-surface-elevated)]/50"
              >
                <td className="px-4 py-3 text-[var(--armai-text)]">{plan.name}</td>
                <td className="px-4 py-3 text-[var(--armai-text-secondary)]">{plan.code}</td>
                <td className="px-4 py-3 text-right font-medium text-[var(--armai-text)]">
                  ₭{LAK_FORMAT.format(plan.price_lak)}
                </td>
                <td className="px-4 py-3 text-[var(--armai-text-secondary)]">
                  {plan.max_users ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      plan.active
                        ? 'bg-green-500/20 text-green-600'
                        : 'bg-[var(--armai-text-muted)]/20 text-[var(--armai-text-muted)]'
                    }`}
                  >
                    {plan.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(plan)}
                    className="p-1.5 rounded text-[var(--armai-text-muted)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-primary)]"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(plan.id)}
                    className="p-1.5 rounded text-[var(--armai-text-muted)] hover:bg-red-500/10 hover:text-red-500"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <PlanFormModal
          plan={editing ?? undefined}
          token={token!}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
          onSaved={() => {
            load()
            setEditing(null)
            setCreating(false)
            toast.success(editing ? 'Plan updated' : 'Plan created')
          }}
        />
      )}
    </motion.div>
  )
}

function PlanFormModal({
  plan,
  token,
  onClose,
  onSaved,
}: {
  plan?: AdminPlanRow
  token: string
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState(plan?.name ?? '')
  const [code, setCode] = useState(plan?.code ?? '')
  const [priceLak, setPriceLak] = useState(plan?.price_lak?.toString() ?? '')
  const [features, setFeatures] = useState(plan?.features?.join('\n') ?? '')
  const [maxUsers, setMaxUsers] = useState(plan?.max_users?.toString() ?? '')
  const [active, setActive] = useState(plan?.active ?? true)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const price = parseInt(priceLak, 10)
      const max = maxUsers.trim() ? parseInt(maxUsers, 10) : null
      const featureList = features
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      if (plan) {
        await superApi.updatePlan(token, plan.id, {
          name,
          code,
          price_lak: price,
          features: featureList,
          max_users: max,
          active,
        })
      } else {
        await superApi.createPlan(token, {
          name,
          code,
          price_lak: price,
          features: featureList,
          max_users: max,
          active,
        })
      }
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] shadow-xl p-6"
      >
        <h2 className="text-lg font-semibold text-[var(--armai-text)] mb-4">
          {plan ? 'Edit plan' : 'New plan'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--armai-text-secondary)] mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--armai-border)] bg-[var(--armai-bg)] text-[var(--armai-text)]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--armai-text-secondary)] mb-1">
              Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--armai-border)] bg-[var(--armai-bg)] text-[var(--armai-text)]"
              placeholder="basic"
              required
              disabled={!!plan}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--armai-text-secondary)] mb-1">
              Price (LAK)
            </label>
            <input
              type="number"
              min={0}
              value={priceLak}
              onChange={(e) => setPriceLak(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--armai-border)] bg-[var(--armai-bg)] text-[var(--armai-text)]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--armai-text-secondary)] mb-1">
              Features (one per line)
            </label>
            <textarea
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-[var(--armai-border)] bg-[var(--armai-bg)] text-[var(--armai-text)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--armai-text-secondary)] mb-1">
              Max users (empty = unlimited)
            </label>
            <input
              type="number"
              min={0}
              value={maxUsers}
              onChange={(e) => setMaxUsers(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--armai-border)] bg-[var(--armai-bg)] text-[var(--armai-text)]"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-[var(--armai-border)]"
            />
            <span className="text-sm text-[var(--armai-text)]">Active</span>
          </label>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-[var(--armai-border)] text-[var(--armai-text)] hover:bg-[var(--armai-surface-elevated)]"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[var(--armai-primary)] text-white font-medium disabled:opacity-50"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
