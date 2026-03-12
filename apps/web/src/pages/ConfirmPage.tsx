import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupabase } from '../lib/supabase'
import { getBaseUrl } from '../lib/api'
import { useI18n } from '../i18n/I18nProvider'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

const SESSION_POLL_MS = 250
const SESSION_POLL_MAX_ATTEMPTS = 16

/**
 * Handles redirect from Supabase email confirmation link.
 * URL is /auth/confirm#access_token=...&refresh_token=...&type=signup
 * Waits for session from hash, calls POST /api/onboard/merchant (role + trial), refreshes auth, then redirects.
 */
export default function ConfirmPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState<string>('')
  const doneRef = useRef(false)

  useEffect(() => {
    if (doneRef.current) return
    const supabase = getSupabase()
    if (!supabase) {
      setStatus('error')
      setMessage('Auth not configured')
      return
    }

    const runOnboardAndRedirect = async (session: { access_token: string }) => {
      const token = session.access_token
      const base = getBaseUrl()
      const res = await fetch(`${base}/onboard/merchant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (data.ok || data.alreadyOnboarded) {
        await refreshUser()
        toast.success(t('confirm.confirmSuccessToast'))
        doneRef.current = true
        setStatus('success')
        navigate('/merchant/dashboard', { replace: true })
      } else {
        setStatus('error')
        setMessage((data as { error?: string }).error ?? 'Onboard failed')
      }
    }

    const run = async (session: { access_token: string } | null) => {
      if (!session?.access_token) {
        setStatus('error')
        setMessage(t('confirm.invalidOrExpiredLink'))
        return
      }
      try {
        await runOnboardAndRedirect(session)
      } catch {
        setStatus('error')
        setMessage('Request failed')
      }
    }

    const hash = window.location.hash
    const hasHash = hash && (hash.includes('access_token') || hash.includes('token_hash'))

    const tryGetSession = (attempt: number) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          run(session)
          return
        }
        if (hasHash && attempt < SESSION_POLL_MAX_ATTEMPTS) {
          setTimeout(() => tryGetSession(attempt + 1), SESSION_POLL_MS)
        } else if (!hasHash) {
          run(null)
        } else {
          setStatus('error')
          setMessage(t('confirm.invalidOrExpiredLink'))
        }
      })
    }

    tryGetSession(0)
  }, [navigate, t, refreshUser])

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--armai-bg)] p-4">
        <div className="w-full max-w-[400px] rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] shadow-xl p-8 text-center">
          <p className="text-[var(--armai-text)] font-medium mb-2">
            {t('confirm.invalidOrExpiredLink')}
          </p>
          <p className="text-sm text-[var(--armai-text-muted)] mb-4">{message}</p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="py-2 px-4 rounded-lg bg-[var(--armai-primary)] text-white font-medium"
          >
            {t('login.signIn')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--armai-bg)] p-4">
      <div className="text-center">
        <p className="text-[var(--armai-text-secondary)]">{t('common.loading')}</p>
        <p className="text-sm text-[var(--armai-text-muted)] mt-2">ກຳລັງຢືນຢັນ ແລະ ເລີ່ມໃຊ້ງານ…</p>
      </div>
    </div>
  )
}
