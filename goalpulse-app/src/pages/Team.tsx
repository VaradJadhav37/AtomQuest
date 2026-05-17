// Team.tsx — Manager's view of direct reports' goal sheets
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import ManagerCheckinModal from '../components/ManagerCheckinModal';
import SharedGoalModal from '../components/SharedGoalModal';

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  APPROVED:         { bg: '#f0fdf4', color: '#16a34a', label: 'Approved' },
  PENDING_APPROVAL: { bg: '#eff6ff', color: '#2563eb', label: 'Pending Approval' },
  DRAFT:            { bg: '#f9fafb', color: '#6b7280', label: 'Draft' },
  REJECTED:         { bg: '#fef2f2', color: '#dc2626', label: 'Returned' },
  NOT_STARTED:      { bg: '#fff7ed', color: '#ea580c', label: 'Not Started' },
};

export default function Team() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [actionSheet, setActionSheet] = useState<{ id: number; action: 'APPROVED' | 'REJECTED' } | null>(null);
  const [reviewGoal, setReviewGoal] = useState<any>(null);
  const [sharedModalOpen, setSharedModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['teamSheets'],
    queryFn: () => api.get('/api/team/sheets').then(r => r.data),
    enabled: role === 'MANAGER' || role === 'ADMIN',
  });

  const approveMutation = useMutation({
    mutationFn: ({ sheetId, action, comment }: any) =>
      api.patch(`/api/goal-sheets/approve/${sheetId}`, { action, comment }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teamSheets'] }); setActionSheet(null); setComment(''); },
  });

  const unlockMutation = useMutation({
    mutationFn: ({ sheetId, reason }: { sheetId: number; reason?: string }) =>
      api.post(`/api/admin/unlock-sheet/${sheetId}`, { reason: reason || 'Unlocked for correction' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamSheets'] }),
  });


  if (role !== 'MANAGER' && role !== 'ADMIN') {
    return <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif", color: '#6b7280', textAlign: 'center' }}>This page is only accessible to Managers and Admins.</div>;
  }

  if (isLoading) return <LoadingState />;
  const { cycle, sheets } = data || {};

  return (
    <div className="dash-page-container" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="goal-sheet-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {cycle?.name} &nbsp;·&nbsp; Team Overview
          </div>
          <h1 className="goal-sheet-title" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '56px', fontWeight: '400', color: '#111827', letterSpacing: '0.03em', lineHeight: 1 }}>Team Goals</h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>Review and approve your direct reports' goal sheets.</p>
        </div>
        <div className="dash-header-actions">
          <button onClick={() => setSharedModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#111827', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <Users size={16} /> Assign Shared Goal
          </button>
        </div>
      </div>

      {/* Summary pills */}
      {sheets && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            { label: 'Total Reports', val: sheets.length, bg: '#f9fafb', color: '#374151' },
            { label: 'Approved', val: sheets.filter((s: any) => s.sheet?.status === 'APPROVED').length, bg: '#f0fdf4', color: '#16a34a' },
            { label: 'Pending Review', val: sheets.filter((s: any) => s.sheet?.status === 'PENDING_APPROVAL').length, bg: '#eff6ff', color: '#2563eb' },
            { label: 'Draft / Not Started', val: sheets.filter((s: any) => !s.sheet || s.sheet?.status === 'DRAFT').length, bg: '#fff7ed', color: '#ea580c' },
          ].map(pill => (
            <div key={pill.label} style={{ background: pill.bg, padding: '10px 18px', borderRadius: '12px', border: `1px solid ${pill.color}22` }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: pill.color, fontFamily: "'Bebas Neue', sans-serif", lineHeight: 1 }}>{pill.val}</div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{pill.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Employee cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!sheets?.length && <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No direct reports found.</div>}
        {sheets?.map((item: any) => {
          const { employee, sheet, goals, totalWeightage } = item;
          const status = sheet?.status || 'NOT_STARTED';
          const badge = STATUS_BADGE[status] || STATUS_BADGE.NOT_STARTED;
          const isOpen = expanded === employee.id;

          return (
            <div key={employee.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {/* Row header */}
              <div className="team-row-header" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : employee.id)}>
                {/* Avatar */}
                <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #3b82f6, #7c3aed)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '14px', flexShrink: 0, marginRight: '12px' }}>
                  {employee.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>{employee.name}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{employee.email} · {employee.department}</div>
                </div>
                <div className="team-actions-wrap" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {sheet && <div className="team-stats-label" style={{ fontSize: '12px', color: '#6b7280' }}>{totalWeightage}% weightage · {goals?.length || 0} goals</div>}
                  <span style={{ background: badge.bg, color: badge.color, borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: '700' }}>{badge.label}</span>
                  {status === 'PENDING_APPROVAL' && (
                    <div className="team-btn-group" style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => approveMutation.mutate({ sheetId: sheet.id, action: 'APPROVED', comment: 'Approved by manager.' })}
                        style={{ padding: '5px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
                        ✓ Approve
                      </button>
                      <button onClick={() => setActionSheet({ id: sheet.id, action: 'REJECTED' })}
                        style={{ padding: '5px 12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
                        ✗ Return
                      </button>
                    </div>
                  )}
                  {status === 'APPROVED' && role === 'ADMIN' && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm('Unlock this goal sheet for editing?')) unlockMutation.mutate({ sheetId: sheet.id, reason: 'Admin unlock for revisions' });
                      }}
                      style={{ padding: '5px 12px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#ea580c', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
                      Unlock
                    </button>
                  )}
                  {isOpen ? <ChevronDown size={16} color="#9ca3af" /> : <ChevronRight size={16} color="#9ca3af" />}
                </div>
              </div>

              {/* Expanded goals */}
              {isOpen && goals?.length > 0 && (
                <div style={{ borderTop: '1px solid #f3f4f6' }} className="table-responsive">
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Goal', 'Thrust Area', 'Target', 'Actual', 'Score', 'Status', 'Weight', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '10px 20px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {goals.map((g: any) => (
                        <tr key={g.id} onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: '600', color: '#111827', maxWidth: '220px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</div>
                          </td>
                          <td style={{ padding: '12px 20px' }}><span style={{ background: '#eff6ff', color: '#2563eb', borderRadius: '5px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>{g.thrust_area}</span></td>
                          <td style={{ padding: '12px 20px', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>{g.target_value}</td>
                          <td style={{ padding: '12px 20px', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", color: g.achievement ? '#16a34a' : '#9ca3af' }}>
                            {g.achievement?.actual_value || '—'}
                          </td>
                          <td style={{ padding: '12px 20px', fontSize: '14px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace", color: g.achievement?.score >= 80 ? '#16a34a' : g.achievement?.score >= 60 ? '#f59e0b' : '#ef4444' }}>
                            {g.achievement ? `${g.achievement.score}%` : '—'}
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ background: g.checkin?.status === 'COMPLETED' ? '#f0fdf4' : g.checkin?.status === 'ON_TRACK' ? '#eff6ff' : '#f9fafb', color: g.checkin?.status === 'COMPLETED' ? '#16a34a' : g.checkin?.status === 'ON_TRACK' ? '#2563eb' : '#6b7280', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: '700' }}>
                              {g.checkin?.status || 'Not Started'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 20px', fontSize: '14px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace" }}>{g.weightage}%</td>
                          <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                            {status === 'APPROVED' && g.achievement && (
                              <button onClick={() => setReviewGoal(g)} style={{ padding: '4px 10px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
                                Review
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {isOpen && (!goals || goals.length === 0) && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px', borderTop: '1px solid #f3f4f6' }}>
                  No goals created yet.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reject modal */}
      {actionSheet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', fontWeight: '400', color: '#111827', marginBottom: '12px', letterSpacing: '0.03em' }}>Return for Revision</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px', fontFamily: "'Inter', system-ui, sans-serif" }}>Provide feedback so the employee can revise their goals.</p>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} placeholder="Explain what needs to be changed..."
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontFamily: "'Inter', system-ui, sans-serif", outline: 'none', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setActionSheet(null)} style={{ flex: 1, padding: '10px', background: '#f9fafb', border: '1px solid #e8eaed', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: '600' }}>Cancel</button>
              <button onClick={() => approveMutation.mutate({ sheetId: actionSheet.id, action: 'REJECTED', comment })}
                style={{ flex: 1, padding: '10px', background: '#dc2626', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: '600' }}>
                Return Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewGoal && (
        <ManagerCheckinModal
          goal={reviewGoal}
          onClose={() => setReviewGoal(null)}
          onSave={() => { setReviewGoal(null); qc.invalidateQueries({ queryKey: ['teamSheets'] }); }}
        />
      )}

      {sharedModalOpen && sheets && (
        <SharedGoalModal
          employees={sheets.map((s: any) => s.employee)}
          onClose={() => setSharedModalOpen(false)}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: '28px 32px' }}>
      {[1, 2, 3].map(i => <div key={i} style={{ height: '70px', background: '#f3f4f6', borderRadius: '12px', marginBottom: '12px' }} />)}
    </div>
  );
}
