import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Users } from 'lucide-react';
import api from '../lib/api';
import { UOM_TYPES, normalizeUomType, uomPlaceholder } from '../lib/uom';

const S: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
  modal: { background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)' },
  header: { padding: '24px 32px', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  content: { padding: '32px', overflowY: 'auto' },
  footer: { padding: '24px 32px', borderTop: '1px solid #e8eaed', display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px', fontFamily: "'Inter', system-ui, sans-serif" },
  input: { width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '15px', color: '#111827', fontFamily: "'Inter', system-ui, sans-serif", outline: 'none' },
};

export default function SharedGoalModal({ employees, onClose }: { employees: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [form, setForm] = useState({ title: '', thrust_area: 'Revenue Growth', uom_type: 'Numeric', target_value: '', weightage: '' });
  const [clientError, setClientError] = useState('');

  const submitMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/goals/shared', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teamSheets'] });
      qc.invalidateQueries({ queryKey: ['myGoalSheet'] });
      qc.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      qc.invalidateQueries({ queryKey: ['executiveDashboard'] });
      qc.invalidateQueries({ queryKey: ['analyticsData'] });
      onClose();
    },
    onError: (err: any) => {
      const apiError = err?.response?.data?.error;
      setClientError(apiError || 'Unable to assign goal right now. Please try again.');
    },
  });

  const handleSubmit = () => {
    setClientError('');
    if (selectedIds.length < 1) {
      setClientError('Select at least one employee to assign this goal.');
      return;
    }
    if (!form.title.trim()) {
      setClientError('Goal title is required.');
      return;
    }
    const requestedWeightage = Number(form.weightage);
    if (!Number.isFinite(requestedWeightage) || requestedWeightage <= 0) {
      setClientError('Enter a valid weightage.');
      return;
    }
    if (requestedWeightage > 100) {
      setClientError('Weightage cannot exceed 100%.');
      return;
    }
    submitMutation.mutate({
      ...form,
      title: form.title.trim(),
      employee_ids: selectedIds
    });
  };

  const toggleEmp = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()} className="anim-scale-up">
        <div style={S.header}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Assign to Team</div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', fontFamily: "'Inter', system-ui, sans-serif" }}>Create Shared Goal</h2>
          </div>
          <button onClick={onClose}
            style={{
              background: '#f3f4f6',
              border: 'none',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#4b5563',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = '#e5e7eb';
              e.currentTarget.style.color = '#111827';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.color = '#4b5563';
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={S.content}>
          {(clientError || submitMutation.isError) && (
            <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: '13px', fontWeight: 600 }}>
              {clientError || (submitMutation.error as any)?.response?.data?.error || 'Unable to assign shared goal. Please try again.'}
            </div>
          )}
          <div style={{ marginBottom: '20px' }}>
            <label style={S.label}>1. Select Employees (Primary owner first)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {employees.map(emp => (
                <div key={emp.id} onClick={() => toggleEmp(emp.id)}
                  style={{ padding: '10px', border: '1px solid', borderColor: selectedIds.includes(emp.id) ? '#8b5cf6' : '#e5e7eb', background: selectedIds.includes(emp.id) ? '#f5f3ff' : '#fff', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={selectedIds.includes(emp.id)} readOnly style={{ cursor: 'pointer' }} />
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{emp.name}</div>
                  {selectedIds[0] === emp.id && <span style={{ fontSize: '10px', background: '#8b5cf6', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>Primary</span>}
                </div>
              ))}
            </div>
            {selectedIds.length > 0 && <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>If multiple employees are selected, the primary owner checks in actuals and those values sync to linked employees.</p>}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={S.label}>2. Goal Title</label>
            <input style={S.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Achieve $2M Department Revenue" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={S.label}>Thrust Area</label>
              <select style={{ ...S.input, appearance: 'none' }} value={form.thrust_area} onChange={e => setForm({ ...form, thrust_area: e.target.value })}>
                {['Revenue Growth', 'Customer Satisfaction', 'Operational Efficiency', 'People Development', 'Innovation', 'Compliance & Risk'].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Weightage (%)</label>
              <input style={S.input} type="number" min="1" max="100" value={form.weightage} onChange={e => setForm({ ...form, weightage: e.target.value })} placeholder="e.g. 25" />
              <div style={{ marginTop: '6px', fontSize: '11px', color: '#6b7280' }}>
                Existing individual goals auto-rebalance so total remains 100%.
              </div>
            </div>
          </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={S.label}>Unit of Measure</label>
              <select style={{ ...S.input, appearance: 'none' }} value={form.uom_type} onChange={e => setForm({ ...form, uom_type: normalizeUomType(e.target.value) })}>
                {UOM_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Target Value</label>
              <input
                style={S.input}
                type={form.uom_type === 'Timeline' ? 'date' : 'number'}
                step={form.uom_type === 'Timeline' ? undefined : 'any'}
                value={form.target_value}
                onChange={e => setForm({ ...form, target_value: e.target.value })}
                placeholder={uomPlaceholder(form.uom_type)}
              />
            </div>
          </div>
        </div>

        <div style={S.footer}>
          {(clientError || submitMutation.isError) && (
            <div style={{ marginRight: 'auto', maxWidth: '62%', fontSize: '12px', fontWeight: 600, color: '#b91c1c' }}>
              {clientError || (submitMutation.error as any)?.response?.data?.error || 'Unable to assign goal.'}
            </div>
          )}
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
          <button disabled={submitMutation.isPending || selectedIds.length < 1 || !form.title || !form.weightage || !form.target_value} onClick={handleSubmit}
            style={{ padding: '10px 20px', background: '#111827', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: submitMutation.isPending ? 'not-allowed' : 'pointer', opacity: submitMutation.isPending ? 0.75 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} /> {submitMutation.isPending ? 'Assigning...' : selectedIds.length > 1 ? 'Assign Shared Goal' : 'Assign Goal'}
          </button>
        </div>
      </div>
    </div>
  );
}
