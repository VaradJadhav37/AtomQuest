import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Save, Clock, BarChart3 } from 'lucide-react';
import api from '../lib/api';
import { computeProgressScore, formatProgressFormula, normalizeUomType } from '../lib/uom';

const S: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
  modal: { background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)' },
  header: { padding: '24px 32px', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  content: { padding: '32px', overflowY: 'auto' },
  footer: { padding: '24px 32px', borderTop: '1px solid #e8eaed', display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px', fontFamily: "'Inter', system-ui, sans-serif" },
  input: { width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '15px', color: '#111827', fontFamily: "'Inter', system-ui, sans-serif", outline: 'none', transition: 'all 0.2s' },
  textarea: { width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '15px', color: '#111827', fontFamily: "'Inter', system-ui, sans-serif", outline: 'none', minHeight: '100px', resize: 'vertical', transition: 'all 0.2s' },
};

export default function CheckinWizard({ goal, onClose, onSave }: { goal: any; onClose: () => void; onSave: () => void }) {
  const qc = useQueryClient();
  const [actualValue, setActualValue] = useState('');
  const [employeeComment, setEmployeeComment] = useState('');
  const [status, setStatus] = useState('ON_TRACK');
  const uomType = normalizeUomType(goal.uom_type);

  // Fetch existing checkin data
  const { data: existing, isLoading } = useQuery({
    queryKey: ['checkin', goal.id],
    queryFn: () => api.get(`/api/checkins/goal/${goal.id}`).then(r => r.data),
  });

  useEffect(() => {
    if (existing?.achievement) {
      setActualValue(existing.achievement.actual_value || '');
    }
    if (existing?.checkin) {
      setEmployeeComment(existing.checkin.employee_comment || '');
      setStatus(existing.checkin.status || 'ON_TRACK');
    }
  }, [existing]);

  const submitMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/checkins/employee', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myGoalSheet'] });
      qc.invalidateQueries({ queryKey: ['checkin', goal.id] });
      onSave();
    },
  });

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()} className="anim-scale-up">
        <div style={S.header}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Log Actuals</div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-0.01em' }}>Goal Check-in</h2>
          </div>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280' }}>
            <X size={18} />
          </button>
        </div>

        <div style={S.content}>
          {/* Goal Summary */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '4px', fontFamily: "'Inter', system-ui, sans-serif" }}>{goal.title}</h3>
            {goal.description && <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>{goal.description}</p>}
            
            <div style={{ display: 'flex', gap: '24px', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Target</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', fontFamily: "'JetBrains Mono', monospace" }}>{goal.target_value} <span style={{fontSize:'12px', color:'#64748b'}}>{uomType}</span></div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Weightage</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', fontFamily: "'JetBrains Mono', monospace" }}>{goal.weightage}%</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Thrust Area</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#3b82f6', marginTop: '2px' }}>{goal.thrust_area}</div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}><Clock size={16} /> Loading existing data...</div>
          ) : (
            <>
              {/* Actual Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={S.label}>Actual Achievement ({uomType})</label>
                {uomType === 'Zero' ? (
                  <select
                    value={actualValue} onChange={e => setActualValue(e.target.value)}
                    style={{ ...S.input, appearance: 'none', background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 16px center`, paddingRight: '40px' }}
                  >
                    <option value="">Select outcome...</option>
                    <option value="0">Zero occurrences</option>
                    <option value="1">At least one occurrence</option>
                  </select>
                ) : uomType === 'Timeline' ? (
                  <input
                    type="date"
                    value={actualValue}
                    onChange={e => setActualValue(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    style={S.input}
                  />
                ) : (
                  <input
                    type="number" value={actualValue} onChange={e => setActualValue(e.target.value)}
                    placeholder={`Enter current ${uomType.toLowerCase()}...`}
                    style={S.input}
                  />
                )}
              </div>

              <div style={{ marginBottom: '20px', padding: '14px 16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Progress Preview</div>
                    <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{formatProgressFormula(uomType, goal.target_value, actualValue)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BarChart3 size={18} color="#2563eb" />
                    </div>
                    <div style={{ fontSize: '28px', lineHeight: 1, fontWeight: 700, color: '#111827', fontFamily: "'Bebas Neue', sans-serif" }}>
                      {computeProgressScore(uomType, goal.target_value, actualValue)}%
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={S.label}>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} style={S.input}>
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="ON_TRACK">On Track</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              {/* Comment Input */}
              <div>
                <label style={S.label}>Self-Assessment / Notes (Optional)</label>
                <textarea
                  value={employeeComment} onChange={e => setEmployeeComment(e.target.value)}
                  placeholder="Provide any context for your achievement this quarter..."
                  style={S.textarea}
                />
              </div>
            </>
          )}
        </div>

        <div style={S.footer}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#374151', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
            Cancel
          </button>
          <button 
            disabled={!actualValue || submitMutation.isPending}
            onClick={() => submitMutation.mutate({ goal_id: goal.id, actual_value: actualValue, employee_comment: employeeComment, status })}
            style={{ padding: '10px 20px', background: (!actualValue || submitMutation.isPending) ? '#9ca3af' : '#111827', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#fff', cursor: (!actualValue || submitMutation.isPending) ? 'not-allowed' : 'pointer', fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Save size={16} />
            {submitMutation.isPending ? 'Saving...' : 'Save Check-in'}
          </button>
        </div>
      </div>
    </div>
  );
}
