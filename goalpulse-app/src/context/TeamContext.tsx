import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import api from '../lib/api';

export interface TeamSummary {
  id: number;
  name: string;
  description: string;
  manager_id: number;
  created_at: string;
  is_active: boolean;
  member_count?: number;
  goal_count?: number;
  avg_progress?: number;
  manager?: {
    id: number;
    name: string;
    email: string;
    role: string;
    department: string;
    manager_id: number | null;
    is_active?: boolean;
    created_at?: string;
  } | null;
}

type TeamContextValue = {
  teams: TeamSummary[];
  activeTeamId: string;
  setActiveTeamId: (teamId: string) => void;
  activeTeam: TeamSummary | null;
  isLoading: boolean;
  refreshTeams: () => Promise<unknown>;
};

const TeamContext = createContext<TeamContextValue | undefined>(undefined);
const STORAGE_KEY = 'gp_active_team_id';

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const [activeTeamId, setActiveTeamIdState] = useState(() => {
    if (typeof window === 'undefined') return 'all';
    return window.localStorage.getItem(STORAGE_KEY) || 'all';
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['managedTeams', role],
    queryFn: () => api.get('/api/teams').then(r => r.data),
    enabled: role === 'MANAGER' || role === 'ADMIN',
  });

  const teams: TeamSummary[] = data?.teams || [];
  const activeTeam = activeTeamId === 'all'
    ? null
    : teams.find(team => String(team.id) === activeTeamId) || null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, activeTeamId);
  }, [activeTeamId]);

  useEffect(() => {
    if (teams.length === 0) {
      if (activeTeamId !== 'all') {
        setActiveTeamIdState('all');
      }
      return;
    }
    if (activeTeamId === 'all') return;
    if (!teams.some(team => String(team.id) === activeTeamId)) {
      setActiveTeamIdState('all');
    }
  }, [activeTeamId, teams]);

  const setActiveTeamId = (teamId: string) => {
    setActiveTeamIdState(teamId || 'all');
  };

  const value = useMemo(() => ({
    teams,
    activeTeamId,
    setActiveTeamId,
    activeTeam,
    isLoading,
    refreshTeams: refetch,
  }), [teams, activeTeamId, activeTeam, isLoading, refetch]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeamContext() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeamContext must be used within TeamProvider');
  return ctx;
}
