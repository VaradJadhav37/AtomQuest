import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GoalSheet from './pages/GoalSheet';
import Team from './pages/Team';
import OrgAlignment from './pages/OrgAlignment';
import AdminReports from './pages/AdminReports';

import Analytics from './pages/Analytics';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'Inter', system-ui, sans-serif", color: '#6b7280' }}>
      Loading...
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

import React from 'react';

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
        <Route path="/org-alignment" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<OrgAlignment />} />
        </Route>
        <Route path="/reports" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<AdminReports />} />
        </Route>
        <Route path="/analytics" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Analytics />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
