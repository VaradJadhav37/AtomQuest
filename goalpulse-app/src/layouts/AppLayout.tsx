import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Target, Users, Network, LogOut, BarChart3, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SANS = "'Inter', system-ui, sans-serif";

export default function AppLayout() {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 14px', borderRadius: '8px', fontSize: '13px',
    fontFamily: SANS, fontWeight: isActive ? '700' : '500',
    color: isActive ? '#111827' : '#6b7280',
    textDecoration: 'none',
    background: isActive ? '#f3f4f6' : 'transparent',
    transition: 'all 0.15s ease',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f8f9fb' }}>
      
      {/* ── Top Navbar ── */}
      <header className="app-layout-header">
        
        {/* Left: Logo & Brand */}
        <div className="app-layout-left">
          <div style={{ width: '32px', height: '32px', background: '#111827', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '900', color: 'white', fontStyle: 'italic', fontFamily: SANS }}>G</div>
          <span className="app-layout-brand">GoalPulse</span>
          
          {/* Nav Links */}
          <nav className="app-layout-nav">
            <NavLink to="/dashboard" style={({ isActive }) => navItemStyle(isActive)}><LayoutDashboard size={16} /> <span className="nav-label">Dashboard</span></NavLink>
            <NavLink to="/goals" style={({ isActive }) => navItemStyle(isActive)}><Target size={16} /> <span className="nav-label">My Goals</span></NavLink>
            
            {(role === 'MANAGER' || role === 'ADMIN') && (
              <NavLink to="/team" style={({ isActive }) => navItemStyle(isActive)}><Users size={16} /> <span className="nav-label">Team Goals</span></NavLink>
            )}

            {(role === 'ADMIN' || role === 'MANAGER') && (
              <>
                <NavLink to="/analytics" style={({ isActive }) => navItemStyle(isActive)}><TrendingUp size={16} /> <span className="nav-label">Analytics</span></NavLink>
                <NavLink to="/reports" style={({ isActive }) => navItemStyle(isActive)}><BarChart3 size={16} /> <span className="nav-label">Reports</span></NavLink>
              </>
            )}

            {role === 'ADMIN' && (
              <NavLink to="/org-alignment" style={({ isActive }) => navItemStyle(isActive)}><Network size={16} /> <span className="nav-label">Org Alignment</span></NavLink>
            )}
          </nav>
        </div>

        {/* Right: User Profile & Sign Out */}
        <div className="app-layout-right">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="app-layout-user-info">
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827', fontFamily: SANS }}>{user?.name || 'Guest'}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: SANS, textTransform: 'capitalize' }}>{role.toLowerCase()}</div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: role === 'ADMIN' ? '#fef3c7' : role === 'MANAGER' ? '#eff6ff' : '#f0fdf4', color: role === 'ADMIN' ? '#d97706' : role === 'MANAGER' ? '#2563eb' : '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', fontFamily: SANS }}>
              {user?.name?.charAt(0) || 'G'}
            </div>
          </div>
          <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }} />
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#6b7280', fontFamily: SANS, transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
            onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}>
            <LogOut size={16} /> <span className="logout-text">Sign Out</span>
          </button>
        </div>

      </header>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#f8f9fb', padding: '24px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
