import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CreditCard,
  MessageCircle,
  Bot,
  Settings,
  Users,
  CreditCard as PlanIcon,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Bell,
  Menu,
  ShoppingBag,
  Activity,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { I18nKey } from '../i18n/keys'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useI18n } from '../i18n/I18nProvider'
import { deriveLocaleFromMerchant } from '../i18n/locales'
import { merchantApi, getBaseUrl } from '../lib/api'
import { toast } from 'sonner'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { MobileDrawer } from '../components/MobileDrawer'
import { useMediaQuery } from '../hooks/useMediaQuery'

const SIDEBAR_WIDTH = 240

type NavItem = {
  path: string
  label: I18nKey
  icon: LucideIcon
  end: boolean
  children?: never
}

const getMerchantNavItems = (): NavItem[] => [
  { path: '/merchant/dashboard', label: 'nav.overview', icon: LayoutDashboard, end: true },
  { path: '/merchant/orders', label: 'nav.orders', icon: Activity, end: false },
  { path: '/merchant/products', label: 'nav.productsAndCategories', icon: ShoppingBag, end: false },
  { path: '/merchant/payment-config', label: 'nav.paymentConfig', icon: CreditCard, end: false },
  { path: '/merchant/channels', label: 'nav.channels', icon: MessageCircle, end: false },
  { path: '/merchant/ai-config', label: 'nav.aiConfig', icon: Bot, end: false },
  { path: '/merchant/general-settings', label: 'nav.generalSettings', icon: Settings, end: false },
  { path: '/merchant/customers', label: 'nav.customers', icon: Users, end: false },
]

export default function MerchantLayout() {
  const { user, signOut, refreshUser } = useAuth()
  const navigate = useNavigate()
  const { t, setLocale } = useI18n()
  const { theme, toggleDark } = useTheme()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [onboardLoading, setOnboardLoading] = useState(false)
  const [onboardError, setOnboardError] = useState<string | null>(null)
  const token = user?.accessToken ?? null

  const needsOnboard =
    user?.role === 'merchant_admin' &&
    (!user?.merchantIds || user.merchantIds.length === 0) &&
    !!token

  // Debug: help diagnose Forbidden after signup (role + merchant count)
  if (typeof console !== 'undefined' && console.log) {
    console.log(
      '[MerchantLayout] user role:',
      user?.role,
      'merchantIds:',
      user?.merchantIds?.length ?? 0
    )
  }

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

  const handleCompleteOnboard = async () => {
    if (!token || onboardLoading) return
    setOnboardLoading(true)
    setOnboardError(null)
    try {
      const base = getBaseUrl()
      const res = await fetch(`${base}/onboard/merchant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if ((res.status === 200 || res.status === 201) && (data.ok || data.alreadyOnboarded)) {
        await refreshUser()
        toast.success(t('confirm.confirmSuccessToast'))
      } else {
        const errMsg = (data as { error?: string }).error ?? 'Onboard failed'
        setOnboardError(errMsg)
        toast.error(errMsg)
      }
    } catch {
      setOnboardError('Request failed')
      toast.error('Request failed')
    } finally {
      setOnboardLoading(false)
    }
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

  const merchantNavItems = getMerchantNavItems()
  const renderNavLinks = (showLabels: boolean) => (
    <>
      {merchantNavItems.map(({ path, label, icon: Icon, end }) => (
        <NavLink
          key={path}
          to={path}
          className={navLinkClass}
          role="menuitem"
          end={end}
          onClick={() => setDrawerOpen(false)}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {showLabels && t(label)}
        </NavLink>
      ))}
      <NavLink
        to="/pricing"
        className={navLinkClass}
        role="menuitem"
        end={false}
        onClick={() => setDrawerOpen(false)}
      >
        <PlanIcon className="h-4 w-4 shrink-0" />
        {showLabels && t('nav.plans')}
      </NavLink>
    </>
  )

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
          {needsOnboard ? (
            <div className="flex min-h-[60vh] items-center justify-center p-4">
              <div className="w-full max-w-md rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface)] p-6 text-center shadow-lg">
                <h2 className="text-lg font-semibold text-[var(--armai-text)] mb-2">
                  {t('onboard.completeTitle')}
                </h2>
                <p className="text-sm text-[var(--armai-text-muted)] mb-6">
                  {t('onboard.completeSubtitle')}
                </p>
                {onboardError && (
                  <p className="mb-4 text-sm text-[var(--armai-danger)]">{onboardError}</p>
                )}
                <button
                  type="button"
                  onClick={handleCompleteOnboard}
                  disabled={onboardLoading}
                  className="w-full py-3 px-4 rounded-lg font-semibold bg-[var(--armai-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {onboardLoading ? t('common.loading') : t('onboard.completeButton')}
                </button>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
