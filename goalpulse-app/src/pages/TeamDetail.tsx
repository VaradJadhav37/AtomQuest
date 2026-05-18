import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowLeft, Check, Mail, Target, TrendingUp, Users, X, Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import GoalWizard from '../components/GoalWizard';

type TabKey = 'members' | 'goals' | 'analytics';

export default function TeamDetail() {
  const { teamId } = useParams();
  const qc = useQueryClient();
  const { role } = useAuth();
  const [tab, setTab] = useState<TabKey>('members');
  const [error, setError] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const canManageTeam = role === 'MANAGER' || role === 'ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['teamDetail', teamId],
    queryFn: () => api.get(`/api/teams/${teamId}`).then(r => r.data),
    enabled: !!teamId && (role === 'MANAGER' || role === 'ADMIN' || role === 'EMPLOYEE'),
  });

  const { data: goalsData } = useQuery({
    queryKey: ['teamGoals', teamId],
    queryFn: () => api.get(`/api/teams/${teamId}/goals`).then(r => r.data),
    enabled: !!teamId && (role === 'MANAGER' || role === 'ADMIN' || role === 'EMPLOYEE'),
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['teamAnalytics', teamId],
    queryFn: () => api.get(`/api/teams/${teamId}/analytics`).then(r => r.data),
    enabled: !!teamId && (role === 'MANAGER' || role === 'ADMIN' || role === 'EMPLOYEE'),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: number) => api.post(`/api/teams/${teamId}/members/requests/${requestId}/approve`),
    onSuccess: async () => {
      setError('');
      await invalidate();
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to approve request.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, rejection_reason }: { requestId: number; rejection_reason?: string }) =>
      api.post(`/api/teams/${teamId}/members/requests/${requestId}/reject`, { rejection_reason }),
    onSuccess: async () => {
      setError('');
      await invalidate();
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to reject request.'),
  });

  const removeMutation = useMutation({
    mutationFn: (employeeId: number) => api.delete(`/api/teams/${teamId}/members/${employeeId}`),
    onSuccess: async () => {
      setError('');
      await invalidate();
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to remove member.'),
  });

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['teamDetail', teamId] }),
      qc.invalidateQueries({ queryKey: ['teamGoals', teamId] }),
      qc.invalidateQueries({ queryKey: ['teamAnalytics', teamId] }),
      qc.invalidateQueries({ queryKey: ['managedTeams'] }),
    ]);
  };

  const deleteGoalMutation = useMutation({
    mutationFn: (goalId: number) => api.delete(`/api/teams/${teamId}/goals/${goalId}`),
    onMutate: async (goalId: number) => {
      await qc.cancelQueries({ queryKey: ['teamGoals', teamId] });
      const previous = qc.getQueryData(['teamGoals', teamId]);
      qc.setQueryData(['teamGoals', teamId], (old: any) => ({
        ...old,
        goals: (old?.goals || []).filter((g: any) => Number(g.id) !== Number(goalId)),
      }));
      return { previous };
    },
    onSuccess: async () => {
      setError('');
      await invalidate();
    },
    onError: (err: any, _goalId, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(['teamGoals', teamId], ctx.previous);
      setError(err?.response?.data?.error || 'Failed to delete goal.');
    },
  });


  const pendingRequests = data?.pendingRequests || [];
  const members = data?.members || [];
  const goals = goalsData?.goals || [];
  const teamGoalsTotalWeightage = goals.reduce((sum: number, g: any) => sum + Number(g.weightage || 0), 0);
  const remainingTeamWeightage = Math.max(0, 100 - teamGoalsTotalWeightage + Number(editingGoal?.weightage || 0));
  const analytics = analyticsData?.summary || {};
  const scoreBars = useMemo(() => goals.map((goal: any) => ({
    name: goal.title.length > 24 ? `${goal.title.slice(0, 24)}...` : goal.title,
    score: goal.achievement?.score || 0,
    fill: goal.achievement?.score >= 80 ? '#16a34a' : goal.achievement?.score >= 60 ? '#2563eb' : '#d97706',
  })), [goals]);

  if (role !== 'MANAGER' && role !== 'ADMIN' && role !== 'EMPLOYEE') {
    return <div style={emptyState}>You do not have access to this page.</div>;
  }

  if (isLoading) {
    return (
      <div className="page-container fade-in" style={{ padding: '32px' }}>
        <div className="skeleton" style={{ height: '140px', borderRadius: '24px', marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
          <div className="skeleton" style={{ height: '400px', borderRadius: '24px' }} />
          <div className="skeleton" style={{ height: '400px', borderRadius: '24px' }} />
        </div>
      </div>
    );
  }

  if (!data?.team) {
    return <div style={emptyState}>Team not found.</div>;
  }

  const team = data.team;

  return (
    <div style={pageStyle}>
      <button onClick={() => window.history.back()} style={backButton}>
        <ArrowLeft size={16} />
        Back
      </button>

      <div style={hero}>
        <div>
          <div style={eyebrow}>Team Detail</div>
          <h1 style={title}>{team.name}</h1>
          <p style={subtitle}>{team.description || 'No team description provided.'}</p>
        </div>
        <div style={statStrip}>
          <Stat label="Members" value={analytics.member_count ?? members.length} icon={Users} />
          <Stat label="Goals" value={analytics.goal_count ?? goals.length} icon={Target} />
          <Stat label="Avg Progress" value={`${analytics.avg_progress ?? 0}%`} icon={TrendingUp} />
        </div>
      </div>

      <div style={tabsRow}>
        {[
          { key: 'members' as const, label: `Members (${members.length})` },
          { key: 'goals' as const, label: `Goals (${goals.length})` },
          { key: 'analytics' as const, label: 'Analytics' },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            style={{
              ...tabButton,
              background: tab === item.key ? '#0f172a' : '#fff',
              color: tab === item.key ? '#fff' : '#475569',
              borderColor: tab === item.key ? '#0f172a' : '#e2e8f0',
            }}
          >
            {item.label}
            {item.key === 'members' && pendingRequests.length > 0 && (
              <span style={badge}>{pendingRequests.length} pending</span>
            )}
          </button>
        ))}
      </div>
      {error ? <div style={errorNotice}>{error}</div> : null}

      {tab === 'members' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <section style={card}>
            <div style={sectionHeader}>
              <div>
                <div style={sectionEyebrow}>Pending Requests</div>
                <div style={sectionTitle}>Review join requests</div>
              </div>
              <span style={badge}>{pendingRequests.length} waiting</span>
            </div>
            {pendingRequests.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingRequests.map((request: any) => (
                  <div key={request.id} style={requestRow}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{request.employee?.name}</div>
                      <div style={{ marginTop: 4, fontSize: 13, color: '#64748b' }}>{request.employee?.email} · Requested {new Date(request.requested_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {canManageTeam && (
                        <>
                          <button onClick={() => approveMutation.mutate(request.id)} style={approveButton}>
                            <Check size={14} />
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              const reason = window.prompt('Optional rejection reason', '');
                              if (reason === null) return;
                              rejectMutation.mutate({ requestId: request.id, rejection_reason: reason });
                            }}
                            style={rejectButton}
                          >
                            <X size={14} />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyNotice text="No pending requests right now." />
            )}
          </section>

          <section style={card}>
            <div style={sectionHeader}>
              <div>
                <div style={sectionEyebrow}>Members</div>
                <div style={sectionTitle}>Active roster</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={table}>
                <thead>
                  <tr>
                    {['Name', 'Email', 'Joined', 'Status', 'Action'].map(header => (
                      <th key={header} style={th}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member: any) => (
                    <tr key={member.id}>
                      <td style={tdStrong}>{member.employee?.name}</td>
                      <td style={td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Mail size={14} color="#64748b" />
                          {member.employee?.email}
                        </span>
                      </td>
                      <td style={td}>{new Date(member.joined_at).toLocaleDateString()}</td>
                      <td style={td}>
                        <span style={memberBadge}>{member.status}</span>
                      </td>
                      <td style={td}>
                        {!canManageTeam ? (
                          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>Read Only</span>
                        ) : Number(member.employee_id) === Number(team.manager_id) ? (
                          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>Team Manager</span>
                        ) : (
                          <button
                            onClick={() => {
                              if (window.confirm(`Remove ${member.employee?.name || 'this member'} from the team?`)) {
                                removeMutation.mutate(member.employee_id);
                              }
                            }}
                            style={dangerButton}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!members.length && (
                    <tr>
                      <td colSpan={5} style={{ padding: 24 }}>
                        <EmptyNotice text="No active members yet." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === 'goals' && (
        <section style={card}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionEyebrow}>Goals</div>
              <div style={sectionTitle}>Team-scoped goals</div>
            </div>
            {canManageTeam && (
              <button
                onClick={() => { setEditingGoal(null); setShowWizard(true); }}
                style={{ ...approveButton, padding: '8px 12px' }}
              >
                <Plus size={14} />
                Add Team Goal
              </button>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  {['Goal', 'Owner', 'Thrust', 'Target', 'Score', 'Weight', 'Actions'].map(header => (
                    <th key={header} style={th}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {goals.map((goal: any) => (
                  <tr key={goal.id}>
                    <td style={tdStrong}>{goal.title}</td>
                    <td style={td}>{goal.employee?.name || 'N/A'}</td>
                    <td style={td}>{goal.thrust_area}</td>
                    <td style={tdMono}>{goal.target_value}</td>
                    <td style={tdMono}>{goal.checkin?.status || 'NOT_STARTED'} · {goal.achievement?.score ?? '—'}%</td>
                    <td style={tdMono}>{goal.weightage}%</td>
                    <td style={td}>
                      {canManageTeam ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => { setEditingGoal(goal); setShowWizard(true); }}
                            style={iconButton}
                            title="Edit Goal"
                          >
                            <Pencil size={14} color="#64748b" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this team goal?')) {
                                deleteGoalMutation.mutate(goal.id);
                              }
                            }}
                            style={{ ...iconButton }}
                            title="Delete Goal"
                          >
                            <Trash2 size={14} color="#ef4444" />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>Read Only</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!goals.length && (
                  <tr>
                    <td colSpan={7} style={{ padding: 24 }}>
                      <EmptyNotice text="No team goals assigned yet." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'analytics' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={statsGrid}>
            <Metric label="Active Members" value={analytics.member_count ?? members.length} />
            <Metric label="Goal Count" value={analytics.goal_count ?? goals.length} />
            <Metric label="Avg Progress" value={`${analytics.avg_progress ?? 0}%`} />
            <Metric label="Completion" value={`${analytics.completion_rate ?? 0}%`} />
          </div>

          <section style={card}>
            <div style={sectionHeader}>
              <div>
                <div style={sectionEyebrow}>Progress Chart</div>
                <div style={sectionTitle}>Goal score distribution</div>
              </div>
            </div>
            <div style={{ width: '100%', height: 320 }}>
              {scoreBars.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreBars} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} height={70} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
                    <Tooltip />
                    <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                      {scoreBars.map((entry: any) => <Cell key={entry.name} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyNotice text="Add team goals to visualize progress." />
              )}
            </div>
          </section>
        </div>
      )}

      {showWizard && (
        <GoalWizard
          onClose={() => { setShowWizard(false); setEditingGoal(null); }}
          onSave={async () => {
            setShowWizard(false);
            setEditingGoal(null);
            await invalidate();
          }}
          remainingWeightage={remainingTeamWeightage}
          editGoal={editingGoal}
          teamGoalMode
          teamId={teamId}
          members={members}
        />
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div style={miniStat}>
      <Icon size={16} color="#64748b" />
      <div>
        <div style={miniLabel}>{label}</div>
        <div style={miniValue}>{value}</div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={metricCard}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
    </div>
  );
}

function EmptyNotice({ text }: { text: string }) {
  return <div style={emptyNotice}>{text}</div>;
}

const pageStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 18, fontFamily: "'Inter', system-ui, sans-serif" };
const backButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content', border: 'none', background: 'transparent', color: '#64748b', fontWeight: 800, cursor: 'pointer' };
const hero: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' };
const eyebrow: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' };
const title: React.CSSProperties = { marginTop: 8, fontSize: 'clamp(38px, 6vw, 60px)', fontWeight: 900, lineHeight: 0.95, color: '#0f172a' };
const subtitle: React.CSSProperties = { marginTop: 10, maxWidth: 720, fontSize: 14, lineHeight: 1.7, color: '#64748b' };
const statStrip: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, flex: 1, minWidth: 280 };
const miniStat: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', padding: 14, borderRadius: 18, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' };
const miniLabel: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8' };
const miniValue: React.CSSProperties = { marginTop: 2, fontSize: 18, fontWeight: 900, color: '#0f172a' };
const tabsRow: React.CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap' };
const tabButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 800, cursor: 'pointer' };
const badge: React.CSSProperties = { padding: '4px 8px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 22, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' };
const sectionHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 };
const sectionEyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' };
const sectionTitle: React.CSSProperties = { marginTop: 6, fontSize: 20, fontWeight: 900, color: '#0f172a' };
const requestRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: 16, borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' };
const approveButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: '#0f172a', color: '#fff', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 800 };
const rejectButton: React.CSSProperties = { ...approveButton, background: '#fee2e2', color: '#b91c1c' };
const iconButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer' };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', minWidth: 720 };
const th: React.CSSProperties = { textAlign: 'left', padding: '12px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' };
const td: React.CSSProperties = { padding: '14px 10px', borderBottom: '1px solid #eef2f7', color: '#334155', fontSize: 13 };
const tdStrong: React.CSSProperties = { ...td, fontWeight: 800, color: '#0f172a' };
const tdMono: React.CSSProperties = { ...td, fontFamily: "'JetBrains Mono', monospace" };
const memberBadge: React.CSSProperties = { display: 'inline-flex', padding: '5px 10px', borderRadius: 999, background: '#ecfdf5', color: '#166534', fontSize: 11, fontWeight: 800, textTransform: 'capitalize', whiteSpace: 'nowrap' };
const dangerButton: React.CSSProperties = { border: 'none', background: '#fee2e2', color: '#b91c1c', padding: '9px 12px', borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: 'pointer' };
const statsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 };
const metricCard: React.CSSProperties = { padding: 18, borderRadius: 18, background: '#fff', border: '1px solid #e2e8f0' };
const metricLabel: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8' };
const metricValue: React.CSSProperties = { marginTop: 8, fontSize: 28, fontWeight: 900, color: '#0f172a' };
const emptyNotice: React.CSSProperties = { padding: 20, borderRadius: 18, background: '#f8fafc', border: '1px dashed #cbd5e1', color: '#64748b', textAlign: 'center' };
const emptyState: React.CSSProperties = { padding: 40, textAlign: 'center', color: '#64748b' };
const errorNotice: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 700 };
