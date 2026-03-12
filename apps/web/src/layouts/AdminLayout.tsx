import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CreditCard,
  Users,
  FileText,
  BarChart3,
  HeadphonesIcon,
  ClipboardList,
  Settings,
  Sparkles,
  ChevronLeft,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

const navClass =
  'flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors text-[var(--armai-text-secondary)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]'
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  navClass +
  (isActive
    ? ' bg-primary/10 text-[var(--armai-primary)] border-l-4 border-l-[var(--armai-primary)]'
    : '')

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-[var(--armai-bg)]">
      <aside
        className={`flex flex-col border-r border-[var(--armai-border-muted)] bg-[var(--armai-surface)] transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[64px]' : 'w-56'
        }`}
      >
        <div className="flex h-14 items-center justify-between px-3 border-b border-[var(--armai-border-muted)]">
          {!sidebarCollapsed && (
            <span className="text-lg font-bold text-[var(--armai-text)]">{t('nav.admin')}</span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="p-2 rounded-lg text-[var(--armai-text-muted)] hover:bg-[var(--armai-surface-elevated)]"
            aria-label={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronLeft className={`h-5 w-5 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <NavLink to="/admin/plans" className={navLinkClass}>
            <CreditCard className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && t('admin.plans')}
          </NavLink>
          <NavLink to="/super/dashboard" className={navLinkClass}>
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && t('nav.overview')}
          </NavLink>
          <NavLink to="/super/merchants" className={navLinkClass}>
            <Users className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && t('admin.users')}
          </NavLink>
          <NavLink to="/super/billing" className={navLinkClass}>
            <FileText className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && t('admin.billing')}
          </NavLink>
          <NavLink to="/admin/analytics" className={navLinkClass}>
            <BarChart3 className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && t('admin.analytics')}
          </NavLink>
          <NavLink to="/super/support" className={navLinkClass}>
            <HeadphonesIcon className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && t('admin.support')}
          </NavLink>
          <NavLink to="/super/audit" className={navLinkClass}>
            <ClipboardList className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && t('admin.audit')}
          </NavLink>
          <NavLink to="/admin/settings" className={navLinkClass}>
            <Settings className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && t('admin.settings')}
          </NavLink>
          <NavLink to="/admin/ai-tools" className={navLinkClass}>
            <Sparkles className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && t('admin.aiTools')}
          </NavLink>
        </nav>
        <div className="p-2 border-t border-[var(--armai-border-muted)]">
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--armai-text-muted)] truncate">
            {user?.email}
          </div>
          <div className="pt-1">
            <LanguageSwitcher inDropdown={false} />
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full mt-2 px-3 py-2 rounded-lg text-sm text-[var(--armai-text)] hover:bg-[var(--armai-surface-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && t('action.logout')}
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
