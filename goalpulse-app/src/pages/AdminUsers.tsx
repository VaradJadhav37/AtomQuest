import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Search, UserX, UserCheck, X } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function AdminUsers() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState('');

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => api.get('/api/admin/users').then(r => r.data),
    enabled: role === 'ADMIN',
  });

  const { data: teamRequests } = useQuery({
    queryKey: ['adminTeamRequests'],
    queryFn: () => api.get('/api/admin/team-requests?status=pending').then(r => r.data),
    enabled: role === 'ADMIN',
  });

  const { data: teamsData } = useQuery({
    queryKey: ['adminTeams'],
    queryFn: () => api.get('/api/teams').then(r => r.data),
    enabled: role === 'ADMIN',
  });

  const addToTeamMutation = useMutation({
    mutationFn: ({ userId, teamId }: { userId: number; teamId: number }) =>
      api.post(`/api/admin/users/${userId}/add-to-team`, { team_id: teamId }),
    onSuccess: async () => {
      setError('');
      await qc.invalidateQueries({ queryKey: ['adminUsers'] });
      await qc.invalidateQueries({ queryKey: ['adminTeamRequests'] });
      await qc.invalidateQueries({ queryKey: ['adminTeams'] });
      setSelectedUser(null);
      setTeamId('');
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to add user to team.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: number) => api.patch(`/api/admin/users/${userId}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminUsers'] }),
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to deactivate user.'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (userId: number) => api.patch(`/api/admin/users/${userId}/reactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminUsers'] }),
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to reactivate user.'),
  });

  const approveRequestMutation = useMutation({
    mutationFn: ({ teamId, requestId }: { teamId: number; requestId: number }) =>
      api.post(`/api/teams/${teamId}/members/requests/${requestId}/approve`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['adminTeamRequests'] });
      await qc.invalidateQueries({ queryKey: ['adminUsers'] });
      await qc.invalidateQueries({ queryKey: ['adminTeams'] });
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: ({ teamId, requestId, rejection_reason }: { teamId: number; requestId: number; rejection_reason?: string }) =>
      api.post(`/api/teams/${teamId}/members/requests/${requestId}/reject`, { rejection_reason }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['adminTeamRequests'] });
      await qc.invalidateQueries({ queryKey: ['adminUsers'] });
      await qc.invalidateQueries({ queryKey: ['adminTeams'] });
    },
  });

  const users = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = Array.isArray(usersData) ? usersData : (usersData?.users || []);
    if (!term) return list;
    return list.filter((user: any) =>
      [user.name, user.email, user.department, user.role]
        .filter(Boolean)
        .some((value: string) => String(value).toLowerCase().includes(term))
    );
  }, [search, usersData]);

  if (role !== 'ADMIN') {
    return <div style={empty}>This page is only available to admins.</div>;
  }

  return (
    <div style={pageStyle}>
      <div style={header}>
        <div>
          <div style={eyebrow}>User Management</div>
          <h1 style={title}>Employee lifecycle control</h1>
          <p style={subtitle}>Approve requests, add employees to teams, and deactivate accounts without losing history.</p>
        </div>
        <div style={headerActions}>
          <Stat label="Users" value={usersData?.users?.length || 0} />
          <Stat label="Pending requests" value={teamRequests?.requests?.length || 0} />
        </div>
      </div>

      <section style={card}>
        {error ? <div style={errorBanner}>{error}</div> : null}
        <div style={sectionHeader}>
          <div>
            <div style={sectionEyebrow}>Pending Requests</div>
            <div style={sectionTitle}>Team join approvals</div>
          </div>
          <span style={badge}>{teamRequests?.requests?.length || 0} waiting</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(teamRequests?.requests || []).map((request: any) => (
            <div key={request.id} style={row}>
              <div>
                <div style={rowTitle}>{request.employee?.name}</div>
                <div style={rowSub}>{request.employee?.email} · {request.team?.name}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => approveRequestMutation.mutate({ teamId: request.team_id, requestId: request.id })} style={approveButton}>
                  <Check size={14} />
                  Approve
                </button>
                <button
                  onClick={() => {
                    const reason = window.prompt('Rejection reason (optional)', '');
                    if (reason === null) return;
                    rejectRequestMutation.mutate({ teamId: request.team_id, requestId: request.id, rejection_reason: reason });
                  }}
                  style={rejectButton}
                >
                  <X size={14} />
                  Reject
                </button>
              </div>
            </div>
          ))}
          {!teamRequests?.requests?.length && <Empty text="No pending join requests." />}
        </div>
      </section>

      <section style={card}>
        <div style={sectionHeader}>
          <div>
            <div style={sectionEyebrow}>Directory</div>
            <div style={sectionTitle}>All users</div>
          </div>
          <div style={searchWrap}>
            <Search size={16} color="#64748b" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users" style={searchInput} />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Teams', 'Actions'].map(headerText => (
                  <th key={headerText} style={th}>{headerText}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td colSpan={6} style={{ padding: '14px 10px' }}>
                      <div className="skeleton" style={{ height: '24px', borderRadius: '8px', width: '100%' }} />
                    </td>
                  </tr>
                ))
              ) : users.map((user: any) => (
                <tr key={user.id}>
                  <td style={tdStrong}>{user.name}</td>
                  <td style={td}>{user.email}</td>
                  <td style={td}><span style={pill}>{user.role}</span></td>
                  <td style={td}><span style={user.is_active === false ? inactivePill : activePill}>{user.is_active === false ? 'Inactive' : 'Active'}</span></td>
                  <td style={td}>{user.teams?.length || 0}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => { setSelectedUser(user); setTeamId(teamsData?.teams?.[0]?.id ? String(teamsData.teams[0].id) : ''); }} style={actionButton}>
                        <Plus size={14} />
                        Add to Team
                      </button>
                      {user.is_active === false ? (
                        <button onClick={() => reactivateMutation.mutate(user.id)} style={actionButton}>
                          <UserCheck size={14} />
                          Reactivate
                        </button>
                      ) : (
                        <button onClick={() => deactivateMutation.mutate(user.id)} style={dangerButton}>
                          <UserX size={14} />
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedUser && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <div>
                <div style={eyebrow}>Add to Team</div>
                <h2 style={modalTitle}>{selectedUser.name}</h2>
              </div>
              <button onClick={() => setSelectedUser(null)} style={closeButton}><X size={18} /></button>
            </div>
            <div style={modalBody}>
              <label style={fieldLabel}>Select Team</label>
              <select value={teamId} onChange={e => setTeamId(e.target.value)} style={fieldInput}>
                <option value="">Choose a team</option>
                {(teamsData?.teams || []).map((team: any) => (
                  <option key={team.id} value={String(team.id)}>{team.name}</option>
                ))}
              </select>
            </div>
            <div style={modalFooter}>
              <button onClick={() => setSelectedUser(null)} style={ghostButton}>Cancel</button>
              <button
                onClick={() => addToTeamMutation.mutate({ userId: selectedUser.id, teamId: Number(teamId) })}
                disabled={!teamId || addToTeamMutation.isPending}
                style={primaryButton}
              >
                {addToTeamMutation.isPending ? 'Adding...' : 'Add to Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={statBox}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={empty}>{text}</div>;
}

const pageStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 18, fontFamily: "'Inter', system-ui, sans-serif" };
const header: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' };
const eyebrow: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' };
const title: React.CSSProperties = { marginTop: 8, fontSize: 'clamp(38px, 6vw, 60px)', fontWeight: 900, color: '#0f172a', lineHeight: 0.95 };
const subtitle: React.CSSProperties = { marginTop: 10, fontSize: 14, color: '#64748b', lineHeight: 1.7, maxWidth: 760 };
const headerActions: React.CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap' };
const statBox: React.CSSProperties = { padding: 16, borderRadius: 18, background: '#fff', border: '1px solid #e2e8f0', minWidth: 150 };
const statLabel: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8' };
const statValue: React.CSSProperties = { marginTop: 6, fontSize: 28, fontWeight: 900, color: '#0f172a' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 22, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' };
const sectionHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' };
const sectionEyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' };
const sectionTitle: React.CSSProperties = { marginTop: 6, fontSize: 20, fontWeight: 900, color: '#0f172a' };
const badge: React.CSSProperties = { padding: '6px 10px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' };
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' };
const rowTitle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: '#0f172a' };
const rowSub: React.CSSProperties = { marginTop: 4, fontSize: 13, color: '#64748b' };
const approveButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: '#0f172a', color: '#fff', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 800 };
const rejectButton: React.CSSProperties = { ...approveButton, background: '#fee2e2', color: '#b91c1c' };
const actionButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: '#eff6ff', color: '#1d4ed8', padding: '9px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 12, fontWeight: 800 };
const dangerButton: React.CSSProperties = { ...actionButton, background: '#fee2e2', color: '#b91c1c' };
const activePill: React.CSSProperties = { padding: '5px 10px', borderRadius: 999, background: '#ecfdf5', color: '#166534', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' };
const inactivePill: React.CSSProperties = { ...activePill, background: '#fef2f2', color: '#b91c1c' };
const pill: React.CSSProperties = { padding: '5px 10px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', minWidth: 860 };
const th: React.CSSProperties = { textAlign: 'left', padding: '12px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' };
const td: React.CSSProperties = { padding: '14px 10px', borderBottom: '1px solid #eef2f7', color: '#334155', fontSize: 13 };
const tdStrong: React.CSSProperties = { ...td, fontWeight: 800, color: '#0f172a' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(6px)' };
const modal: React.CSSProperties = { width: '100%', maxWidth: 520, background: '#fff', borderRadius: 24, boxShadow: '0 30px 80px rgba(15, 23, 42, 0.2)', overflow: 'hidden' };
const modalHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 24px', borderBottom: '1px solid #e2e8f0' };
const modalTitle: React.CSSProperties = { marginTop: 6, fontSize: 22, fontWeight: 900, color: '#0f172a' };
const closeButton: React.CSSProperties = { width: 36, height: 36, borderRadius: 999, border: 'none', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const modalBody: React.CSSProperties = { padding: 24 };
const modalFooter: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '0 24px 24px' };
const fieldLabel: React.CSSProperties = { display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 800, color: '#334155' };
const fieldInput: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' };
const ghostButton: React.CSSProperties = { ...actionButton, background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0' };
const primaryButton: React.CSSProperties = { ...actionButton, background: '#0f172a', color: '#fff' };
const empty: React.CSSProperties = { padding: 18, borderRadius: 16, background: '#f8fafc', border: '1px dashed #cbd5e1', color: '#64748b', textAlign: 'center' };
const searchWrap: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, border: '1px solid #cbd5e1', background: '#f8fafc', minWidth: 260 };
const searchInput: React.CSSProperties = { width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 14 };
const errorBanner: React.CSSProperties = { marginBottom: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 700 };
