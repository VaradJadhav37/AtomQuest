// GoalWizard.tsx — Create/Edit goal with AI coach
import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Sparkles, X } from 'lucide-react';
import api from '../lib/api';
import { UOM_TYPES, normalizeUomType, uomPlaceholder } from '../lib/uom';
import { useAuth } from '../context/AuthContext';
import { useTeamContext } from '../context/TeamContext';

const THRUST_AREAS = ['Revenue Growth', 'Customer Satisfaction', 'Operational Efficiency', 'People Development', 'Innovation', 'Compliance & Risk'];

interface Props {
  onClose: () => void;
  onSave: () => void;
  remainingWeightage: number;
  editGoal?: any;
  teamId?: string | number;
  teamGoalMode?: boolean;
  members?: any[];
}

export default function GoalWizard({ onClose, onSave, remainingWeightage, editGoal, teamId, teamGoalMode = false, members = [] }: Props) {
  const { user, role } = useAuth();
  const { teams, activeTeamId } = useTeamContext();

  const [selectedOwnerId, setSelectedOwnerId] = useState<number>(
    editGoal?.owner_id || user?.id || 0
  );

  // Fetch the selected owner's active sheet to dynamically validate remaining weightage
  const { data: ownerSheetData } = useQuery({
    queryKey: ['sheetForEmployee', selectedOwnerId],
    queryFn: () => api.get(`/api/goal-sheets/employee/${selectedOwnerId}`).then(r => r.data),
    enabled: !!selectedOwnerId && (role === 'MANAGER' || role === 'ADMIN' || selectedOwnerId === user?.id),
  });

  const [form, setForm] = useState({
    title: editGoal?.title || '',
    uom_type: normalizeUomType(editGoal?.uom_type),
    target_value: editGoal?.target_value || '',
    weightage: editGoal?.weightage || '',
    thrust_area: editGoal?.thrust_area || 'Revenue Growth',
    description: editGoal?.description || '',
    team_id: editGoal?.team_id ? String(editGoal.team_id) : activeTeamId !== 'all' ? activeTeamId : '',
  });
  const [aiScorecard, setAiScorecard] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [rewritePreview, setRewritePreview] = useState('');
  const [rewriteRationale, setRewriteRationale] = useState('');
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [error, setError] = useState('');

  const ownerSheetGoals = ownerSheetData?.sheet?.goals || [];
  // Calculate total weightage excluding the current editing goal
  const ownerCurrentTotalWeightage = ownerSheetGoals
    .filter((g: any) => !editGoal || Number(g.id) !== Number(editGoal.id))
    .reduce((sum: number, g: any) => sum + Number(g.weightage || 0), 0);

  const dynamicRemainingWeightage = teamGoalMode
    ? Math.min(remainingWeightage, Math.max(0, 100 - ownerCurrentTotalWeightage))
    : remainingWeightage;

  const availableWeightage = Math.max(0, dynamicRemainingWeightage);
  const weightageMax = availableWeightage >= 10 ? availableWeightage : undefined;

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, uom_type: normalizeUomType(form.uom_type), weightage: Number(form.weightage), team_id: form.team_id ? Number(form.team_id) : null, owner_id: teamGoalMode ? selectedOwnerId : null };
      const resolvedTeamId = Number(teamId || form.team_id || 0);
      if (teamGoalMode && resolvedTeamId > 0) {
        if (editGoal) {
          return api.patch(`/api/teams/${resolvedTeamId}/goals/${editGoal.id}`, payload);
        }
        return api.post(`/api/teams/${resolvedTeamId}/goals`, payload);
      }
      if (editGoal) {
        return api.patch(`/api/goals/${editGoal.id}`, payload);
      }
      return api.post('/api/goals', payload);
    },
    onSuccess: () => onSave(),
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to save goal'),
  });

  // Debounced AI SMART coach
  React.useEffect(() => {
    if (!form.title.trim()) {
      setAiScorecard(null);
      return;
    }
    const timer = setTimeout(async () => {
      setAiLoading(true);
      try {
        const res = await api.post('/api/ai/coach', form);
        setAiScorecard(res.data);
      } catch { /* ignore */ }
      setAiLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [form.title, form.description, form.uom_type, form.target_value]);

  const rewriteGoal = async () => {
    if (!form.title.trim()) return;
    setRewriteLoading(true);
    setRewritePreview('');
    setRewriteRationale('');

    try {
      const baseUrl =
        localStorage.getItem('gk_api_base_url') ||
        import.meta.env.VITE_API_BASE_URL ||
        'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/ai/rewrite-goal?stream=1`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gk_token') || ''}`,
          'x-csrf-token': localStorage.getItem('gk_csrf_token') || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(form),
      });

      if (!response.ok || !response.body) throw new Error('Rewrite stream failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let collected = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');

          for (const line of raw.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === '[DONE]') continue;
            const event = JSON.parse(payload);
            if (event.type === 'token' && event.token) {
              collected += event.token;
              setRewritePreview(collected);
            }
            if (event.type === 'done' && event.goal) {
              const nextTitle = event.goal.title || form.title;
              setRewritePreview(nextTitle);
              setRewriteRationale(event.goal.rationale || '');
              // We do NOT auto-apply the rewrite. We wait for the user to click 'Apply Rewrite'
            }
          }
        }
      }
    } catch {
      setRewritePreview('Increase quarterly performance with a measurable business outcome.');
      setRewriteRationale('Fallback rewrite generated locally.');
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Goal title is required');
    if (!form.target_value.trim()) return setError('Target value is required');
    const w = Number(form.weightage);
    if (!w || w < 10 || w > 100) return setError('Weightage must be between 10 and 100');
    if (!editGoal && availableWeightage < 10) return setError('Not enough remaining weightage to add a valid goal. Reduce another goal first.');
    if (!editGoal && w > availableWeightage) return setError(`Max remaining weightage is ${availableWeightage}%`);
    saveMutation.mutate();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: '#fff', border: '1px solid #d1d5db',
    borderRadius: '8px', fontFamily: "'Inter', system-ui, sans-serif", fontSize: '14px', color: '#111827', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', fontFamily: "'Inter', system-ui, sans-serif",
  };

  const renderSmartScore = (label: string, data: any) => {
    if (!data) return null;
    const color = data.score >= 7 ? '#16a34a' : data.score >= 4 ? '#f59e0b' : '#ef4444';
    return (
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>
          <span>{label}</span>
          <span style={{ color }}>{data.score}/10</span>
        </div>
        <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' }}>
          <div style={{ height: '100%', width: `${data.score * 10}%`, background: color, transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>{data.suggestion}</div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>

        {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px', borderBottom: '1px solid #f3f4f6' }}>
          <div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', fontWeight: '700', color: '#111827' }}>{editGoal ? 'Edit Goal' : 'New Goal'}</h2>
            <p style={{ fontSize: '13px', color: '#9ca3af', fontFamily: "'Inter', system-ui, sans-serif", marginTop: '2px' }}>
              {editGoal ? 'Update goal details' : `Remaining weightage: ${remainingWeightage}%`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => void rewriteGoal()}
              disabled={rewriteLoading || !form.title.trim()}
              style={{
                padding: '8px 12px',
                background: rewriteLoading ? '#f5f3ff' : '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 12,
                color: '#2563eb',
                fontSize: 12,
                fontWeight: 700,
                cursor: rewriteLoading || !form.title.trim() ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {rewriteLoading ? 'Rewriting...' : 'Improve Goal'}
            </button>
            <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={16} color="#6b7280" />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Main Form */}
          <div style={{ flex: 3, overflowY: 'auto', padding: '24px 28px', borderRight: '1px solid #f3f4f6' }}>
            <form onSubmit={handleSubmit}>
              {/* Title */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Goal Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Increase Q1 revenue pipeline to $2M"
                  style={inputStyle} />
              </div>

              {/* 2-col grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Thrust Area *</label>
                  <select value={form.thrust_area} onChange={e => setForm(f => ({ ...f, thrust_area: e.target.value }))} style={{ ...inputStyle }}>
                    {THRUST_AREAS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>UoM Type *</label>
                  <select value={form.uom_type} onChange={e => setForm(f => ({ ...f, uom_type: normalizeUomType(e.target.value) }))} style={{ ...inputStyle }}>
                    {UOM_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Target Value *</label>
                  <input
                    type={form.uom_type === 'Timeline' ? 'date' : 'number'}
                    step={form.uom_type === 'Numeric' || form.uom_type === 'Percentage' || form.uom_type === 'Zero' ? 'any' : undefined}
                    value={form.target_value}
                    onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))}
                    placeholder={uomPlaceholder(form.uom_type)}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Weightage (%) * &nbsp;<span style={{ color: '#9ca3af', fontWeight: '400' }}>Max: {availableWeightage}%</span></label>
                  <input type="number" min={10} {...(weightageMax !== undefined ? { max: weightageMax } : {})} value={form.weightage}
                    onChange={e => setForm(f => ({ ...f, weightage: e.target.value }))} placeholder="e.g. 40" style={inputStyle} />
                  {weightageMax === undefined && (
                    <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '6px', fontFamily: "'Inter', system-ui, sans-serif" }}>
                      {dynamicRemainingWeightage < 0
                        ? `This sheet/team is overallocated. Reduce other goals first.`
                        : 'This sheet/team has less than 10% available weightage. Lower another goal first.'}
                    </div>
                  )}
                </div>
                {teamGoalMode && (role === 'MANAGER' || role === 'ADMIN') ? (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Assignee / Goal Owner *</label>
                    <select
                      value={selectedOwnerId}
                      onChange={e => setSelectedOwnerId(Number(e.target.value))}
                      style={{ ...inputStyle }}
                    >
                      {!members.some((m: any) => Number(m.employee?.id) === Number(user?.id)) && user && (
                        <option value={user.id}>
                          {user.name} ({user.email}) [You]
                        </option>
                      )}
                      {members.map((m: any) => (
                        <option key={m.employee?.id} value={m.employee?.id}>
                          {m.employee?.name} ({m.employee?.email})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  (role === 'MANAGER' || role === 'ADMIN') && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Assign to Team</label>
                      <select
                        value={form.team_id}
                        onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}
                        style={{ ...inputStyle }}
                      >
                        <option value="">All Teams / Default Workspace</option>
                        {teams.map(team => (
                          <option key={team.id} value={String(team.id)}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Description (optional)</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} placeholder="Brief description of the goal..."
                  style={{ ...inputStyle, resize: 'vertical' as const }} />
              </div>

              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'Inter', system-ui, sans-serif" }}>{error}</div>}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: '#f9fafb', border: '1px solid #e8eaed', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#374151', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
                  Cancel
                </button>
                <button type="submit" disabled={saveMutation.isPending} style={{ flex: 2, padding: '10px', background: '#111827', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#fff', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
                  {saveMutation.isPending ? 'Saving...' : editGoal ? 'Update Goal' : 'Add Goal'}
                </button>
              </div>
            </form>
          </div>

          {/* AI Scorecard Side Panel */}
          <div style={{ flex: 2, background: '#fafafa', padding: '24px 28px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Sparkles size={18} color="#8b5cf6" />
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', fontFamily: "'Inter', system-ui, sans-serif" }}>AI SMART Coach</h3>
            </div>
            
            {!form.title ? (
              <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', marginTop: '40px' }}>
                Start typing your goal title to get real-time AI feedback.
              </div>
            ) : aiLoading ? (
              <div style={{ fontSize: '13px', color: '#8b5cf6', textAlign: 'center', marginTop: '40px', fontWeight: '600', animation: 'pulse 1.5s infinite' }}>
                Analyzing goal quality...
              </div>
            ) : aiScorecard ? (
              <div>
                {renderSmartScore('S - Specific', aiScorecard.specific)}
                {renderSmartScore('M - Measurable', aiScorecard.measurable)}
                {renderSmartScore('A - Achievable', aiScorecard.achievable)}
                {renderSmartScore('R - Relevant', aiScorecard.relevant)}
                {renderSmartScore('T - Time-bound', aiScorecard.time_bound)}
              </div>
            ) : null}

            {rewritePreview && (
              <div style={{ marginTop: '24px', padding: '16px', borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>Rewrite Preview</div>
                <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.5 }}>{rewritePreview}</div>
                {rewriteRationale && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{rewriteRationale}</div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setForm(current => ({ ...current, title: rewritePreview, description: current.description || rewriteRationale }));
                    setRewritePreview('');
                    setRewriteRationale('');
                  }}
                  style={{
                    marginTop: 12,
                    padding: '8px 12px',
                    background: '#111827',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}
                >
                  Apply Rewrite
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
