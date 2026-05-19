import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Target, Edit2, Trash2, Sparkles, CheckCircle, Clock, XCircle, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../lib/api';
import GoalWizard from '../components/GoalWizard';
import CheckinWizard from '../components/CheckinWizard';
import PerformanceSummaryModal from '../components/PerformanceSummaryModal';
import { normalizeUomType } from '../lib/uom';
const STATUS_COLORS: Record<string, { bg: string; color: string; label: string; icon: any }> = {
  DRAFT:            { bg: '#f3f4f6', color: '#6b7280', label: 'Draft', icon: Clock },
  PENDING_APPROVAL: { bg: '#eff6ff', color: '#2563eb', label: 'Pending Approval', icon: Clock },
  APPROVED:         { bg: '#f0fdf4', color: '#16a34a', label: 'Approved & Locked', icon: CheckCircle },
  REJECTED:         { bg: '#fef2f2', color: '#dc2626', label: 'Returned for Revision', icon: XCircle },
};

const S: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100%' },
  card: { background: '#fff', border: '1px solid #e8eaed', borderRadius: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  th: { padding: '12px 20px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#9ca3af', textAlign: 'left' as const },
  td: { padding: '14px 20px', fontSize: '14px', color: '#374151', borderTop: '1px solid #f3f4f6' },
};

function triggerPdfDownload(pdf: jsPDF, filename: string) {
  const pdfBytes = pdf.output('arraybuffer');
  const blob = new Blob([pdfBytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function GoalSheet() {
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<any>(null);
  const [checkinGoal, setCheckinGoal] = useState<any>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['myGoalSheet'],
    queryFn: () => api.get('/api/goal-sheets/mine').then(r => r.data),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const submitMutation = useMutation({
    mutationFn: (sheetId: number) => api.post(`/api/goal-sheets/submit/${sheetId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myGoalSheet'] }),
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (goalId: number) => api.delete(`/api/goals/${goalId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myGoalSheet'] }),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load goal sheet." />;
  if (!data?.sheet) return <ErrorState message="No goal sheet found for the current cycle." />;

  const { cycle, sheet } = data;
  const { goals, status } = sheet;
  const teamGoals = goals.filter((g: any) => g.team_id != null);
  const individualGoals = goals.filter((g: any) => g.team_id == null);
  const exportPDF = async () => {
    const el = document.getElementById('goal-sheet-content');
    if (!el) return;
    try {
      await new Promise(requestAnimationFrame);
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      triggerPdfDownload(pdf, `GoalKeeper_Performance_${sheet.employee?.name || 'Sheet'}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setPdfError('Failed to generate PDF. Please try again.');
      setTimeout(() => setPdfError(null), 4000);
    }
  };

  const teamGoalsWeightage = teamGoals.reduce((s: number, g: any) => s + Number(g.weightage || 0), 0);
  const individualGoalsWeightage = individualGoals.reduce((s: number, g: any) => s + Number(g.weightage || 0), 0);

  const isLocked = status === 'APPROVED' || status === 'PENDING_APPROVAL';
  // Submit only requires individual goal pool to be 100% (team goals are a separate optional budget)
  const canSubmit = !isLocked && individualGoalsWeightage === 100 && individualGoals.length > 0;
  // Individual goal cap: only count individual goals toward individual budget
  const canCreateGoal = !isLocked && individualGoalsWeightage < 100 && individualGoals.length < 8;
  const statusInfo = STATUS_COLORS[status] || STATUS_COLORS.DRAFT;
  const StatusIcon = statusInfo.icon;

  return (
    <div style={S.page}>
      {/* PDF Error Toast */}
      {pdfError && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, fontFamily: "'Inter', system-ui, sans-serif", boxShadow: '0 8px 24px rgba(220,38,38,0.3)', zIndex: 9999 }}>
          {pdfError}
        </div>
      )}
      {/* Header */}
      <div className="goal-sheet-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', gap: 16 }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {cycle.name} &nbsp;·&nbsp; {cycle.status === 'OPEN' ? '🟢 Cycle Open' : '🔴 Cycle Closed'}
          </div>
          <h1 className="goal-sheet-title" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: '400', color: '#111827', letterSpacing: '0.03em', lineHeight: 1 }}>My Goals</h1>
          <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>{cycle.open_date} → {cycle.close_date}</div>
        </div>

        <div className="dash-header-actions">
          {/* Premium side-by-side dual pool progress widget */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginRight: '20px', background: '#f8fafc', padding: '10px 18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            {teamGoals.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', width: '140px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team Goals</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: teamGoalsWeightage > 100 ? '#dc2626' : teamGoalsWeightage === 100 ? '#16a34a' : '#475569' }}>
                    {teamGoalsWeightage}%
                  </span>
                </div>
                <div style={{ width: '140px', height: '5px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(teamGoalsWeightage, 100)}%`, background: teamGoalsWeightage > 100 ? '#ef4444' : teamGoalsWeightage === 100 ? '#22c55e' : '#8b5cf6', borderRadius: '999px', transition: 'width 0.6s ease' }} />
                </div>
              </div>
            )}
            {teamGoals.length > 0 && <div style={{ width: '1px', height: '24px', background: '#cbd5e1' }} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', width: '140px' }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Individual</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: individualGoalsWeightage > 100 ? '#dc2626' : individualGoalsWeightage === 100 ? '#16a34a' : '#475569' }}>
                  {individualGoalsWeightage}%
                </span>
              </div>
              <div style={{ width: '140px', height: '5px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(individualGoalsWeightage, 100)}%`, background: individualGoalsWeightage > 100 ? '#ef4444' : individualGoalsWeightage === 100 ? '#22c55e' : '#3b82f6', borderRadius: '999px', transition: 'width 0.6s ease' }} />
              </div>
            </div>
          </div>

          <button onClick={exportPDF}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#fff', color: '#111827', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <FileDown size={16} /> Export PDF
          </button>

          <button onClick={() => setSummaryOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <Sparkles size={16} /> Performance Summary
          </button>

          <button onClick={() => setWizardOpen(true)} disabled={!canCreateGoal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: canCreateGoal ? '#111827' : '#f3f4f6', color: canCreateGoal ? '#fff' : '#9ca3af', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: canCreateGoal ? 'pointer' : 'not-allowed', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <Plus size={16} /> New Goal
          </button>
        </div>
      </div>

      <div id="goal-sheet-content" style={{ background: '#fafafa', padding: '16px', borderRadius: '16px', margin: '-16px' }}>
        {/* Status banner */}
        <div style={{ ...S.card, padding: '14px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: statusInfo.bg, borderColor: statusInfo.color + '33' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <StatusIcon size={20} color={statusInfo.color} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>{statusInfo.label}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              {status === 'DRAFT' && `Add individual goals and ensure your individual pool reaches 100%, then submit for approval. Team goals are tracked separately.`}
              {status === 'PENDING_APPROVAL' && 'Your goal sheet is with your manager for review.'}
              {status === 'APPROVED' && 'Goal sheet approved. You can now log actuals during check-in.'}
              {status === 'REJECTED' && 'Your manager returned the sheet. Edit and resubmit.'}
              {cycle?.window && !cycle.window.canWrite && ` ${cycle.window.reason}`}
            </div>
          </div>
        </div>
        {status === 'DRAFT' && (
          <button onClick={() => submitMutation.mutate(sheet.id)} disabled={!canSubmit || submitMutation.isPending}
            style={{ padding: '9px 18px', background: canSubmit ? '#111827' : '#f3f4f6', color: canSubmit ? '#fff' : '#9ca3af', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: "'Inter', system-ui, sans-serif" }}>
            {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
          </button>
        )}
      </div>

      {/* Goals table */}
      <div style={{ ...S.card, overflow: 'hidden' }}>
        {goals.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Target size={40} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#9ca3af', marginBottom: '4px' }}>No goals yet</div>
            <div style={{ fontSize: '13px', color: '#d1d5db' }}>Click "+ New Goal" to add your first goal.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={S.th}>Goal Title</th>
                <th style={S.th}>Thrust Area</th>
                <th style={S.th}>UoM</th>
                <th style={S.th}>Target</th>
                <th style={{ ...S.th, textAlign: 'center' as const }}>Weight</th>
                <th style={{ ...S.th, textAlign: 'right' as const }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teamGoals.length > 0 && (
                <>
                  <tr style={{ background: '#f0f4ff' }}>
                    <td colSpan={6} style={{ padding: '8px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b3fce', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team Goals</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: teamGoalsWeightage > 100 ? '#dc2626' : teamGoalsWeightage === 100 ? '#16a34a' : '#7c3aed', fontFamily: "'JetBrains Mono', monospace" }}>
                          {teamGoalsWeightage}% / 100%
                        </span>
                      </div>
                    </td>
                  </tr>
                  {teamGoals.map((g: any) => (
                    <tr key={g.id} onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ ...S.td, fontWeight: '600', color: '#111827', maxWidth: '280px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</div>
                        {g.description && <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.description}</div>}
                      </td>
                      <td style={S.td}>
                        <span style={{ background: '#eff6ff', color: '#2563eb', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: '600' }}>{g.thrust_area}</span>
                      </td>
                      <td style={{ ...S.td, fontSize: '12px', color: '#6b7280' }}>{normalizeUomType(g.uom_type)}</td>
                      <td style={{ ...S.td, fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{g.target_value}</td>
                      <td style={{ ...S.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', fontSize: '15px', color: '#111827' }}>{g.weightage}%</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          {status === 'APPROVED' ? (
                            <button onClick={() => setCheckinGoal(g)} style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4f46e5', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
                              Check-in
                            </button>
                          ) : (
                            <>
                              <button disabled={isLocked} onClick={() => setEditGoal(g)} style={{ background: 'none', border: 'none', cursor: isLocked ? 'not-allowed' : 'pointer', color: '#9ca3af', opacity: isLocked ? 0.4 : 1, padding: '4px' }}
                                title="Edit">
                                <Edit2 size={14} />
                              </button>
                              <button disabled={isLocked} onClick={() => { if (confirm('Delete this goal?')) deleteGoalMutation.mutate(g.id); }}
                                style={{ background: 'none', border: 'none', cursor: isLocked ? 'not-allowed' : 'pointer', color: '#f87171', opacity: isLocked ? 0.4 : 1, padding: '4px' }}
                                title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}
              {individualGoals.length > 0 && (
                <>
                  <tr style={{ background: '#f0fdf4' }}>
                    <td colSpan={6} style={{ padding: '8px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Individual Goals</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: individualGoalsWeightage > 100 ? '#dc2626' : individualGoalsWeightage === 100 ? '#16a34a' : '#0369a1', fontFamily: "'JetBrains Mono', monospace" }}>
                          {individualGoalsWeightage}% / 100%
                        </span>
                      </div>
                    </td>
                  </tr>
                  {individualGoals.map((g: any) => (
                    <tr key={g.id} onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ ...S.td, fontWeight: '600', color: '#111827', maxWidth: '280px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</div>
                        {g.description && <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.description}</div>}
                      </td>
                      <td style={S.td}>
                        <span style={{ background: '#eff6ff', color: '#2563eb', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: '600' }}>{g.thrust_area}</span>
                      </td>
                      <td style={{ ...S.td, fontSize: '12px', color: '#6b7280' }}>{normalizeUomType(g.uom_type)}</td>
                      <td style={{ ...S.td, fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{g.target_value}</td>
                      <td style={{ ...S.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', fontSize: '15px', color: '#111827' }}>{g.weightage}%</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          {status === 'APPROVED' ? (
                            <button onClick={() => setCheckinGoal(g)} style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4f46e5', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
                              Check-in
                            </button>
                          ) : (
                            <>
                              <button disabled={isLocked} onClick={() => setEditGoal(g)} style={{ background: 'none', border: 'none', cursor: isLocked ? 'not-allowed' : 'pointer', color: '#9ca3af', opacity: isLocked ? 0.4 : 1, padding: '4px' }}
                                title="Edit">
                                <Edit2 size={14} />
                              </button>
                              <button disabled={isLocked} onClick={() => { if (confirm('Delete this goal?')) deleteGoalMutation.mutate(g.id); }}
                                style={{ background: 'none', border: 'none', cursor: isLocked ? 'not-allowed' : 'pointer', color: '#f87171', opacity: isLocked ? 0.4 : 1, padding: '4px' }}
                                title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
            <tfoot>
              {teamGoals.length > 0 && (
                <tr style={{ background: '#f0f4ff' }}>
                  <td colSpan={4} style={{ ...S.td, fontWeight: '700', color: '#3b3fce', borderTop: '2px solid #e8eaed', fontSize: '13px' }}>
                    Team Goals Total
                  </td>
                  <td style={{ ...S.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', fontSize: '15px', color: teamGoalsWeightage > 100 ? '#dc2626' : teamGoalsWeightage === 100 ? '#16a34a' : '#7c3aed', borderTop: '2px solid #e8eaed' }}>
                    {teamGoalsWeightage}%
                  </td>
                  <td style={{ borderTop: '2px solid #e8eaed' }} />
                </tr>
              )}
              <tr style={{ background: '#f0fdf4' }}>
                <td colSpan={4} style={{ ...S.td, fontWeight: '700', color: '#166534', borderTop: teamGoals.length > 0 ? '1px solid #d1fae5' : '2px solid #e8eaed', fontSize: '13px' }}>
                  Individual Goals Total {!canSubmit && status === 'DRAFT' && individualGoalsWeightage < 100 && (
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#f59e0b', marginLeft: '8px' }}>({100 - individualGoalsWeightage}% remaining)</span>
                  )}
                </td>
                <td style={{ ...S.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', fontSize: '15px', color: individualGoalsWeightage === 100 ? '#16a34a' : '#dc2626', borderTop: teamGoals.length > 0 ? '1px solid #d1fae5' : '2px solid #e8eaed' }}>
                  {individualGoalsWeightage}%
                </td>
                <td style={{ borderTop: teamGoals.length > 0 ? '1px solid #d1fae5' : '2px solid #e8eaed' }} />
              </tr>
            </tfoot>
          </table>
          </div>
        )}
      </div>
      </div>

      {(wizardOpen || editGoal) && (
        <GoalWizard
          editGoal={editGoal}
          // If editing a team goal, open in teamGoalMode so it routes to the correct endpoint
          teamGoalMode={!!(editGoal?.team_id)}
          teamId={editGoal?.team_id ? String(editGoal.team_id) : undefined}
          // Pass remaining budget from the CORRECT pool (team pool for team goals, individual pool otherwise)
          remainingWeightage={editGoal?.team_id
            ? Math.max(0, 100 - teamGoalsWeightage + (editGoal?.weightage || 0))
            : Math.max(0, 100 - individualGoalsWeightage + (editGoal?.weightage || 0))}
          onClose={() => { setWizardOpen(false); setEditGoal(null); }}
          onSave={() => { setWizardOpen(false); setEditGoal(null); qc.invalidateQueries({ queryKey: ['myGoalSheet'] }); }}
        />
      )}

      {checkinGoal && (
        <CheckinWizard
          goal={checkinGoal}
          onClose={() => setCheckinGoal(null)}
          onSave={() => { setCheckinGoal(null); qc.invalidateQueries({ queryKey: ['myGoalSheet'] }); }}
        />
      )}

      {summaryOpen && (
        <PerformanceSummaryModal
          title="My Performance Summary"
          onClose={() => setSummaryOpen(false)}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="page-container fade-in" style={{ padding: '28px 32px' }}>
      <div className="skeleton" style={{ height: '140px', borderRadius: '24px', marginBottom: '24px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '18px' }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: '400px', borderRadius: '24px' }} />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <XCircle size={40} style={{ margin: '0 auto 12px', display: 'block' }} />
      {message}
    </div>
  );
}
