import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function SuperLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: '#1e293b', color: '#fff', padding: 16 }}>
        <h2 style={{ margin: '0 0 24px', fontSize: 18 }}>ArmAI Super</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <NavLink to="/super/dashboard" style={({ isActive }) => ({ color: isActive ? '#93c5fd' : '#cbd5e1', padding: 8, borderRadius: 4, textDecoration: 'none' })}>
            Overview
          </NavLink>
          <NavLink to="/super/merchants" style={({ isActive }) => ({ color: isActive ? '#93c5fd' : '#cbd5e1', padding: 8, borderRadius: 4, textDecoration: 'none' })}>
            Merchants
          </NavLink>
          <NavLink to="/super/billing" style={({ isActive }) => ({ color: isActive ? '#93c5fd' : '#cbd5e1', padding: 8, borderRadius: 4, textDecoration: 'none' })}>
            Billing
          </NavLink>
          <NavLink to="/super/support" style={({ isActive }) => ({ color: isActive ? '#93c5fd' : '#cbd5e1', padding: 8, borderRadius: 4, textDecoration: 'none' })}>
            Support
          </NavLink>
          <NavLink to="/super/audit" style={({ isActive }) => ({ color: isActive ? '#93c5fd' : '#cbd5e1', padding: 8, borderRadius: 4, textDecoration: 'none' })}>
            Audit
          </NavLink>
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{user?.email}</span>
          <button onClick={handleSignOut} style={{ display: 'block', marginTop: 8, padding: '6px 12px', background: 'transparent', color: '#cbd5e1', border: '1px solid #475569', borderRadius: 4 }}>
            Sign out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
