import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { theme } from '../theme'

export default function SuperLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navStyle = ({ isActive }: { isActive: boolean }) => ({
    display: 'block',
    padding: '10px 12px',
    borderRadius: 6,
    color: isActive ? theme.highlight : theme.textSecondary,
    textDecoration: 'none' as const,
    fontSize: 13,
    fontWeight: isActive ? 600 : 500,
    borderLeft: isActive ? `3px solid ${theme.primary}` : '3px solid transparent',
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.background }}>
      <aside
        style={{
          width: 240,
          background: theme.surface,
          borderRight: `1px solid ${theme.borderMuted}`,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <span
            style={{ fontSize: 18, fontWeight: 700, color: theme.text, letterSpacing: '-0.02em' }}
          >
            ArmAI
          </span>
          <span
            style={{
              fontSize: 11,
              color: theme.primary,
              marginLeft: 6,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Command Center
          </span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <NavLink to="/super/dashboard" style={navStyle}>
            Overview
          </NavLink>
          <NavLink to="/super/merchants" style={navStyle}>
            Merchants
          </NavLink>
          <NavLink to="/super/billing" style={navStyle}>
            Billing
          </NavLink>
          <NavLink to="/super/support" style={navStyle}>
            Support
          </NavLink>
          <NavLink to="/super/audit" style={navStyle}>
            Audit
          </NavLink>
          <NavLink to="/admin/plans" style={navStyle}>
            Plans (Admin)
          </NavLink>
        </nav>
        <div
          style={{ marginTop: 'auto', paddingTop: 24, borderTop: `1px solid ${theme.borderMuted}` }}
        >
          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>{user?.email}</div>
          <button
            onClick={handleSignOut}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              color: theme.textSecondary,
              border: `1px solid ${theme.borderMuted}`,
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 28, overflow: 'auto', background: theme.background }}>
        <Outlet />
      </main>
    </div>
  )
}
