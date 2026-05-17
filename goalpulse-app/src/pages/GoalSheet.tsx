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

  const { data, isLoading, error } = useQuery({
    queryKey: ['myGoalSheet'],
    queryFn: () => api.get('/api/goal-sheets/mine').then(r => r.data),
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

  const { cycle, sheet } = data;
  const { goals, totalWeightage, status } = sheet;
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

      triggerPdfDownload(pdf, `GoalPulse_Performance_${sheet.employee?.name || 'Sheet'}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF');
    }
  };

  const isLocked = status === 'APPROVED' || status === 'PENDING_APPROVAL';
  const canSubmit = !isLocked && totalWeightage === 100 && goals.length > 0;
  const canCreateGoal = !isLocked && totalWeightage < 100 && goals.length < 8;
  const statusInfo = STATUS_COLORS[status] || STATUS_COLORS.DRAFT;
  const StatusIcon = statusInfo.icon;

  return (
    <div style={S.page}>
      {/* Header */}
      <div className="goal-sheet-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {cycle.name} &nbsp;·&nbsp; {cycle.status === 'OPEN' ? '🟢 Cycle Open' : '🔴 Cycle Closed'}
          </div>
          <h1 className="goal-sheet-title" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '56px', fontWeight: '400', color: '#111827', letterSpacing: '0.03em', lineHeight: 1 }}>My Goals</h1>
          <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>{cycle.open_date} → {cycle.close_date}</div>
        </div>

        <div className="dash-header-actions">
          {/* Weightage progress */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: totalWeightage === 100 ? '#16a34a' : totalWeightage > 100 ? '#dc2626' : '#111827' }}>
              {totalWeightage}% / 100%
            </div>
            <div style={{ width: '120px', height: '5px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden', marginTop: '4px' }}>
              <div style={{ height: '100%', width: `${Math.min(totalWeightage, 100)}%`, background: totalWeightage === 100 ? '#22c55e' : totalWeightage > 100 ? '#ef4444' : '#3b82f6', borderRadius: '999px', transition: 'width 0.6s ease' }} />
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
              {status === 'DRAFT' && 'Add goals and ensure 100% weightage, then submit for approval.'}
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
              {goals.map((g: any) => (
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
            </tbody>
            <tfoot>
              <tr style={{ background: '#f9fafb' }}>
                <td colSpan={4} style={{ ...S.td, fontWeight: '700', color: '#111827', borderTop: '2px solid #e8eaed' }}>Total Weightage</td>
                <td style={{ ...S.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', fontSize: '16px', color: totalWeightage === 100 ? '#16a34a' : '#dc2626', borderTop: '2px solid #e8eaed' }}>{totalWeightage}%</td>
                <td style={{ borderTop: '2px solid #e8eaed' }} />
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
          remainingWeightage={Math.max(0, 100 - totalWeightage + (editGoal?.weightage || 0))}
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
    <div style={{ padding: '28px 32px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: '60px', background: '#f3f4f6', borderRadius: '12px', marginBottom: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
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
