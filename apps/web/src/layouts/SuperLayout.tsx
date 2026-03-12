import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  Menu,
  LayoutDashboard,
  Store,
  CreditCard,
  Headphones,
  FileCheck,
  Package,
  Settings,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { MobileDrawer } from '../components/MobileDrawer'
import { useMediaQuery } from '../hooks/useMediaQuery'
import type { I18nKey } from '../i18n/keys'

const SIDEBAR_WIDTH = 240

const superNavItems: { to: string; labelKey: I18nKey; icon: typeof LayoutDashboard }[] = [
  { to: '/super/dashboard', labelKey: 'super.overview', icon: LayoutDashboard },
  { to: '/super/merchants', labelKey: 'super.merchants', icon: Store },
  { to: '/super/billing', labelKey: 'super.billing', icon: CreditCard },
  { to: '/super/support', labelKey: 'super.support', icon: Headphones },
  { to: '/super/audit', labelKey: 'super.audit', icon: FileCheck },
  { to: '/super/plans', labelKey: 'admin.plans', icon: Package },
  { to: '/super/settings', labelKey: 'admin.settings', icon: Settings },
]

export default function SuperLayout() {
  const { user, signOut } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ' +
    (isActive
      ? 'text-[var(--armai-primary)] bg-[var(--armai-primary)]/10 border-l-4 border-l-[var(--armai-primary)] shadow-gold'
      : 'text-[var(--armai-text-secondary)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-text)] hover:border-l-4 hover:border-l-[var(--armai-primary)]/50')

  const renderNavLinks = () =>
    superNavItems.map(({ to, labelKey, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        className={navLinkClass}
        onClick={() => setDrawerOpen(false)}
        end={to === '/super/dashboard'}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {t(labelKey)}
      </NavLink>
    ))

  return (
    <div className="flex min-h-screen bg-[var(--armai-bg)] velvet-bg">
      {/* Desktop: fixed/collapsible sidebar */}
      {isDesktop && (
        <aside
          style={{ width: sidebarCollapsed ? 72 : SIDEBAR_WIDTH }}
          className="flex flex-col flex-shrink-0 bg-[var(--armai-surface)] border-r border-[var(--armai-border)] p-4 transition-all duration-300"
          role="navigation"
          aria-label="Super admin navigation"
        >
          <div className="mb-6 flex items-center justify-between">
            {!sidebarCollapsed && (
              <div>
                <span className="text-lg font-bold text-[var(--armai-text)] tracking-tight">
                  ArmAI
                </span>
                <span className="ml-1.5 text-xs text-[var(--armai-primary)] font-semibold uppercase tracking-wider">
                  Command Center
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-2 rounded-lg text-[var(--armai-text-muted)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span className="text-lg">{sidebarCollapsed ? '→' : '←'}</span>
            </button>
          </div>
          <nav className="flex flex-col gap-0.5 flex-1">{renderNavLinks()}</nav>
        </aside>
      )}

      {/* Mobile: drawer */}
      {!isDesktop && (
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`ArmAI — ${t('super.commandCenter')}`}
          aria-label="Super admin navigation"
        >
          <div className="flex flex-col gap-1">{renderNavLinks()}</div>
        </MobileDrawer>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between gap-4 px-4 md:px-6 border-b border-[var(--armai-border)] bg-[var(--armai-surface)]">
          <div className="flex items-center gap-3 min-w-0">
            {!isDesktop && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="p-2 rounded-lg text-[var(--armai-text-muted)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
                aria-label="Open menu"
                aria-expanded={drawerOpen}
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <span className="font-semibold text-[var(--armai-text)]">ArmAI</span>
            {isDesktop && (
              <span className="text-xs text-[var(--armai-primary)] uppercase tracking-wider">
                {t('super.commandCenter')}
              </span>
            )}
          </div>
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--armai-surface-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)] transition-colors"
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              aria-label="User menu"
            >
              <span className="w-8 h-8 rounded-full bg-[var(--armai-primary)]/20 border border-[var(--armai-primary)] flex items-center justify-center text-sm font-semibold text-[var(--armai-primary)]">
                {(user?.email ?? '?').slice(0, 1).toUpperCase()}
              </span>
              {user?.email && (
                <span className="hidden sm:block text-sm text-[var(--armai-text-secondary)] truncate max-w-[140px]">
                  {user.email}
                </span>
              )}
              <ChevronDown className="h-4 w-4 text-[var(--armai-text-muted)]" />
            </button>
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden="true"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1 py-1 w-56 rounded-xl border border-[var(--armai-border)] bg-[var(--armai-surface-elevated)] shadow-xl z-20 backdrop-blur-sm"
                >
                  <div className="px-3 py-2 border-b border-[var(--armai-border-muted)] text-sm text-[var(--armai-text-muted)] truncate">
                    {user?.email}
                  </div>
                  <LanguageSwitcher inDropdown onSelect={() => setUserMenuOpen(false)} />
                  <NavLink
                    to="/super/plans"
                    className="block px-3 py-2 text-sm text-[var(--armai-text)] hover:bg-[var(--armai-surface)]"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    {t('admin.plans')}
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => {
                      handleSignOut()
                      setUserMenuOpen(false)
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-[var(--armai-text)] hover:bg-[var(--armai-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--armai-primary)]"
                    role="menuitem"
                  >
                    {t('action.logout')}
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="flex-1 py-4 px-4 md:py-4 md:px-6 overflow-auto" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
