// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useClerk, useUser } from '@clerk/react';
import api from '../lib/api';

export type Role = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  department: string;
}

interface AuthContextType {
  user: AuthUser | null;
  role: Role;
  setRole: (r: Role) => void; // demo role switcher
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const clerk = useClerk();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) {
      setIsLoading(true);
      return;
    }
    const email = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase().trim();

    if (!isSignedIn || !email) {
      localStorage.removeItem('gk_clerk_email');
      const storedUser = localStorage.getItem('gk_user');
      const token = localStorage.getItem('gk_token');
      if (storedUser && token) {
        const legacyUser = JSON.parse(storedUser) as AuthUser;
        setUser(legacyUser);
        setRole(legacyUser.role);
      } else {
        setUser(null);
        setRole('EMPLOYEE');
      }
      setIsLoading(false);
      return;
    }

    localStorage.setItem('gk_clerk_email', email);
    let cancelled = false;

    const syncUser = async () => {
      try {
        const res = await api.get('/api/auth/me');
        if (cancelled) return;
        const u = res.data as AuthUser;
        setUser(u);
        setRole(u.role);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to sync Clerk session to app user:', err);
        setUser(null);
        setRole('EMPLOYEE');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    syncUser();

    return () => {
      cancelled = true;
    };
  }, [clerkUser, isLoaded, isSignedIn]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    const { token, user: u } = res.data;
    localStorage.setItem('gk_token', token);
    localStorage.setItem('gk_user', JSON.stringify(u));
    localStorage.removeItem('gk_clerk_email');
    setUser(u);
    setRole(u.role);
  };

  const logout = async () => {
    localStorage.removeItem('gk_clerk_email');
    localStorage.removeItem('gk_token');
    localStorage.removeItem('gk_user');
    setUser(null);
    setRole('EMPLOYEE');
    await clerk.signOut();
  };

  const value = useMemo(() => ({ user, role, setRole, login, logout, isLoading }), [user, role, login, logout, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
