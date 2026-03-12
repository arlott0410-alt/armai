import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Menu, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

export default function SuperLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    'block px-3 py-2 rounded-lg text-sm font-medium transition-colors ' +
    (isActive
      ? 'text-[var(--armai-primary)] bg-primary/10 border-l-4 border-l-[var(--armai-primary)]'
      : 'text-[var(--armai-text-secondary)] hover:bg-[var(--armai-surface-elevated)] hover:text-[var(--armai-text)]')

  return (
    <div className="flex min-h-screen bg-[var(--armai-bg)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`flex flex-col w-60 bg-[var(--armai-surface)] border-r border-[var(--armai-border-muted)] p-4
          fixed md:relative inset-y-0 left-0 z-30 transform transition-transform duration-200
          -translate-x-full md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : ''}`}
        role="navigation"
        aria-label="Super admin navigation"
      >
        <div className="mb-6">
          <span className="text-lg font-bold text-[var(--armai-text)] tracking-tight">ArmAI</span>
          <span className="ml-1.5 text-xs text-[var(--armai-primary)] font-semibold uppercase tracking-wider">
            Command Center
          </span>
        </div>
        <nav className="flex flex-col gap-0.5 flex-1">
          <NavLink
            to="/super/dashboard"
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            Overview
          </NavLink>
          <NavLink
            to="/super/merchants"
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            Merchants
          </NavLink>
          <NavLink
            to="/super/billing"
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            Billing
          </NavLink>
          <NavLink
            to="/super/support"
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            Support
          </NavLink>
          <NavLink to="/super/audit" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
            Audit
          </NavLink>
          <NavLink to="/admin/plans" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
            Plans (Admin)
          </NavLink>
        </nav>
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
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-[var(--armai-text-secondary)] hover:bg-[var(--armai-surface-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 flex items-center px-4 border-b border-[var(--armai-border-muted)] bg-[var(--armai-surface)]">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-2 rounded-lg text-[var(--armai-text-muted)] hover:bg-[var(--armai-surface-elevated)]"
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-2 font-semibold text-[var(--armai-text)]">ArmAI</span>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
