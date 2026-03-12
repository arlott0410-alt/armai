import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useI18n } from '../i18n/I18nProvider'
import { deriveLocaleFromMerchant } from '../i18n/locales'
import { merchantApi } from '../lib/api'
import { useEffect } from 'react'

export default function MerchantLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { t, setLocale } = useI18n()
  const { theme, toggleDark } = useTheme()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const token = user?.accessToken ?? null

  useEffect(() => {
    if (!token) return
    merchantApi
      .dashboard(token)
      .then((r) => {
        const l = deriveLocaleFromMerchant(r.merchant ?? null)
        setLocale(l)
      })
      .catch(() => {})
  }, [token, setLocale])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
    setMenuOpen(false)
  }

  const navItemClass =
    'block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ' +
    'text-[var(--armai-text-secondary)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-text)] ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--armai-surface)]'
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    navItemClass +
    (isActive
      ? ' bg-primary/10 text-[var(--armai-primary)] border-l-4 border-l-[var(--armai-primary)]'
      : '')

  return (
    <div
      className="flex min-h-screen bg-[var(--armai-bg)]"
      role="application"
      aria-label="Merchant workspace"
    >
      <a href="#main-content" className="skip-link">
        {t('nav.dashboard')}
      </a>

      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-[var(--armai-border-muted)] bg-[var(--armai-surface)] transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[64px]' : 'w-60'
        }`}
        role="navigation"
        aria-label={t('nav.dashboard')}
      >
        <div className="flex h-14 items-center justify-between px-3 border-b border-[var(--armai-border-muted)]">
          {!sidebarCollapsed && (
            <span className="text-lg font-bold text-[var(--armai-text)] tracking-tight">ArmAI</span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="p-2 rounded-lg text-[var(--armai-text-muted)] hover:bg-[var(--armai-surface-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1" role="menubar">
          <NavLink to="/merchant/dashboard" className={navLinkClass} role="menuitem" end>
            {!sidebarCollapsed && t('nav.overview')}
            {sidebarCollapsed && '⌂'}
          </NavLink>
          <NavLink to="/merchant/orders" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.orders')}
            {sidebarCollapsed && '📋'}
          </NavLink>
          <NavLink to="/merchant/products" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.products')}
          </NavLink>
          <NavLink to="/merchant/categories" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.categories')}
          </NavLink>
          <NavLink to="/merchant/knowledge" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.knowledge')}
          </NavLink>
          <NavLink to="/merchant/promotions" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.promotions')}
          </NavLink>
          <NavLink to="/merchant/payment-accounts" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.paymentAccounts')}
          </NavLink>
          <NavLink to="/merchant/bank-sync" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.bankSync')}
          </NavLink>
          <NavLink to="/merchant/operations" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.operations')}
          </NavLink>
          <NavLink to="/merchant/telegram" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.telegram')}
          </NavLink>
          <NavLink to="/merchant/channels" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.messaging')}
          </NavLink>
          <NavLink to="/merchant/customers" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.customers')}
          </NavLink>
          <NavLink to="/merchant/settings" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.settings')}
          </NavLink>
          <NavLink to="/pricing" className={navLinkClass} role="menuitem">
            {!sidebarCollapsed && t('nav.plans')}
          </NavLink>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top navbar */}
        <header
          className="h-14 flex items-center justify-between gap-4 px-4 md:px-6 border-b border-[var(--armai-border-muted)] bg-[var(--armai-surface)]"
          role="banner"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <input
              type="search"
              placeholder={t('nav.dashboard') + '...'}
              className="hidden md:block max-w-xs px-3 py-1.5 text-sm rounded-md"
              aria-label="Search"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDark}
              className="p-2 rounded-lg text-[var(--armai-text-muted)] hover:bg-[var(--armai-surface-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀' : '🌙'}
            </button>
            <span
              className="p-2 rounded-lg text-[var(--armai-text-muted)] cursor-default"
              aria-label="Notifications"
            >
              🔔
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--armai-surface-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label="User menu"
              >
                <span className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-[var(--armai-primary)]">
                  {(user?.email ?? '?').slice(0, 1).toUpperCase()}
                </span>
                {user?.email && (
                  <span className="hidden sm:block text-sm text-[var(--armai-text-secondary)] truncate max-w-[120px]">
                    {user.email}
                  </span>
                )}
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden="true"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 py-1 w-56 rounded-lg border border-[var(--armai-border)] bg-[var(--armai-surface-elevated)] shadow-lg z-20"
                  >
                    <div className="px-3 py-2 border-b border-[var(--armai-border-muted)] text-sm text-[var(--armai-text-muted)]">
                      {user?.email}
                    </div>
                    <NavLink
                      to="/merchant/settings"
                      className="block px-3 py-2 text-sm text-[var(--armai-text)] hover:bg-[var(--armai-surface)]"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t('nav.settings')}
                    </NavLink>
                    <NavLink
                      to="/pricing"
                      className="block px-3 py-2 text-sm text-[var(--armai-text)] hover:bg-[var(--armai-surface)]"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t('nav.plans')}
                    </NavLink>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full text-left px-3 py-2 text-sm text-[var(--armai-text)] hover:bg-[var(--armai-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--armai-primary)]"
                      role="menuitem"
                    >
                      {t('action.logout')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="flex-1 p-4 md:p-6 overflow-auto"
          role="main"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
