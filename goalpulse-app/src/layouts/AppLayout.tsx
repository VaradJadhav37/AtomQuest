import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Target, 
  Users, 
  Network, 
  LogOut, 
  BarChart3, 
  TrendingUp, 
  ChevronDown,
  Briefcase,
  UserCheck,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTeamContext } from '../context/TeamContext';

const SANS = "'Inter', system-ui, sans-serif";

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, logout } = useAuth();
  const userRole = (role || 'EMPLOYEE').toUpperCase();
  const { teams, activeTeamId, setActiveTeamId, isLoading: teamsLoading } = useTeamContext();

  // Determine active state for dropdown triggers based on active routes
  const isManageActive = ['/manager/teams', '/analytics', '/reports'].some(path => location.pathname.startsWith(path));
  const isAdminActive = ['/admin/users', '/org-alignment'].some(path => location.pathname.startsWith(path));

  // Menu states
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileManageOpen, setIsMobileManageOpen] = useState(isManageActive);
  const [isMobileAdminOpen, setIsMobileAdminOpen] = useState(isAdminActive);

  // Keep mobile menus synced with route changes
  useEffect(() => {
    setIsMobileManageOpen(isManageActive);
    setIsMobileAdminOpen(isAdminActive);
  }, [isManageActive, isAdminActive]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f8f9fb' }}>
      
      {/* ── Top Navbar ── */}
      <header className="app-layout-header">
        
        {/* Left: Logo & Brand */}
        <div className="app-layout-left" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ 
            width: '34px', 
            height: '34px', 
            background: 'linear-gradient(135deg, #1e293b, #0f172a)', 
            borderRadius: '9px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '18px', 
            fontWeight: '900', 
            color: 'white', 
            fontStyle: 'italic', 
            fontFamily: SANS,
            boxShadow: '0 4px 10px rgba(15, 23, 42, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            G
          </div>
          <span className="app-layout-brand" style={{ 
            fontFamily: SANS, 
            fontWeight: 800, 
            fontSize: '20px', 
            color: '#0f172a', 
            letterSpacing: '-0.04em',
            marginRight: '24px'
          }}>
            GoalKeeper
          </span>
          
          {/* Desktop Nav Links */}
          <nav className="app-layout-nav" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <NavLink to="/dashboard" className="app-nav-item">
              <LayoutDashboard size={16} /> 
              <span className="nav-label">Dashboard</span>
            </NavLink>
            <NavLink to="/goals" className="app-nav-item">
              <Target size={16} /> 
              <span className="nav-label">My Goals</span>
            </NavLink>
            
            {(userRole === 'MANAGER' || userRole === 'ADMIN') && (
              <NavLink to="/team" className="app-nav-item">
                <Users size={16} /> 
                <span className="nav-label">Team Goals</span>
              </NavLink>
            )}

            {/* "Manage" Dropdown */}
            {(userRole === 'MANAGER' || userRole === 'ADMIN') && (
              <div className="nav-dropdown">
                <button className={`nav-dropdown-trigger ${isManageActive ? 'active' : ''}`}>
                  <Briefcase size={16} />
                  <span>Manage</span>
                  <ChevronDown className="nav-dropdown-arrow" size={14} style={{ color: '#94a3b8' }} />
                </button>
                <div className="nav-dropdown-menu">
                  <NavLink to="/manager/teams" className="nav-dropdown-item">
                    <Briefcase size={15} />
                    <span>Teams</span>
                  </NavLink>
                  <NavLink to="/analytics" className="nav-dropdown-item">
                    <TrendingUp size={15} />
                    <span>Analytics</span>
                  </NavLink>
                  <NavLink to="/reports" className="nav-dropdown-item">
                    <BarChart3 size={15} />
                    <span>Reports</span>
                  </NavLink>
                </div>
              </div>
            )}

            {/* "Admin" Dropdown */}
            {userRole === 'ADMIN' && (
              <div className="nav-dropdown">
                <button className={`nav-dropdown-trigger ${isAdminActive ? 'active' : ''}`}>
                  <UserCheck size={16} />
                  <span>Admin</span>
                  <ChevronDown className="nav-dropdown-arrow" size={14} style={{ color: '#94a3b8' }} />
                </button>
                <div className="nav-dropdown-menu">
                  <NavLink to="/admin/users" className="nav-dropdown-item">
                    <UserCheck size={15} />
                    <span>User Management</span>
                  </NavLink>
                  <NavLink to="/org-alignment" className="nav-dropdown-item">
                    <Network size={15} />
                    <span>Org Alignment</span>
                  </NavLink>
                </div>
              </div>
            )}
          </nav>
        </div>

        {/* Right: Desktop User Profile & Sign Out */}
        <div className="app-layout-right" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {(userRole === 'MANAGER' || userRole === 'ADMIN') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Team:</span>
              <div className="premium-select-wrap" style={{ minWidth: '150px' }}>
                <select
                  value={activeTeamId}
                  onChange={e => setActiveTeamId(e.target.value)}
                  disabled={teamsLoading}
                  className="premium-select"
                >
                  <option value="all">All Teams</option>
                  {teams.map(team => (
                    <option key={team.id} value={String(team.id)}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(15, 23, 42, 0.02)', padding: '5px 12px', borderRadius: '999px', border: '1px solid rgba(226, 232, 240, 0.5)' }}>
            <div className="app-layout-user-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', fontFamily: SANS }}>{user?.name || 'Guest'}</div>
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#64748b', fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{userRole.toLowerCase()}</div>
            </div>
            <div style={{ 
              width: '30px', 
              height: '30px', 
              borderRadius: '50%', 
              background: userRole === 'ADMIN' ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : userRole === 'MANAGER' ? 'linear-gradient(135deg, #eff6ff, #bfdbfe)' : 'linear-gradient(135deg, #f0fdf4, #bbf7d0)', 
              color: userRole === 'ADMIN' ? '#b45309' : userRole === 'MANAGER' ? '#1d4ed8' : '#15803d', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '13px', 
              fontWeight: '800', 
              fontFamily: SANS,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)'
            }}>
              {user?.name?.charAt(0) || 'G'}
            </div>
          </div>
          
          <div style={{ width: '1px', height: '20px', background: 'rgba(226, 232, 240, 0.8)' }} />
          
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#64748b', fontFamily: SANS, fontWeight: '500', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
            <LogOut size={16} /> 
            <span className="logout-text">Sign Out</span>
          </button>
        </div>

        {/* Hamburger Toggle Button (Mobile/Tablet only) */}
        <button 
          className="app-mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

      </header>

      {/* ── Mobile/Tablet Sliding Navigation Drawer ── */}
      <div className={`app-mobile-drawer-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={() => setIsMobileMenuOpen(false)}>
        <div 
          className={`app-mobile-drawer-panel ${isMobileMenuOpen ? 'open' : ''}`} 
          onClick={e => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="app-mobile-drawer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ 
                width: '28px', 
                height: '28px', 
                background: 'linear-gradient(135deg, #1e293b, #0f172a)', 
                borderRadius: '7px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '15px', 
                fontWeight: '900', 
                color: 'white', 
                fontStyle: 'italic', 
                fontFamily: SANS
              }}>
                G
              </div>
              <span style={{ 
                fontFamily: SANS, 
                fontWeight: 800, 
                fontSize: '17px', 
                color: '#0f172a', 
                letterSpacing: '-0.04em'
              }}>
                GoalKeeper
              </span>
            </div>
            <button className="app-mobile-drawer-close" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={20} />
            </button>
          </div>

          {/* Drawer Content Body */}
          <div className="app-mobile-drawer-body">
            
            {/* Team Switcher if manager/admin */}
            {(userRole === 'MANAGER' || userRole === 'ADMIN') && (
              <div style={{ marginBottom: '20px', padding: '0 8px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', marginBottom: '8px' }}>Active Team</div>
                <div className="premium-select-wrap" style={{ width: '100%' }}>
                  <select
                    value={activeTeamId}
                    onChange={e => setActiveTeamId(e.target.value)}
                    disabled={teamsLoading}
                    className="premium-select"
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1' }}
                  >
                    <option value="all">All Teams</option>
                    {teams.map(team => (
                      <option key={team.id} value={String(team.id)}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>
            )}

            {/* Nav Links */}
            <div className="app-mobile-drawer-nav">
              
              <NavLink 
                to="/dashboard" 
                className="app-mobile-nav-item" 
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </NavLink>

              <NavLink 
                to="/goals" 
                className="app-mobile-nav-item" 
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Target size={18} />
                <span>My Goals</span>
              </NavLink>

              {(userRole === 'MANAGER' || userRole === 'ADMIN') && (
                <NavLink 
                  to="/team" 
                  className="app-mobile-nav-item" 
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Users size={18} />
                  <span>Team Goals</span>
                </NavLink>
              )}

              {/* Collapsible Manage */}
              {(userRole === 'MANAGER' || userRole === 'ADMIN') && (
                <div className="app-mobile-collapsible">
                  <button 
                    className={`app-mobile-collapsible-trigger ${isMobileManageOpen || isManageActive ? 'active' : ''}`}
                    onClick={() => setIsMobileManageOpen(!isMobileManageOpen)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Briefcase size={18} />
                      <span>Manage</span>
                    </div>
                    <ChevronDown size={14} className="collapsible-arrow" style={{ transform: isMobileManageOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                  
                  <div className={`app-mobile-collapsible-content ${isMobileManageOpen ? 'open' : ''}`}>
                    <NavLink to="/manager/teams" className="app-mobile-nav-subitem" onClick={() => setIsMobileMenuOpen(false)}>
                      <Briefcase size={16} />
                      <span>Teams</span>
                    </NavLink>
                    <NavLink to="/analytics" className="app-mobile-nav-subitem" onClick={() => setIsMobileMenuOpen(false)}>
                      <TrendingUp size={16} />
                      <span>Analytics</span>
                    </NavLink>
                    <NavLink to="/reports" className="app-mobile-nav-subitem" onClick={() => setIsMobileMenuOpen(false)}>
                      <BarChart3 size={16} />
                      <span>Reports</span>
                    </NavLink>
                  </div>
                </div>
              )}

              {/* Collapsible Admin */}
              {userRole === 'ADMIN' && (
                <div className="app-mobile-collapsible">
                  <button 
                    className={`app-mobile-collapsible-trigger ${isMobileAdminOpen || isAdminActive ? 'active' : ''}`}
                    onClick={() => setIsMobileAdminOpen(!isMobileAdminOpen)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <UserCheck size={18} />
                      <span>Admin</span>
                    </div>
                    <ChevronDown size={14} className="collapsible-arrow" style={{ transform: isMobileAdminOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                  
                  <div className={`app-mobile-collapsible-content ${isMobileAdminOpen ? 'open' : ''}`}>
                    <NavLink to="/admin/users" className="app-mobile-nav-subitem" onClick={() => setIsMobileMenuOpen(false)}>
                      <UserCheck size={16} />
                      <span>User Management</span>
                    </NavLink>
                    <NavLink to="/org-alignment" className="app-mobile-nav-subitem" onClick={() => setIsMobileMenuOpen(false)}>
                      <Network size={16} />
                      <span>Org Alignment</span>
                    </NavLink>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Drawer Footer User Profile & Sign Out */}
          <div className="app-mobile-drawer-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', marginBottom: '14px' }}>
              <div style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '50%', 
                background: role === 'ADMIN' ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : role === 'MANAGER' ? 'linear-gradient(135deg, #eff6ff, #bfdbfe)' : 'linear-gradient(135deg, #f0fdf4, #bbf7d0)', 
                color: role === 'ADMIN' ? '#b45309' : role === 'MANAGER' ? '#1d4ed8' : '#15803d', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '14px', 
                fontWeight: '800', 
                fontFamily: SANS
              }}>
                {user?.name?.charAt(0) || 'G'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', fontFamily: SANS, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name || 'Guest'}
                </span>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {userRole.toLowerCase()}
                </span>
              </div>
            </div>
            
            <button 
              onClick={handleLogout} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '8px', 
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                background: '#fef2f2', 
                border: 'none', 
                cursor: 'pointer', 
                fontSize: '13px', 
                color: '#ef4444', 
                fontFamily: SANS, 
                fontWeight: '700', 
                transition: 'all 0.15s' 
              }}
            >
              <LogOut size={16} /> 
              <span>Sign Out</span>
            </button>
          </div>

        </div>
      </div>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#f8f9fb', padding: '24px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
