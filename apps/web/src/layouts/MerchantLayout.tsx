import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  FolderTree,
  BookOpen,
  Tag,
  CreditCard,
  RefreshCw,
  Activity,
  Send,
  MessageCircle,
  Users,
  Settings,
  CreditCard as PlanIcon,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Bell,
  Menu,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useI18n } from '../i18n/I18nProvider'
import { deriveLocaleFromMerchant } from '../i18n/locales'
import { merchantApi } from '../lib/api'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { MobileDrawer } from '../components/MobileDrawer'
import { useMediaQuery } from '../hooks/useMediaQuery'

const SIDEBAR_WIDTH = 240

const merchantNavItems = [
  { to: '/merchant/dashboard', label: 'nav.overview', icon: LayoutDashboard, end: true },
  { to: '/merchant/orders', label: 'nav.orders', icon: Activity, end: false },
  { to: '/merchant/products', label: 'nav.products', icon: Package, end: false },
  { to: '/merchant/categories', label: 'nav.categories', icon: FolderTree, end: false },
  { to: '/merchant/knowledge', label: 'nav.knowledge', icon: BookOpen, end: false },
  { to: '/merchant/promotions', label: 'nav.promotions', icon: Tag, end: false },
  { to: '/merchant/payment-accounts', label: 'nav.paymentAccounts', icon: CreditCard, end: false },
  { to: '/merchant/bank-sync', label: 'nav.bankSync', icon: RefreshCw, end: false },
  { to: '/merchant/operations', label: 'nav.operations', icon: Activity, end: false },
  { to: '/merchant/telegram', label: 'nav.telegram', icon: Send, end: false },
  { to: '/merchant/channels', label: 'nav.messaging', icon: MessageCircle, end: false },
  { to: '/merchant/customers', label: 'nav.customers', icon: Users, end: false },
  { to: '/merchant/settings', label: 'nav.settings', icon: Settings, end: false },
  { to: '/pricing', label: 'nav.plans', icon: PlanIcon, end: false },
] as const

export default function MerchantLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { t, setLocale } = useI18n()
  const { theme, toggleDark } = useTheme()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const token = user?.accessToken ?? null

  useEffect(() => {
    const saved = localStorage.getItem('armai.locale')
    if (saved === 'lo' || saved === 'th' || saved === 'en') return
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
    'flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ' +
    'text-[var(--armai-text-secondary)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-text)] ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--armai-surface)]'
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    navItemClass +
    (isActive
      ? ' bg-[var(--armai-primary)]/10 text-[var(--armai-primary)] border-l-4 border-l-[var(--armai-primary)] shadow-gold'
      : '')

  const renderNavLinks = (showLabels: boolean) =>
    merchantNavItems.map(({ to, label, icon: Icon, end }) => (
      <NavLink
        key={to}
        to={to}
        className={navLinkClass}
        role="menuitem"
        end={end}
        onClick={() => setDrawerOpen(false)}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {showLabels && t(label)}
      </NavLink>
    ))

  return (
    <div
      className="flex min-h-screen bg-[var(--armai-bg)] velvet-bg"
      role="application"
      aria-label="Merchant workspace"
    >
      <a href="#main-content" className="skip-link">
        {t('nav.dashboard')}
      </a>

      {/* Desktop: fixed/collapsible sidebar */}
      {isDesktop && (
        <aside
          style={{ width: sidebarCollapsed ? 72 : SIDEBAR_WIDTH }}
          className="flex flex-col flex-shrink-0 border-r border-[var(--armai-border)] bg-[var(--armai-surface)] transition-all duration-300"
          role="navigation"
          aria-label={t('nav.dashboard')}
        >
          <div className="flex h-14 items-center justify-between px-3 border-b border-[var(--armai-border-muted)]">
            {!sidebarCollapsed && (
              <span className="text-lg font-bold text-[var(--armai-text)] tracking-tight">
                ArmAI
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-2 rounded-lg text-[var(--armai-text-muted)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1" role="menubar">
            {renderNavLinks(!sidebarCollapsed)}
          </nav>
        </aside>
      )}

      {/* Mobile: bottom drawer */}
      {!isDesktop && (
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={t('nav.dashboard')}
          aria-label={t('nav.dashboard')}
        >
          <div className="flex flex-col gap-0.5">{renderNavLinks(true)}</div>
        </MobileDrawer>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-14 flex items-center justify-between gap-4 px-4 md:px-6 border-b border-[var(--armai-border)] bg-[var(--armai-surface)]"
          role="banner"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {!isDesktop && (
              <button
                type="button"
                className="p-2 rounded-lg text-[var(--armai-text-muted)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                aria-expanded={drawerOpen}
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <input
              type="search"
              placeholder={t('nav.dashboard') + '...'}
              className="hidden md:block max-w-xs px-3 py-1.5 text-sm rounded-md border border-[var(--armai-border)] bg-[var(--armai-surface-elevated)]"
              aria-label="Search"
            />
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher inDropdown={false} />
            <button
              type="button"
              onClick={toggleDark}
              className="p-2 rounded-lg text-[var(--armai-text-muted)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-primary)] hover:shadow-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)] transition-all duration-300"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <span
              className="p-2 rounded-lg text-[var(--armai-text-muted)] cursor-default"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--armai-surface-elevated)] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)] transition-shadow"
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label="User menu"
              >
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--armai-gradient-start)] to-[var(--armai-gradient-end)] flex items-center justify-center text-sm font-semibold text-white shadow">
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
                    className="absolute right-0 top-full mt-1 py-1 w-56 rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface-elevated)] shadow-xl z-20 backdrop-blur-sm"
                  >
                    <div className="px-3 py-2 border-b border-[var(--armai-border-muted)] text-sm text-[var(--armai-text-muted)]">
                      {user?.email}
                    </div>
                    <LanguageSwitcher inDropdown onSelect={() => setMenuOpen(false)} />
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
          className="flex-1 py-4 px-4 md:py-4 md:px-6 overflow-auto min-w-0"
          role="main"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
