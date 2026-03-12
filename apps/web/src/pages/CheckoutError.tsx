import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'

export default function CheckoutError() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--armai-bg)] p-4">
      <div className="max-w-md w-full rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center text-2xl mx-auto mb-4">
          ✕
        </div>
        <h1 className="text-xl font-semibold text-[var(--armai-text)] mb-2">{t('common.error')}</h1>
        <p className="text-[var(--armai-text-secondary)] mb-6">
          ການຊຳລະເງິນບໍ່ສຳເລັດ. ກະລຸນາລອງໃໝ່ ຫຼືຕິດຕໍ່ພວກເຮົາ.
        </p>
        <Link
          to="/pricing"
          className="inline-block py-2.5 px-5 rounded-lg font-medium bg-[var(--armai-primary)] text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
        >
          {t('nav.plans')}
        </Link>
      </div>
    </div>
  )
}
