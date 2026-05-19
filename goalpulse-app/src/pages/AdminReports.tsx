import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Download, RefreshCw, CheckCircle, Clock, AlertTriangle, Plus, X, Search, ShieldCheck, DollarSign } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { normalizeUomType } from '../lib/uom';

const S_CARD: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e8eaed',
  borderRadius: '16px',
  padding: '20px 24px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
};

const badgeStyle = (passed: boolean): React.CSSProperties => ({
  padding: '3px 10px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 700,
  color: passed ? '#16a34a' : '#dc2626',
  background: passed ? '#f0fdf4' : '#fef2f2',
});

export default function AdminReports() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const [auditOpen, setAuditOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [newRule, setNewRule] = useState({ trigger_type: 'DRAFT_OVERDUE', threshold_days: 3, action: 'NOTIFY_MANAGER' });

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['completionDash'],
    queryFn: () => api.get('/api/admin/completion').then(r => r.data),
  });

  const { data: reportData } = useQuery({
    queryKey: ['achievementReport'],
    queryFn: () => api.get('/api/admin/report').then(r => r.data),
  });

  const { data: auditData } = useQuery({
    queryKey: ['auditLog'],
    queryFn: () => api.get('/api/admin/audit').then(r => r.data),
    enabled: auditOpen && role === 'ADMIN',
  });

  const { data: escalations } = useQuery({
    queryKey: ['escalations'],
    queryFn: () => api.get('/api/admin/escalations').then(r => r.data),
    enabled: ['ADMIN', 'MANAGER'].includes(role || ''),
  });

  const { data: costData } = useQuery({
    queryKey: ['costDashboard'],
    queryFn: () => api.get('/api/admin/cost-dashboard').then(r => r.data),
    enabled: role === 'ADMIN',
  });

  const { data: checklistData } = useQuery({
    queryKey: ['complianceChecklist'],
    queryFn: () => api.get('/api/admin/compliance-checklist').then(r => r.data),
    enabled: role === 'ADMIN',
  });

  const { data: searchData, isFetching: searchLoading } = useQuery({
    queryKey: ['adminSearch', searchTerm],
    queryFn: () => api.get('/api/admin/search', { params: { q: searchTerm } }).then(r => r.data),
    enabled: ['ADMIN', 'MANAGER'].includes(role || '') && searchTerm.length > 0,
  });

  const { data: rules, refetch: refetchRules } = useQuery({
    queryKey: ['escalationRules'],
    queryFn: () => api.get('/api/admin/escalation-rules').then(r => r.data),
    enabled: rulesOpen && role === 'ADMIN',
  });

  const { data: auditReplay } = useQuery({
    queryKey: ['auditReplay'],
    queryFn: () => api.get('/api/admin/audit-replay').then(r => r.data),
    enabled: ['ADMIN', 'MANAGER'].includes(role || ''),
  });

  const { data: judgeMode } = useQuery({
    queryKey: ['judgeMode'],
    queryFn: () => api.get('/api/admin/judge-mode').then(r => r.data),
    enabled: ['ADMIN', 'MANAGER'].includes(role || ''),
  });

  const addRuleMutation = useMutation({
    mutationFn: (rule: any) => api.post('/api/admin/escalation-rules', rule),
    onSuccess: () => {
      refetchRules();
      setNewRule({ trigger_type: 'DRAFT_OVERDUE', threshold_days: 3, action: 'NOTIFY_MANAGER' });
    },
  });

  const runEvaluator = useMutation({
    mutationFn: () => api.post('/api/admin/escalations/evaluate?demo=1'),
    onSuccess: (res) => {
      alert(`Evaluator run complete. ${res.data.newEvents} new events generated.`);
      qc.invalidateQueries({ queryKey: ['escalations'] });
    },
  });

  const seedReset = useMutation({
    mutationFn: () => api.post('/api/admin/seed-reset'),
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ['escalations'] });
      qc.invalidateQueries({ queryKey: ['costDashboard'] });
      qc.invalidateQueries({ queryKey: ['complianceChecklist'] });
      qc.invalidateQueries({ queryKey: ['auditReplay'] });
      qc.invalidateQueries({ queryKey: ['judgeMode'] });
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('gk_token');
        localStorage.removeItem('gk_user');
        localStorage.removeItem('gk_clerk_email');
      }
      alert('Database reset complete. Please log in again with demo credentials.');
      window.location.href = '/login';
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || 'Demo reset failed.';
      alert(message);
    },
  });

  const downloadCSV = () => {
    api.get('/api/admin/report?format=csv', { responseType: 'blob' })
      .then(response => {
        const downloadUrl = URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `GoalKeeper_Report_${reportData?.cycle?.name || 'export'}.csv`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      })
      .catch(() => alert('Failed to export CSV.'));
  };

  if (isLoading) return <LoadingState />;
  const { cycle, summary, employees } = data || {};

  return (
    <div className="dash-page-container" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="goal-sheet-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {cycle?.name} &nbsp;·&nbsp; Completion Dashboard
          </div>
          <h1 className="goal-sheet-title" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '56px', fontWeight: '400', color: '#111827', letterSpacing: '0.03em', lineHeight: 1 }}>Admin Reports</h1>
        </div>
        <div className="dash-header-actions">
          {role === 'ADMIN' && (
            <button onClick={() => setRulesOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#374151', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
              Rules
            </button>
          )}
          {role === 'ADMIN' && (
            <button onClick={() => seedReset.mutate()} disabled={seedReset.isPending} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#374151', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
              Demo Reset Mode
            </button>
          )}
          {role === 'ADMIN' && (
            <button onClick={() => runEvaluator.mutate()} disabled={runEvaluator.isPending} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#374151', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
              <RefreshCw size={15} /> Run Evaluator
            </button>
          )}
          <button onClick={downloadCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#111827', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#fff', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => {
            api.get('/api/admin/report?format=xlsx', { responseType: 'blob' })
              .then(response => {
                const downloadUrl = URL.createObjectURL(response.data);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `GoalKeeper_Report_${reportData?.cycle?.name || 'export'}.xlsx`;
                a.click();
                URL.revokeObjectURL(downloadUrl);
              })
              .catch(() => alert('Failed to export XLSX.'));
          }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#374151', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <Download size={15} /> Export XLSX
          </button>
        </div>
      </div>

      {role !== 'EMPLOYEE' && (
        <div style={{ ...S_CARD, marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Search size={18} color="#6b7280" />
            <div style={{ fontWeight: 700, color: '#111827' }}>Natural Language Search</div>
          </div>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Try: pending approvals for sales, revenue goals this quarter, employees with low scores"
            style={{ width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '14px', fontFamily: "'Inter', system-ui, sans-serif", outline: 'none' }}
          />
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>Searches employees, goal titles, cycles, and sheet status. Results are grounded in live data.</div>
          {searchTerm && (
            <div className="reports-search-grid">
              <SearchResultCard title="Employees" items={searchData?.employees || []} loading={searchLoading} renderItem={(u: any) => (
                <div>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{u.email} · {u.department}</div>
                </div>
              )} />
              <SearchResultCard title="Goals" items={searchData?.goals || []} loading={searchLoading} renderItem={(g: any) => (
                <div>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{g.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{g.thrust_area} · {g.weightage}% · {normalizeUomType(g.uom_type)}</div>
                </div>
              )} />
              <SearchResultCard title="Sheets" items={searchData?.sheets || []} loading={searchLoading} renderItem={(s: any) => (
                <div>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{s.employee_name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{s.cycle_name} · {s.status}</div>
                </div>
              )} />
            </div>
          )}
          {searchData?.insights?.length ? (
            <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {searchData.insights.map((insight: string) => (
                <span key={insight} style={{ background: '#eff6ff', color: '#2563eb', borderRadius: '999px', padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}>
                  {insight}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {role === 'ADMIN' && costData && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <DollarSign size={18} color="#16a34a" />
            <div style={{ fontWeight: 700, color: '#111827' }}>Cost Dashboard</div>
          </div>
          <div className="dash-grid-4" style={{ marginBottom: '14px' }}>
            <MetricCard label="AI Requests" value={costData.totalRequests} tone="#3b82f6" />
            <MetricCard label="Cache Hit Rate" value={`${costData.cacheHitRate}%`} tone="#22c55e" />
            <MetricCard label="Estimated Spend" value={`$${costData.estimatedSpend}`} tone="#8b5cf6" />
            <MetricCard label="Projected 100 Users" value={`$${costData.projectedMonthlyCost100Users}`} tone="#f59e0b" />
          </div>
          <div style={{ ...S_CARD }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>AI Usage Breakdown</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {Object.entries(costData.byRoute || {}).map(([route, count]) => (
                <span key={route} style={{ background: '#f9fafb', color: '#374151', borderRadius: '999px', padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}>
                  {route}: {String(count)}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {Object.entries(costData.byModel || {}).map(([model, count]) => (
                <span key={model} style={{ background: '#eff6ff', color: '#2563eb', borderRadius: '999px', padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}>
                  {model}: {String(count)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {role === 'ADMIN' && checklistData && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <ShieldCheck size={18} color="#d97706" />
            <div style={{ fontWeight: 700, color: '#111827' }}>BRD Compliance Checklist</div>
          </div>
          <div className="reports-checklist-grid">
            {checklistData.checklist.map((item: any) => (
              <div key={item.key} style={{ ...S_CARD, display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: '4px' }}>{item.detail || (item.passed ? 'Passing' : 'Needs attention')}</div>
                </div>
                <span style={badgeStyle(item.passed)}>{item.passed ? 'Pass' : 'Review'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {judgeMode && (
        <div style={{ ...S_CARD, marginBottom: '24px', border: '1px solid #dbeafe', background: '#eff6ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Judge Mode</div>
              <div style={{ fontWeight: 800, color: '#111827', marginTop: '4px' }}>Preloaded demo flow and shortcuts</div>
            </div>
            <span style={{ fontSize: '12px', color: '#2563eb', background: '#dbeafe', borderRadius: '999px', padding: '4px 10px', fontWeight: 700 }}>Presentation ready</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {(judgeMode.shortcuts || []).map((item: any) => (
              <span key={item.label} style={{ background: '#fff', color: '#1d4ed8', borderRadius: '999px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, border: '1px solid #bfdbfe' }}>
                {item.label}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(judgeMode.preloadedFlow || []).map((step: string, idx: number) => (
              <span key={step} style={{ background: '#fff', color: '#0f172a', borderRadius: '999px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, border: '1px solid #e2e8f0' }}>
                {idx + 1}. {step}
              </span>
            ))}
          </div>
        </div>
      )}

      {summary && (
        <div className="dash-grid-4" style={{ marginBottom: '24px' }}>
          {[
            { label: 'Total Employees', val: summary.totalEmployees, icon: BarChart3, bg: '#f9fafb', color: '#374151' },
            { label: 'Approved Sheets', val: summary.approved, icon: CheckCircle, bg: '#f0fdf4', color: '#16a34a' },
            { label: 'Pending Review', val: summary.pending, icon: Clock, bg: '#eff6ff', color: '#2563eb' },
            { label: 'Check-ins Done', val: summary.checkInsComplete, icon: CheckCircle, bg: '#fdf4ff', color: '#7c3aed' },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} style={{ ...S_CARD, background: card.bg, borderColor: card.color + '33' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</span>
                  <Icon size={16} color={card.color} />
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '48px', fontWeight: '400', letterSpacing: '0.02em', color: card.color, lineHeight: 1 }}>{card.val}</div>
              </div>
            );
          })}
        </div>
      )}

      {summary && (
        <div style={{ ...S_CARD, marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>Goal Sheet Approval Rate</span>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#16a34a' }}>
              {summary.totalEmployees > 0 ? Math.min(100, Math.round((summary.approved / summary.totalEmployees) * 100)) : 0}%
            </span>
          </div>
          <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ height: '100%', width: `${summary.totalEmployees > 0 ? Math.min(100, (summary.approved / summary.totalEmployees) * 100) : 0}%`, background: '#22c55e', transition: 'width 1s ease' }} />
            <div style={{ height: '100%', width: `${summary.totalEmployees > 0 ? Math.min(100, (summary.pending / summary.totalEmployees) * 100) : 0}%`, background: '#3b82f6', transition: 'width 1s ease' }} />
            <div style={{ height: '100%', width: `${summary.totalEmployees > 0 ? Math.min(100, (summary.draft / summary.totalEmployees) * 100) : 0}%`, background: '#f3f4f6' }} />
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
            {[
              { c: '#22c55e', l: `Approved (${summary.approved})` },
              { c: '#3b82f6', l: `Pending (${summary.pending})` },
              { c: '#9ca3af', l: `Draft/Not Started (${summary.draft + summary.notStarted})` },
            ].map(leg => (
              <div key={leg.l} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>
                <div style={{ width: '8px', height: '8px', background: leg.c, borderRadius: '50%' }} />{leg.l}
              </div>
            ))}
          </div>
        </div>
      )}

      {escalations && escalations.length > 0 && (
        <div style={{ ...S_CARD, marginBottom: '24px', border: '1px solid #fed7aa', background: '#fffcf1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <AlertTriangle size={18} color="#ea580c" />
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#9a3412' }}>Active Escalations ({escalations.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {escalations.map((esc: any) => (
              <div key={esc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #ffedd5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '8px', height: '8px', background: esc.priority === 'HIGH' ? '#ef4444' : '#f59e0b', borderRadius: '50%' }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{esc.message}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{esc.type.replace(/_/g, ' ')} &middot; {esc.entity}</div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#ea580c', background: '#ffedd5', padding: '4px 10px', borderRadius: '6px' }}>
                  {esc.days_overdue > 0 ? `${esc.days_overdue} days overdue` : 'Due soon'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {auditReplay && auditReplay.length > 0 && (
        <div style={{ ...S_CARD, marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Audit Replay</div>
              <div style={{ fontWeight: 700, color: '#111827', marginTop: '4px' }}>Chronological timeline of edits, approvals, and check-ins</div>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{auditReplay.length} events</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
            {auditReplay.slice(0, 20).map((event: any) => (
              <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '170px 150px 1fr', gap: '12px', alignItems: 'flex-start', padding: '12px 14px', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{event.timestamp}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{event.user_name} · {event.role}</div>
                </div>
                <div>
                  <div style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{event.action}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>{event.entity} #{event.entity_id}</div>
                </div>
                <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                  <div>{event.note}</div>
                  <DiffViewer before={event.before} after={event.after} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...S_CARD, overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: '600', fontSize: '15px', color: '#111827' }}>
          Employee Status
        </div>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '750px' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Employee', 'Department', 'Goals', 'Weightage', 'Check-ins', 'Score', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees?.map((emp: any) => {
                const badge = { APPROVED: '#16a34a', PENDING_APPROVAL: '#2563eb', DRAFT: '#6b7280', NOT_STARTED: '#ea580c' }[emp.sheetStatus as string] || '#6b7280';
                const label = { APPROVED: 'Approved', PENDING_APPROVAL: 'Pending', DRAFT: 'Draft', NOT_STARTED: 'Not Started' }[emp.sheetStatus as string] || emp.sheetStatus;
                return (
                  <tr key={emp.employee.id} onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '12px 20px', fontWeight: '600', color: '#111827' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #3b82f6, #7c3aed)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>{emp.employee.name.charAt(0)}</div>
                        <div>
                          <div style={{ fontSize: '13px' }}>{emp.employee.name}</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>{emp.employee.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: '#6b7280' }}>{emp.employee.department}</td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: '600', color: '#111827', textAlign: 'center' as const }}>{emp.goalsCount}</td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: '600', color: emp.totalWeightage === 100 ? '#16a34a' : '#9ca3af', fontFamily: "'JetBrains Mono', monospace" }}>{emp.totalWeightage}%</td>
                    <td style={{ padding: '12px 20px', textAlign: 'center' as const }}>
                      {emp.checkInsComplete ? <CheckCircle size={16} color="#16a34a" /> : <Clock size={16} color="#9ca3af" />}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: '14px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace", color: emp.overallScore >= 80 ? '#16a34a' : emp.overallScore >= 60 ? '#f59e0b' : emp.overallScore > 0 ? '#ef4444' : '#9ca3af' }}>
                      {emp.overallScore > 0 ? `${emp.overallScore}%` : '—'}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{ background: badge + '18', color: badge, borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: '700' }}>{label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {role === 'ADMIN' && (
        <div style={S_CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: auditOpen ? '16px' : '0' }}>
            <div style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>Audit Trail</div>
            <button onClick={() => setAuditOpen(!auditOpen)} style={{ background: '#f9fafb', border: '1px solid #e8eaed', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', color: '#374151', fontFamily: "'Inter', system-ui, sans-serif" }}>
              {auditOpen ? 'Hide' : 'View Log'}
            </button>
          </div>
          {auditOpen && auditData && (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {auditData.map((log: any) => (
                <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '170px 150px 1fr', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f3f4f6', fontSize: '12px', fontFamily: "'Inter', system-ui, sans-serif", alignItems: 'flex-start' }}>
                  <div style={{ color: '#9ca3af' }}>{log.ts}</div>
                  <div style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', justifySelf: 'start' }}>{log.action}</div>
                  <div style={{ color: '#374151' }}>
                    <div style={{ marginBottom: '4px' }}><span style={{ color: '#9ca3af', fontWeight: 600 }}>{log.users?.name || 'System'}</span></div>
                    {(() => {
                      let text = log.detail || `${log.entity} #${log.entity_id}`;
                      let parsed = null;
                      if (typeof text === 'string' && text.trim().startsWith('{')) {
                        try { parsed = JSON.parse(text); } catch(e){}
                      }
                      if (parsed && (parsed.before || parsed.after)) {
                        return (
                          <div>
                            <div>{parsed.note || 'Details updated'}</div>
                            <DiffViewer before={parsed.before} after={parsed.after} />
                          </div>
                        );
                      }
                      return <div>{text}</div>;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {rulesOpen && role === 'ADMIN' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', fontWeight: '400', color: '#111827', letterSpacing: '0.03em' }}>Escalation Rules</h2>
              <button onClick={() => setRulesOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#6b7280" /></button>
            </div>

            <div style={{ marginBottom: '20px', maxHeight: '200px', overflowY: 'auto' }}>
              {rules?.map((r: any) => (
                <div key={r.id} style={{ padding: '12px', border: '1px solid #e8eaed', borderRadius: '8px', marginBottom: '8px', background: '#f9fafb' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>{r.trigger_type}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Trigger after {r.threshold_days} days · Action: {r.action}</div>
                </div>
              ))}
            </div>

            <div style={{ paddingTop: '16px', borderTop: '1px solid #e8eaed' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Add New Rule</h3>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <select value={newRule.trigger_type} onChange={e => setNewRule({...newRule, trigger_type: e.target.value})} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                  <option>DRAFT_OVERDUE</option>
                  <option>APPROVAL_OVERDUE</option>
                  <option>CHECKIN_OVERDUE</option>
                </select>
                <input type="number" min={1} value={newRule.threshold_days} onChange={e => setNewRule({...newRule, threshold_days: Number(e.target.value)})} style={{ width: '80px', padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db' }} placeholder="Days" />
              </div>
              <button onClick={() => addRuleMutation.mutate(newRule)} disabled={addRuleMutation.isPending} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '10px', background: '#111827', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                <Plus size={16} /> Add Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div style={{ ...S_CARD, borderColor: tone + '33' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '48px', fontWeight: 400, letterSpacing: '0.02em', color: tone, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function SearchResultCard({ title, items, loading, renderItem }: any) {
  return (
    <div style={{ ...S_CARD, minHeight: '160px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>{title}</div>
      {loading ? (
        <div style={{ color: '#9ca3af', fontSize: 13 }}>Searching...</div>
      ) : items?.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.slice(0, 4).map((item: any, idx: number) => (
            <div key={idx} style={{ padding: '10px 12px', background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '10px' }}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: '#d1d5db', fontSize: 13 }}>No matches yet</div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="page-container fade-in" style={{ padding: '28px 32px' }}>
      {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '16px', marginBottom: '24px' }} />)}
    </div>
  );
}

function DiffViewer({ before, after }: { before: any, after: any }) {
  if (!before && !after) return null;
  if (!before && after) return <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', marginTop: '10px', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#475569', border: '1px solid #e2e8f0' }}>Entity Created: {Object.keys(after).length} fields</div>;
  if (before && !after) return <div style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', marginTop: '10px', fontSize: '11px', fontWeight: 600, color: '#991b1b', border: '1px solid #fecaca' }}>Entity Deleted</div>;

  const b = before || {};
  const a = after || {};
  const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
  
  const changes = allKeys.filter(k => JSON.stringify(b[k]) !== JSON.stringify(a[k]) && !['updated_at', 'reviewed_at', 'requested_at', 'created_at'].includes(k));
  
  if (changes.length === 0) return null;

  const renderVal = (v: any) => {
    if (v === undefined) return '-';
    if (v === null) return 'null';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  return (
    <div style={{ marginTop: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', width: '30%' }}>Property</th>
            <th style={{ textAlign: 'left', padding: '6px 12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', width: '35%' }}>Previous</th>
            <th style={{ textAlign: 'left', padding: '6px 12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', width: '35%' }}>New</th>
          </tr>
        </thead>
        <tbody>
          {changes.map(k => (
            <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>{k}</td>
              <td style={{ padding: '8px 12px', color: '#ef4444', textDecoration: b[k] !== undefined ? 'line-through' : 'none', wordBreak: 'break-all' }}>{renderVal(b[k])}</td>
              <td style={{ padding: '8px 12px', color: '#10b981', fontWeight: 600, wordBreak: 'break-all' }}>{renderVal(a[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
