import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { whatsappChannelApi } from '../../lib/api'
import { PageShell } from '../../components/ui'
import { useI18n } from '../../i18n/I18nProvider'
import { toast } from 'sonner'

export default function WhatsAppCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { t } = useI18n()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setStatus('error')
      setMessage(searchParams.get('error_description') || 'Authorization was cancelled or denied.')
      return
    }

    if (!code || !user?.accessToken) {
      if (!user?.accessToken) {
        setStatus('error')
        setMessage('Please sign in to connect WhatsApp.')
      } else {
        setStatus('error')
        setMessage('Missing authorization code. Try connecting again.')
      }
      return
    }

    const redirectUri = `${window.location.origin}/merchant/channels/whatsapp/callback`
    whatsappChannelApi
      .connect(user.accessToken, { code, redirect_uri: redirectUri })
      .then((res) => {
        setStatus('success')
        setMessage(
          res.display_phone_number
            ? `Connected to ${res.display_phone_number}`
            : 'WhatsApp connected.'
        )
        toast.success('WhatsApp connected. You can now receive messages and AI auto-replies.')
        navigate('/merchant/channels', { replace: true })
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to connect WhatsApp'
        setStatus('error')
        setMessage(msg)
        toast.error(msg)
      })
  }, [searchParams, user?.accessToken, navigate])

  return (
    <PageShell title="WhatsApp connect" description="Connecting your WhatsApp Business account">
      <div className="max-w-md mx-auto py-12 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-pulse rounded-full bg-[var(--armai-surface-elevated)] h-14 w-14 mx-auto mb-4 border border-[var(--armai-border)]" />
            <p className="text-[var(--armai-text-secondary)]">{t('common.loading')}</p>
          </>
        )}
        {status === 'success' && (
          <p className="text-[var(--armai-success)]">{message ?? 'Connected.'}</p>
        )}
        {status === 'error' && (
          <>
            <p className="text-[var(--armai-danger)] mb-4">{message}</p>
            <button
              type="button"
              onClick={() => navigate('/merchant/channels')}
              className="rounded-lg border border-[var(--armai-border)] px-4 py-2 text-[var(--armai-text)]"
            >
              Back to Channels
            </button>
          </>
        )}
      </div>
    </PageShell>
  )
}
