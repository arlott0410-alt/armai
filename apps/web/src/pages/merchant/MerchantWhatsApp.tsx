import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { channelsApi, whatsappChannelApi, whatsappApi } from '../../lib/api'
import type { ChannelsSummaryResponse } from '../../lib/api'
import { Card, CardBody } from '../../components/ui'
import { MessageCircle } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { toast } from 'sonner'

const META_OAUTH_SCOPE =
  'business_management,whatsapp_business_management,whatsapp_business_messaging'

type WaConnection = {
  id: string
  phone_number_id: string
  business_account_name: string | null
  display_phone_number: string | null
  is_active: boolean
}

export default function MerchantWhatsApp() {
  const { t } = useI18n()
  const { user } = useAuth()
  const token = user?.accessToken ?? null
  const appId =
    (import.meta as unknown as { env?: { VITE_META_APP_ID?: string } }).env?.VITE_META_APP_ID ?? ''

  const [summary, setSummary] = useState<ChannelsSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const load = useCallback(() => {
    if (!token) return
    channelsApi
      .summary(token)
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const handleConnect = () => {
    if (!appId) {
      toast.error('WhatsApp app not configured (VITE_META_APP_ID)')
      return
    }
    const redirectUri = `${window.location.origin}/merchant/channels/whatsapp/callback`
    const url = new URL('https://www.facebook.com/v18.0/dialog/oauth')
    url.searchParams.set('client_id', appId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', META_OAUTH_SCOPE)
    url.searchParams.set('response_type', 'code')
    window.location.href = url.toString()
  }

  const handleDisconnect = async (conn: WaConnection) => {
    if (!token) return
    setDisconnectingId(conn.id)
    try {
      await whatsappChannelApi.disconnect(token, conn.id)
      toast.success('Disconnected')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to disconnect')
    } finally {
      setDisconnectingId(null)
    }
  }

  const handleTest = async () => {
    if (!token) return
    setTesting(true)
    try {
      const res = await whatsappApi.test(token)
      toast.success(
        res.message ?? 'Connection verified. Send a message from WhatsApp to test AI reply.'
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  const connections: WaConnection[] = summary?.whatsapp?.connections ?? []

  if (error) {
    return (
      <Card className="mt-4 border border-[var(--armai-border)] shadow-gold">
        <CardBody>
          <p className="text-sm text-[var(--armai-danger)]">{error}</p>
        </CardBody>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="mt-4 border border-[var(--armai-border)] shadow-gold">
        <CardBody>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-pulse rounded-full bg-[var(--armai-surface-elevated)] h-14 w-14 mb-4 border border-[var(--armai-border)]" />
            <p className="text-sm text-[var(--armai-text-muted)]">{t('common.loading')}</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card className="mt-4 border border-[var(--armai-border)] shadow-gold">
      <CardBody>
        <div className="flex flex-col items-center justify-center py-8">
          <div className="rounded-full bg-[var(--armai-surface-elevated)] p-4 mb-4 border border-[var(--armai-border)]">
            <MessageCircle className="h-10 w-10 text-[var(--armai-text-muted)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--armai-text)] mb-2">
            {t('tabs.whatsapp')}
          </h3>
          <p className="text-sm text-[var(--armai-text-secondary)] max-w-md mb-6 text-center">
            {t('channels.whatsapp.description')}. Connect your WhatsApp Business account to enable
            AI auto-replies.
          </p>

          {connections.length > 0 ? (
            <div className="w-full max-w-md space-y-4">
              <p className="text-xs text-[var(--armai-text-muted)] uppercase tracking-wide">
                Connected
              </p>
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between gap-4 py-3 px-4 rounded-lg bg-[var(--armai-surface-elevated)] border border-[var(--armai-border)]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: conn.is_active
                          ? 'var(--armai-success)'
                          : 'var(--armai-text-muted)',
                      }}
                      aria-hidden
                    />
                    <span className="text-sm font-medium text-[var(--armai-text)]">
                      {conn.display_phone_number ||
                        conn.business_account_name ||
                        conn.phone_number_id}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(conn)}
                    disabled={disconnectingId === conn.id}
                    className="text-xs px-2 py-1 rounded border border-[var(--armai-border)] text-[var(--armai-text-secondary)] hover:bg-[var(--armai-surface)] disabled:opacity-50"
                  >
                    {disconnectingId === conn.id ? t('common.loading') : 'Disconnect'}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="text-sm px-4 py-2 rounded-lg border border-[var(--armai-border)] text-[var(--armai-text)] hover:bg-[var(--armai-surface-elevated)] disabled:opacity-50"
              >
                {testing ? t('common.loading') : 'Test connection'}
              </button>
              <button
                type="button"
                onClick={handleConnect}
                className="text-sm px-4 py-2 rounded-lg border border-[var(--armai-border)] text-[var(--armai-text)] hover:bg-[var(--armai-surface-elevated)]"
              >
                Connect another number
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={!appId}
              className="px-6 py-3 rounded-lg font-medium text-[var(--armai-bg)] bg-[var(--armai-primary)] hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              Connect WhatsApp
            </button>
          )}

          <p className="text-xs text-[var(--armai-text-muted)] mt-6 max-w-md text-center">
            Set your webhook URL in Meta for Developers (WhatsApp → Configuration) to your ArmAI
            webhook. Use the same verify token as in Settings.
          </p>
        </div>
      </CardBody>
    </Card>
  )
}
