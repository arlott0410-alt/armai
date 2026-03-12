import { useI18n } from '../../i18n/I18nProvider'
import { BarChart3, Settings, Sparkles } from 'lucide-react'

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  analytics: BarChart3,
  settings: Settings,
  'ai-tools': Sparkles,
}

export default function AdminPlaceholder({ page }: { page: string }) {
  const { t } = useI18n()
  const key = `admin.${page}` as keyof typeof t
  const label = typeof key === 'string' ? (t as (k: string) => string)(key) : page
  const Icon = icons[page] ?? BarChart3

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <div className="p-4 rounded-full bg-[var(--armai-surface-elevated)]">
        <Icon className="h-12 w-12 text-[var(--armai-text-muted)]" />
      </div>
      <h2 className="text-xl font-semibold text-[var(--armai-text)]">{label}</h2>
      <p className="text-[var(--armai-text-muted)] max-w-md">Coming soon.</p>
    </div>
  )
}
