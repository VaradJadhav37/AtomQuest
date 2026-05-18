import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, Send } from 'lucide-react';
import api from '../lib/api';

type Props = {
  onClose: () => void;
};

export default function TeamJoinRequestModal({ onClose }: Props) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['availableTeams'],
    queryFn: () => api.get('/api/teams/available').then(r => r.data),
  });

  const teams = data?.teams || [];
  const filteredTeams = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return teams;
    return teams.filter((team: any) =>
      [team.name, team.description, team.manager?.name, team.manager?.department]
        .filter(Boolean)
        .some((value: string) => String(value).toLowerCase().includes(term))
    );
  }, [teams, query]);

  const requestMutation = useMutation({
    mutationFn: (teamId: number) => api.post(`/api/teams/${teamId}/members/request`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myTeams'] });
      qc.invalidateQueries({ queryKey: ['availableTeams'] });
      onClose();
    },
  });

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>My Teams</div>
            <h2 style={titleStyle}>Request to Join a Team</h2>
          </div>
          <button onClick={onClose} style={closeStyle}>
            <X size={18} />
          </button>
        </div>

        <div style={bodyStyle}>
          <div style={searchWrapStyle}>
            <Search size={16} color="#64748b" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search teams, managers, or departments"
              style={searchInputStyle}
            />
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {isLoading ? (
              <div style={emptyStyle}>Loading available teams...</div>
            ) : filteredTeams.length ? (
              filteredTeams.map((team: any) => (
                <div key={team.id} style={teamCardStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={teamNameStyle}>{team.name}</div>
                    <div style={teamMetaStyle}>
                      {team.manager?.name || 'Manager'} · {team.description || 'No description'}
                    </div>
                  </div>
                  <button
                    onClick={() => requestMutation.mutate(team.id)}
                    disabled={requestMutation.isPending}
                    style={requestButtonStyle}
                  >
                    <Send size={14} />
                    Request
                  </button>
                </div>
              ))
            ) : (
              <div style={emptyStyle}>No teams match your search.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  background: 'rgba(15, 23, 42, 0.48)',
  backdropFilter: 'blur(6px)',
};

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 760,
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#fff',
  borderRadius: 24,
  overflow: 'hidden',
  boxShadow: '0 30px 80px rgba(15, 23, 42, 0.2)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: '24px 28px',
  borderBottom: '1px solid #e2e8f0',
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#64748b',
};

const titleStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 22,
  fontWeight: 800,
  color: '#0f172a',
};

const closeStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: 'none',
  background: '#f1f5f9',
  color: '#334155',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const bodyStyle: React.CSSProperties = {
  padding: 28,
  overflowY: 'auto',
};

const searchWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  outline: 'none',
  fontSize: 14,
  fontFamily: "'Inter', system-ui, sans-serif",
  color: '#0f172a',
};

const teamCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '16px 18px',
  borderRadius: 18,
  border: '1px solid #e2e8f0',
  background: '#fff',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

const teamNameStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: '#0f172a',
};

const teamMetaStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: '#64748b',
  lineHeight: 1.5,
};

const requestButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 12,
  border: 'none',
  background: '#0f172a',
  color: '#fff',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  flexShrink: 0,
};

const emptyStyle: React.CSSProperties = {
  padding: '22px 16px',
  textAlign: 'center',
  color: '#64748b',
  background: '#f8fafc',
  borderRadius: 16,
  border: '1px dashed #cbd5e1',
};
