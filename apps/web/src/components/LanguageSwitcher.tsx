import { useI18n } from '../i18n/I18nProvider'
import type { Locale } from '../i18n/locales'
import { LOCALES } from '../i18n/locales'
import { Globe } from 'lucide-react'

const LOCALE_LABELS: Record<Locale, string> = {
  lo: '🇱🇦 ລາວ',
  en: '🇺🇸 English',
  th: '🇹🇭 ไทย',
}

export function LanguageSwitcher({
  inDropdown,
  onSelect,
}: {
  inDropdown?: boolean
  onSelect?: () => void
}) {
  const { locale, setLocale, t } = useI18n()

  const handleChange = (l: Locale) => {
    setLocale(l)
    onSelect?.()
  }

  if (inDropdown) {
    return (
      <div className="py-1 border-b border-[var(--armai-border-muted)]">
        <div className="px-3 py-1.5 text-xs font-medium text-[var(--armai-text-muted)]">
          {t('nav.settings')} / Language
        </div>
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => handleChange(l)}
            className={`block w-full text-left px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--armai-primary)] ${
              locale === l
                ? 'bg-primary/10 text-[var(--armai-primary)] font-medium'
                : 'text-[var(--armai-text)] hover:bg-[var(--armai-surface)]'
            }`}
          >
            {LOCALE_LABELS[l]}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="relative flex items-center gap-1 rounded-lg border border-[var(--armai-border-muted)] bg-[var(--armai-surface-elevated)] p-1">
      <Globe className="h-4 w-4 text-[var(--armai-text-muted)]" aria-hidden />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => handleChange(l)}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)] ${
            locale === l
              ? 'bg-[var(--armai-primary)] text-white'
              : 'text-[var(--armai-text-secondary)] hover:text-[var(--armai-text)]'
          }`}
        >
          {l === 'lo' ? 'LA' : l === 'th' ? 'TH' : 'EN'}
        </button>
      ))}
    </div>
  )
}
