import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  channelsApi,
  facebookChannelApi,
  type ChannelsSummaryResponse,
  type FacebookPageRow,
} from '../../lib/api'
import { Card, CardBody } from '../../components/ui'
import { FormModal } from '../../components/merchant/FormModal'
import { Facebook } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { theme } from '../../theme'
import { toast } from 'sonner'

declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void
      login: (
        callback: (res: { authResponse?: { accessToken: string }; status?: string }) => void,
        opts: { scope: string }
      ) => void
      getLoginStatus: (callback: (res: { status: string }) => void) => void
    }
    fbAsyncInit?: () => void
  }
}

const FB_SCOPE = 'pages_messaging,pages_show_list,pages_manage_metadata'

function loadFbSdk(appId: string): Promise<void> {
  if (window.FB) return Promise.resolve()
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      if (!window.FB) return reject(new Error('FB not defined'))
      window.FB.init({
        appId,
        cookie: false,
        xfbml: false,
        version: 'v18.0',
      })
      resolve()
    }
    const script = document.createElement('script')
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'))
    document.head.appendChild(script)
  })
}

export default function MerchantFacebook() {
  const { t } = useI18n()
  const { user } = useAuth()
  const token = user?.accessToken ?? null
  const appId =
    (import.meta as unknown as { env?: { VITE_FACEBOOK_APP_ID?: string } }).env
      ?.VITE_FACEBOOK_APP_ID ?? ''

  const [summary, setSummary] = useState<ChannelsSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [pagePickerOpen, setPagePickerOpen] = useState(false)
  const [pagesFromConnect, setPagesFromConnect] = useState<
    Array<{ id: string; name: string; access_token: string | null }>
  >([])
  const [storingPageId, setStoringPageId] = useState<string | null>(null)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)

  const loadSummary = useCallback(() => {
    if (!token) return
    channelsApi
      .summary(token)
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const handleConnectClick = async () => {
    if (!token || !appId) {
      if (!appId) toast.error('Facebook App ID not configured (VITE_FACEBOOK_APP_ID)')
      else toast.error('Please sign in to connect Facebook.')
      return
    }
    setError(null)
    setConnecting(true)
    try {
      await loadFbSdk(appId)
      if (!window.FB) {
        toast.error('Facebook SDK failed to load')
        return
      }
      window.FB.login(
        (res) => {
          setConnecting(false)
          if (res.authResponse?.accessToken) {
            facebookChannelApi
              .connect(token, { access_token: res.authResponse.accessToken })
              .then((data) => {
                if (data.pages.length === 0) {
                  toast.error(
                    'No Facebook Pages found. Add a Page you manage in Meta Business Suite.'
                  )
                  return
                }
                setPagesFromConnect(data.pages)
                setPagePickerOpen(true)
              })
              .catch((e) => {
                toast.error(e.message ?? 'Failed to get Pages')
              })
          } else {
            if (res.status !== 'unknown') toast.error('Facebook login was cancelled or failed.')
          }
        },
        { scope: FB_SCOPE }
      )
    } catch (e) {
      setConnecting(false)
      const msg = e instanceof Error ? e.message : 'Failed to load Facebook'
      toast.error(msg)
    }
  }

  const handleSelectPage = async (page: {
    id: string
    name: string
    access_token: string | null
  }) => {
    if (!token || !page.access_token) {
      toast.error('This Page does not have an access token. Try another Page.')
      return
    }
    setStoringPageId(page.id)
    try {
      await facebookChannelApi.storePage(token, {
        page_id: page.id,
        page_name: page.name,
        page_access_token: page.access_token,
      })
      toast.success(`Connected "${page.name}"`)
      setPagePickerOpen(false)
      setPagesFromConnect([])
      loadSummary()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save Page')
    } finally {
      setStoringPageId(null)
    }
  }

  const handleDisconnect = async (row: FacebookPageRow) => {
    if (!token) return
    setDisconnectingId(row.id)
    try {
      await facebookChannelApi.disconnectPage(token, row.id)
      toast.success('Page disconnected')
      loadSummary()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to disconnect')
    } finally {
      setDisconnectingId(null)
    }
  }

  const facebookPages = summary?.facebook?.pages ?? []

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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="animate-pulse rounded-full bg-[var(--armai-surface-elevated)] h-14 w-14 mb-4 border border-[var(--armai-border)]" />
            <p className="text-sm text-[var(--armai-text-muted)]">Loading…</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <>
      <Card className="mt-4 border border-[var(--armai-border)] shadow-gold">
        <CardBody>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-[var(--armai-surface-elevated)] p-4 mb-4 border border-[var(--armai-border)]">
              <Facebook className="h-10 w-10 text-[var(--armai-text-muted)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--armai-text)] mb-2">
              {t('tabs.facebook')}
            </h3>
            <p className="text-sm text-[var(--armai-text-secondary)] max-w-md mb-6">
              {t('channels.facebook.description')}. Connect your Facebook Page to receive and reply
              to messages here.
            </p>

            {facebookPages.length > 0 ? (
              <div className="w-full max-w-md text-left space-y-4">
                <p className="text-xs text-[var(--armai-text-muted)] uppercase tracking-wide">
                  Connected Pages
                </p>
                <ul className="space-y-2">
                  {facebookPages.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-[var(--armai-surface-elevated)] border border-[var(--armai-border)]"
                    >
                      <span className="text-sm font-medium text-[var(--armai-text)] truncate">
                        {p.page_name || p.page_id}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-xs text-[var(--armai-success)]"
                          style={{ color: theme.success }}
                        >
                          Connected
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDisconnect(p)}
                          disabled={disconnectingId === p.id}
                          className="text-xs px-2 py-1 rounded border border-[var(--armai-border)] text-[var(--armai-text-secondary)] hover:bg-[var(--armai-surface)] disabled:opacity-50"
                        >
                          {disconnectingId === p.id ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={handleConnectClick}
                  disabled={connecting}
                  className="text-sm px-4 py-2 rounded-lg border border-[var(--armai-border)] text-[var(--armai-text)] hover:bg-[var(--armai-surface-elevated)] disabled:opacity-50"
                >
                  {connecting ? 'Connecting…' : 'Connect another Page'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectClick}
                disabled={connecting}
                className="px-6 py-3 rounded-lg font-medium text-[var(--armai-bg)] bg-[var(--armai-primary)] hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {connecting ? 'Opening Facebook…' : 'Connect Facebook'}
              </button>
            )}

            <p className="text-xs text-[var(--armai-text-muted)] mt-6 max-w-md">
              Set your Messenger webhook URL in Meta for Developers to receive messages. Use the
              same verify token as in ArmAI settings.
            </p>
          </div>
        </CardBody>
      </Card>

      <FormModal
        open={pagePickerOpen}
        onClose={() => {
          setPagePickerOpen(false)
          setPagesFromConnect([])
        }}
        title="Select a Page to connect"
        footer={
          <button
            type="button"
            onClick={() => {
              setPagePickerOpen(false)
              setPagesFromConnect([])
            }}
            className="px-3 py-1.5 rounded border border-[var(--armai-border)] text-[var(--armai-text)]"
          >
            Cancel
          </button>
        }
      >
        <ul className="space-y-2">
          {pagesFromConnect.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => handleSelectPage(p)}
                disabled={!p.access_token || storingPageId !== null}
                className="w-full text-left py-3 px-3 rounded-lg border border-[var(--armai-border)] hover:bg-[var(--armai-surface-elevated)] disabled:opacity-50 flex justify-between items-center"
              >
                <span className="font-medium text-[var(--armai-text)]">{p.name}</span>
                {storingPageId === p.id ? (
                  <span className="text-xs text-[var(--armai-text-muted)]">Saving…</span>
                ) : (
                  <span className="text-xs text-[var(--armai-primary)]">Connect</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {pagesFromConnect.some((p) => !p.access_token) && (
          <p className="text-xs text-[var(--armai-text-muted)] mt-2">
            Some Pages could not be used (missing token). Choose a Page with Connect.
          </p>
        )}
      </FormModal>
    </>
  )
}
