import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Save, Sparkles, MessageSquare } from 'lucide-react';
import api from '../lib/api';
import { normalizeUomType } from '../lib/uom';

const S: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
  modal: { background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)' },
  header: { padding: '24px 32px', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  content: { padding: '32px', overflowY: 'auto' },
  footer: { padding: '24px 32px', borderTop: '1px solid #e8eaed', display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px', fontFamily: "'Inter', system-ui, sans-serif" },
  textarea: { width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '15px', color: '#111827', fontFamily: "'Inter', system-ui, sans-serif", outline: 'none', minHeight: '120px', resize: 'vertical', transition: 'all 0.2s' },
};

export default function ManagerCheckinModal({ goal, onClose, onSave }: { goal: any; onClose: () => void; onSave: () => void }) {
  const qc = useQueryClient();
  const [managerComment, setManagerComment] = useState('');
  const [status, setStatus] = useState('ON_TRACK');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Set initial comment if it exists in check-in
  useEffect(() => {
    if (goal.checkin?.manager_comment) {
      setManagerComment(goal.checkin.manager_comment);
    }
    setStatus(goal.checkin?.status || 'ON_TRACK');
  }, [goal]);

  const submitMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/checkins/manager', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teamSheets'] });
      onSave();
    },
  });

  const generateAiComment = async () => {
    const token = localStorage.getItem('gk_token');
    if (!token) throw new Error('Missing auth token');

    setIsGenerating(true);
    setManagerComment('');

    try {
      const baseUrl =
        localStorage.getItem('gk_api_base_url') ||
        import.meta.env.VITE_API_BASE_URL ||
        'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/ai/generate-checkin-comment?stream=1`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-csrf-token': localStorage.getItem('gk_csrf_token') || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
          body: JSON.stringify({
            goal_title: goal.title,
            target: goal.target_value,
            actual: goal.achievement?.actual_value || 'No actual entered',
            uom: normalizeUomType(goal.uom_type),
            employee_comment: goal.checkin?.employee_comment || '',
          }),
        });

      if (!response.ok || !response.body) {
        throw new Error('Stream request failed');
      }

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
              setManagerComment(collected);
            }
            if (event.type === 'done' && event.comment) {
              collected = event.comment;
              setManagerComment(event.comment);
            }
          }
        }
      }
    } catch (err) {
      const fallback = "Good progress this quarter. Let's discuss any blockers in our next 1:1.";
      setManagerComment(fallback);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()} className="anim-scale-up">
        <div style={S.header}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Manager Review</div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-0.01em' }}>Provide Feedback</h2>
          </div>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280' }}>
            <X size={18} />
          </button>
        </div>

        <div style={S.content}>
          {/* Goal Summary */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '12px', fontFamily: "'Inter', system-ui, sans-serif" }}>{goal.title}</h3>
            
            <div className="manager-checkin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: '#fff', border: '1px solid #e8eaed', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Target</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', fontFamily: "'JetBrains Mono', monospace" }}>{goal.target_value} <span style={{fontSize:'12px', color:'#64748b'}}>{normalizeUomType(goal.uom_type)}</span></div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #e8eaed', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Actual Achievement</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: goal.achievement ? '#16a34a' : '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>
                  {goal.achievement?.actual_value || 'None'} <span style={{fontSize:'12px', color:'#64748b'}}>{goal.achievement ? normalizeUomType(goal.uom_type) : ''}</span>
                </div>
              </div>
            </div>
            
            {goal.checkin?.employee_comment && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#eff6ff', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MessageSquare size={12} /> Employee Note
                </div>
                <div style={{ fontSize: '13px', color: '#1e3a8a', fontStyle: 'italic' }}>
                  "{goal.checkin.employee_comment}"
                </div>
              </div>
            )}
          </div>

          {/* Comment Input */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
              <label style={{ ...S.label, marginBottom: 0 }}>Manager Comment</label>
              <button 
                onClick={() => void generateAiComment()}
                disabled={isGenerating}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#8b5cf6', fontSize: '12px', fontWeight: '700', cursor: isGenerating ? 'not-allowed' : 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
                <Sparkles size={14} />
                {isGenerating ? 'Generating...' : 'Generate AI Comment'}
              </button>
            </div>
            <textarea
              value={managerComment} onChange={e => setManagerComment(e.target.value)}
              placeholder="Write your feedback here..."
              style={{ ...S.textarea, borderColor: isGenerating ? '#8b5cf6' : '#d1d5db', background: isGenerating ? '#faf5ff' : '#fff' }}
            />
          </div>

          <div style={{ marginTop: '20px' }}>
            <label style={S.label}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...S.textarea, minHeight: 'auto', height: '48px', resize: 'none' }}>
              <option value="NOT_STARTED">Not Started</option>
              <option value="ON_TRACK">On Track</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        <div style={S.footer}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#374151', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
            Cancel
          </button>
          <button 
            disabled={!managerComment || submitMutation.isPending}
            onClick={() => submitMutation.mutate({ goal_id: goal.id, manager_comment: managerComment, status })}
            style={{ padding: '10px 20px', background: (!managerComment || submitMutation.isPending) ? '#9ca3af' : '#111827', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#fff', cursor: (!managerComment || submitMutation.isPending) ? 'not-allowed' : 'pointer', fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Save size={16} />
            {submitMutation.isPending ? 'Saving...' : 'Save Check-in'}
          </button>
        </div>
      </div>
    </div>
  );
}
