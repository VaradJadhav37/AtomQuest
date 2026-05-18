import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Target, TrendingUp, X } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTeamContext } from '../context/TeamContext';

export default function ManagerTeams() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { role } = useAuth();
  const { activeTeamId, setActiveTeamId } = useTeamContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['managedTeams'],
    queryFn: () => api.get('/api/teams').then(r => r.data),
    enabled: role === 'MANAGER' || role === 'ADMIN',
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/teams', form),
    onSuccess: async () => {
      setError('');
      await qc.invalidateQueries({ queryKey: ['managedTeams'] });
      await qc.invalidateQueries({ queryKey: ['managedTeams', role] });
      setForm({ name: '', description: '' });
      setCreateOpen(false);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to create team. Please try again.');
    },
  });

  if (role !== 'MANAGER' && role !== 'ADMIN') {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>This page is only available to managers and admins.</div>;
  }

  const teams = data?.teams || [];

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Team Management</div>
          <h1 style={titleStyle}>Multi-Team Workspace</h1>
          <p style={subtitleStyle}>Create, switch, and manage the teams you own from a single dashboard.</p>
        </div>
        <button onClick={() => setCreateOpen(true)} style={primaryButton}>
          <Plus size={16} />
          Create Team
        </button>
      </div>

      <div style={summaryRow}>
        <div style={summaryCard}>
          <div style={summaryLabel}>Active Teams</div>
          <div style={summaryValue}>{teams.length}</div>
        </div>
        <div style={summaryCard}>
          <div style={summaryLabel}>Selected Context</div>
          <div style={summaryValue}>{activeTeamId === 'all' ? 'All Teams' : teams.find((team: any) => String(team.id) === activeTeamId)?.name || 'All Teams'}</div>
        </div>
        <div style={summaryCard}>
          <div style={summaryLabel}>Average Progress</div>
          <div style={summaryValue}>{teams.length ? Math.round(teams.reduce((sum: number, team: any) => sum + Number(team.avg_progress || 0), 0) / teams.length) : 0}%</div>
        </div>
      </div>

      {isLoading ? (
        <div style={gridStyle}>
          {[1, 2, 3].map(i => <div key={i} style={skeletonCard} />)}
        </div>
      ) : (
        <div style={gridStyle}>
          {teams.map((team: any) => (
            <button
              key={team.id}
              onClick={() => {
                setActiveTeamId(String(team.id));
                navigate(`/manager/teams/${team.id}`);
              }}
              style={{
                ...teamCard,
                borderColor: String(team.id) === activeTeamId ? '#2563eb' : '#e2e8f0',
                boxShadow: String(team.id) === activeTeamId ? '0 18px 48px rgba(37, 99, 235, 0.12)' : teamCard.boxShadow,
              }}
            >
              <div style={teamCardTop}>
                <div style={{ minWidth: 0 }}>
                  <div style={teamName}>{team.name}</div>
                  <div style={teamDesc}>{team.description || 'No description available'}</div>
                </div>
                <div style={teamBadge}>{team.avg_progress ?? 0}%</div>
              </div>

              <div style={teamStats}>
                <Stat icon={Users} label="Members" value={team.member_count || 0} />
                <Stat icon={Target} label="Goals" value={team.goal_count || 0} />
                <Stat icon={TrendingUp} label="Progress" value={`${team.avg_progress ?? 0}%`} />
              </div>
            </button>
          ))}
          {!teams.length && (
            <div style={emptyState}>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>No teams yet</div>
              <div style={{ marginTop: 6 }}>Create your first team to start organizing members and goals.</div>
            </div>
          )}
        </div>
      )}

      {createOpen && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <div>
                <div style={eyebrowStyle}>Create Team</div>
                <h2 style={modalTitle}>New team workspace</h2>
              </div>
              <button onClick={() => setCreateOpen(false)} style={closeButton}><X size={18} /></button>
            </div>
            <div style={modalBody}>
              {error ? <div style={errorNotice}>{error}</div> : null}
              <label style={fieldLabel}>Team Name</label>
              <input value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} style={fieldInput} placeholder="e.g. Enterprise Growth" />
              <label style={{ ...fieldLabel, marginTop: 14 }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(current => ({ ...current, description: e.target.value }))} rows={4} style={fieldTextarea} placeholder="What does this team own?" />
            </div>
            <div style={modalFooter}>
              <button onClick={() => setCreateOpen(false)} style={ghostButton}>Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.name.trim() || createMutation.isPending} style={primaryButton}>
                {createMutation.isPending ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div style={statCard}>
      <Icon size={15} color="#64748b" />
      <div>
        <div style={statLabel}>{label}</div>
        <div style={statValue}>{value}</div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter', system-ui, sans-serif" };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' };
const eyebrowStyle: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' };
const titleStyle: React.CSSProperties = { marginTop: 8, fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 900, color: '#0f172a', lineHeight: 0.95 };
const subtitleStyle: React.CSSProperties = { marginTop: 10, maxWidth: 700, fontSize: 14, color: '#64748b', lineHeight: 1.7 };
const primaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 14, border: 'none', background: '#0f172a', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' };
const ghostButton: React.CSSProperties = { ...primaryButton, background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0' };
const summaryRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 };
const summaryCard: React.CSSProperties = { padding: 18, borderRadius: 20, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' };
const summaryLabel: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' };
const summaryValue: React.CSSProperties = { marginTop: 8, fontSize: 28, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 };
const teamCard: React.CSSProperties = { textAlign: 'left', padding: 20, borderRadius: 24, border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 18 };
const teamCardTop: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 };
const teamName: React.CSSProperties = { fontSize: 18, fontWeight: 900, color: '#0f172a' };
const teamDesc: React.CSSProperties = { marginTop: 6, fontSize: 13, color: '#64748b', lineHeight: 1.6 };
const teamBadge: React.CSSProperties = { flexShrink: 0, padding: '8px 10px', borderRadius: 999, background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' };
const teamStats: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 };
const statCard: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', padding: 10, borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0' };
const statLabel: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8' };
const statValue: React.CSSProperties = { marginTop: 2, fontSize: 13, fontWeight: 800, color: '#0f172a' };
const emptyState: React.CSSProperties = { padding: 24, borderRadius: 24, border: '1px dashed #cbd5e1', background: '#fff', color: '#64748b', textAlign: 'center' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(6px)' };
const modal: React.CSSProperties = { width: '100%', maxWidth: 560, background: '#fff', borderRadius: 24, boxShadow: '0 30px 80px rgba(15, 23, 42, 0.2)', overflow: 'hidden' };
const modalHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 24px', borderBottom: '1px solid #e2e8f0' };
const modalTitle: React.CSSProperties = { marginTop: 6, fontSize: 22, fontWeight: 900, color: '#0f172a' };
const closeButton: React.CSSProperties = { width: 36, height: 36, borderRadius: 999, border: 'none', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const modalBody: React.CSSProperties = { padding: 24 };
const modalFooter: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '0 24px 24px' };
const fieldLabel: React.CSSProperties = { display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 800, color: '#334155' };
const fieldInput: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' };
const fieldTextarea: React.CSSProperties = { ...fieldInput, resize: 'vertical', minHeight: 120 };
const skeletonCard: React.CSSProperties = { height: 220, borderRadius: 24, background: '#e2e8f0' };
const errorNotice: React.CSSProperties = { marginBottom: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 700 };
