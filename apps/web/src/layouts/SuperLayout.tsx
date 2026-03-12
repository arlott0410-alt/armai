import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  Menu,
  LogOut,
  LayoutDashboard,
  Store,
  CreditCard,
  Headphones,
  FileCheck,
  Package,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { MobileDrawer } from '../components/MobileDrawer'
import { useMediaQuery } from '../hooks/useMediaQuery'

const SIDEBAR_WIDTH = 240

const superNavItems = [
  { to: '/super/dashboard', labelKey: 'Overview', icon: LayoutDashboard },
  { to: '/super/merchants', labelKey: 'Merchants', icon: Store },
  { to: '/super/billing', labelKey: 'Billing', icon: CreditCard },
  { to: '/super/support', labelKey: 'Support', icon: Headphones },
  { to: '/super/audit', labelKey: 'Audit', icon: FileCheck },
  { to: '/super/plans', labelKey: 'admin.plans', icon: Package },
] as const

export default function SuperLayout() {
  const { user, signOut } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

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
        {labelKey.startsWith('admin.') ? t(labelKey as 'admin.plans') : labelKey}
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
          <div className="mt-auto pt-4 border-t border-[var(--armai-border-muted)] space-y-3">
            <div
              className="text-xs text-[var(--armai-text-muted)] truncate"
              title={user?.email ?? ''}
            >
              {user?.email}
            </div>
            <LanguageSwitcher inDropdown={false} />
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-[var(--armai-text-secondary)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)] transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              {!sidebarCollapsed && 'Sign out'}
            </button>
          </div>
        </aside>
      )}

      {/* Mobile: drawer */}
      {!isDesktop && (
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="ArmAI — Command Center"
          aria-label="Super admin navigation"
        >
          <div className="flex flex-col gap-1">{renderNavLinks()}</div>
          <div className="mt-6 pt-4 border-t border-[var(--armai-border-muted)] space-y-2">
            <div className="text-xs text-[var(--armai-text-muted)] truncate">{user?.email}</div>
            <LanguageSwitcher inDropdown={false} />
            <button
              type="button"
              onClick={() => {
                handleSignOut()
                setDrawerOpen(false)
              }}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-[var(--armai-text-secondary)] hover:bg-[var(--armai-surface-elevated)]"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </MobileDrawer>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex md:hidden h-14 items-center px-4 border-b border-[var(--armai-border)] bg-[var(--armai-surface)]">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-lg text-[var(--armai-text-muted)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-2 font-semibold text-[var(--armai-text)]">ArmAI</span>
          <span className="ml-1 text-xs text-[var(--armai-primary)] uppercase tracking-wider">
            Command
          </span>
        </header>
        <main className="flex-1 py-4 px-4 md:py-4 md:px-6 overflow-auto" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
