import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GoalSheet from './pages/GoalSheet';
import Team from './pages/Team';
import ManagerTeams from './pages/ManagerTeams';
import TeamDetail from './pages/TeamDetail';
import OrgAlignment from './pages/OrgAlignment';
import AdminReports from './pages/AdminReports';
import AdminUsers from './pages/AdminUsers';

import Analytics from './pages/Analytics';
import NotFound from './pages/NotFound';

import React from 'react';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>Loading...</span>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/sign-up" element={<Login mode="sign-up" />} />
        <Route path="/dashboard" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
        </Route>
        <Route path="/goals" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<GoalSheet />} />
        </Route>
        <Route path="/team" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Team />} />
        </Route>
        <Route path="/manager/teams" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<ManagerTeams />} />
          <Route path=":teamId" element={<TeamDetail />} />
        </Route>
        <Route path="/admin/users" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<AdminUsers />} />
        </Route>
        <Route path="/org-alignment" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<OrgAlignment />} />
        </Route>
        <Route path="/reports" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<AdminReports />} />
        </Route>
        <Route path="/analytics" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Analytics />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
