import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { I18nProvider } from './i18n/I18nProvider'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'
import './index.css'

// Register service worker (autoUpdate: reload when new content available)
registerSW({ immediate: true })

function OfflineToast() {
  useEffect(() => {
    const onOffline = () =>
      toast.warning('You are offline. Some features may be limited.', { duration: 5000 })
    const onOnline = () => toast.success('Back online')
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    if (!navigator.onLine) onOffline()
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])
  return null
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <I18nProvider>
            <App />
            <PWAInstallPrompt />
            <OfflineToast />
            <Toaster richColors position="top-right" closeButton />
          </I18nProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
