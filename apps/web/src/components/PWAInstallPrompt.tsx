import { useState, useEffect } from 'react'
import { toast } from 'sonner'

/**
 * Listens for beforeinstallprompt and shows an install toast.
 * Optional: use registerSW from 'virtual:pwa-register' for update prompts when using registerType: 'prompt'.
 */
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (!deferredPrompt || dismissed) return
    const key = 'armai.pwa.install.dismissed'
    if (typeof localStorage !== 'undefined' && localStorage.getItem(key)) return
    const t = toast.info('Install ArmAI for a better experience', {
      duration: 8000,
      action: {
        label: 'Install',
        onClick: async () => {
          if (!deferredPrompt) return
          const { outcome } = await deferredPrompt.prompt()
          if (outcome === 'accepted') toast.success('App installed')
          setDeferredPrompt(null)
        },
      },
      onDismiss: () => {
        setDismissed(true)
        try {
          localStorage.setItem(key, '1')
        } catch {
          /* ignore */
        }
      },
    })
    return () => {
      toast.dismiss(t)
    }
  }, [deferredPrompt, dismissed])

  return null
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
}
