import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, FileDown, TrendingUp, Target, Users, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import api from '../lib/api';

const S: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modal: { background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '980px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)' },
  header: { padding: '24px 32px', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  body: { padding: '28px 32px', overflowY: 'auto', background: '#f8f9fb' },
  card: { background: '#fff', border: '1px solid #e8eaed', borderRadius: '18px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
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

function Stat({ label, value, icon: Icon, color }: any) {
  return (
    <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

export default function PerformanceSummaryModal({
  onClose,
  cycleId,
  employeeId,
  title = 'Performance Summary',
}: {
  onClose: () => void;
  cycleId?: number | null;
  employeeId?: number | null;
  title?: string;
}) {
  const url = employeeId ? `/api/reports/performance-summary/${employeeId}` : '/api/reports/performance-summary/me';
  const queryString = cycleId ? `?cycle_id=${cycleId}` : '';

  const { data, isLoading } = useQuery({
    queryKey: ['performanceSummary', employeeId || 'me', cycleId || 'active'],
    queryFn: () => api.get(`${url}${queryString}`).then(r => r.data),
  });

  const exportPdf = async () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    let y = margin;

    const addText = (text: string, size = 11, color = '#111827', options: any = {}) => {
      pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
      pdf.setFontSize(size);
      pdf.setTextColor(color);
      const lines = pdf.splitTextToSize(text, pageWidth - margin * 2);
      pdf.text(lines, margin, y);
      y += lines.length * (size * 0.42) + (options.gapAfter ?? 3);
    };

    const ensureSpace = (needed = 24) => {
      if (y + needed > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
    };

    addText('GoalKeeper Performance Summary', 18, '#111827', { bold: true, gapAfter: 5 });
    addText(`${data?.user?.name || 'Employee'}  |  ${data?.cycle?.name || 'Cycle'}`, 11, '#475569', { bold: true, gapAfter: 4 });
    addText(`Manager: ${data?.manager?.name || 'N/A'}`, 10, '#64748b', { gapAfter: 2 });
    addText(`Completion: ${data?.completionRate ?? 0}%  |  Overall score: ${data?.overallScore ?? 0}%`, 10, '#64748b', { gapAfter: 4 });

    ensureSpace(24);
    addText('Narrative', 12, '#111827', { bold: true, gapAfter: 2 });
    addText(data?.narrative || 'No summary available.', 10, '#334155', { gapAfter: 4 });

    ensureSpace(30);
    addText('Goal Breakdown', 12, '#111827', { bold: true, gapAfter: 3 });
    const colWidths = [76, 20, 22, 22, 28];
    const headers = ['Goal', 'Score', 'Weight', 'Status', 'Actual'];
    let x = margin;
    pdf.setFillColor(248, 250, 252);
    pdf.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
    pdf.setFontSize(8);
    pdf.setTextColor('#64748b');
    headers.forEach((h, i) => {
      pdf.text(h, x + 1, y + 1.5);
      x += colWidths[i];
    });
    y += 9;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y - 2, pageWidth - margin, y - 2);

    (data?.goals || []).forEach((goal: any) => {
      ensureSpace(12);
      const rowY = y;
      const goalLines = pdf.splitTextToSize(goal.title || '', colWidths[0] - 2);
      const titleLines = goalLines.slice(0, 2);
      pdf.setFontSize(8.5);
      pdf.setTextColor('#111827');
      pdf.text(titleLines, margin + 1, rowY + 4);
      pdf.setTextColor(goal.score >= 80 ? '#16a34a' : goal.score >= 60 ? '#f59e0b' : '#dc2626');
      pdf.text(String(goal.score ?? 0), margin + colWidths[0] + 1, rowY + 4);
      pdf.setTextColor('#334155');
      pdf.text(String(goal.weightage ?? ''), margin + colWidths[0] + colWidths[1] + 1, rowY + 4);
      pdf.text(String(goal.status || ''), margin + colWidths[0] + colWidths[1] + colWidths[2] + 1, rowY + 4);
      pdf.text(String(goal.actual_value ?? '—'), margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 1, rowY + 4);
      y += Math.max(11, titleLines.length * 4 + 5);
    });

    ensureSpace(26);
    addText('Top Strengths', 12, '#111827', { bold: true, gapAfter: 2 });
    (data?.topThrustAreas || []).slice(0, 3).forEach((item: any) => {
      addText(`${item.thrust_area}: ${item.weightedScore}%`, 10, '#334155', { gapAfter: 1 });
    });

    ensureSpace(26);
    addText('Needs Attention', 12, '#111827', { bold: true, gapAfter: 2 });
    (data?.lowestGoals || []).slice(0, 3).forEach((goal: any) => {
      addText(`${goal.title}: ${goal.score}%`, 10, '#334155', { gapAfter: 1 });
    });

    triggerPdfDownload(pdf, `GoalKeeper_Performance_Summary_${data?.user?.name || 'Employee'}.pdf`);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Performance</div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, sans-serif" }}>{title}</h2>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={exportPdf} disabled={!data || isLoading} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              <FileDown size={16} /> Export PDF
            </button>
            <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={18} color="#6b7280" />
            </button>
          </div>
        </div>

        <div style={S.body}>
          {isLoading ? (
            <div style={{ color: '#6b7280', padding: '20px' }}>Loading performance summary...</div>
          ) : data ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '16px' }}>
                <Stat label="Goals" value={data.goalsCount} icon={Target} color="#3b82f6" />
                <Stat label="Completed" value={`${data.completionRate}%`} icon={CheckCircle} color="#22c55e" />
                <Stat label="Overall Score" value={`${data.overallScore}%`} icon={TrendingUp} color="#8b5cf6" />
                <Stat label="Manager" value={data.manager?.name || 'N/A'} icon={Users} color="#f59e0b" />
              </div>

              <div style={{ ...S.card, marginBottom: '16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Summary</div>
                <div style={{ fontSize: 15, color: '#111827', lineHeight: 1.7 }}>{data.narrative}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr', gap: '16px' }}>
                <div style={S.card}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Goal Breakdown</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {data.goals.map((goal: any) => (
                      <div key={goal.id} style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ fontWeight: 700, color: '#111827' }}>{goal.title}</div>
                          <div style={{ fontWeight: 700, color: goal.score >= 80 ? '#16a34a' : goal.score >= 60 ? '#f59e0b' : '#ef4444' }}>{goal.score ?? 0}%</div>
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: '4px' }}>{goal.thrust_area} · {goal.weightage}% · {goal.status}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={S.card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Top Strengths</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {data.topThrustAreas.slice(0, 3).map((item: any) => (
                        <div key={item.thrust_area} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
                          <span>{item.thrust_area}</span>
                          <span style={{ fontWeight: 700 }}>{item.weightedScore}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={S.card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Needs Attention</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {data.lowestGoals.slice(0, 3).map((goal: any) => (
                        <div key={goal.title} style={{ fontSize: 13, color: '#374151' }}>
                          <span style={{ fontWeight: 700 }}>{goal.score}%</span> · {goal.title}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
