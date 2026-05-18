import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import OrgTree from '../components/OrgTree';
import GoalCascadeTree from '../components/GoalCascadeTree';
import { useState } from 'react';

interface User { id: number; name: string; email: string; role: string; department: string; manager_id: number | null; }

export default function OrgAlignment() {
  const [selectedGoalNode, setSelectedGoalNode] = useState<any>(null);
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['orgTree'],
    queryFn: () => api.get('/api/admin/org-tree').then(r => r.data),
  });
  const { data: cascade } = useQuery({
    queryKey: ['companyGoalCascade'],
    queryFn: () => api.get('/api/admin/company-goal-cascade').then(r => r.data),
  });

  if (isLoading) return (
    <div className="page-container fade-in" style={{ padding: '32px' }}>
      <div className="skeleton" style={{ height: '120px', borderRadius: '24px', marginBottom: '32px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        <div className="skeleton" style={{ width: '200px', height: '80px', borderRadius: '16px' }} />
        <div style={{ display: 'flex', gap: '24px' }}>
          <div className="skeleton" style={{ width: '200px', height: '80px', borderRadius: '16px' }} />
          <div className="skeleton" style={{ width: '200px', height: '80px', borderRadius: '16px' }} />
          <div className="skeleton" style={{ width: '200px', height: '80px', borderRadius: '16px' }} />
        </div>
      </div>
    </div>
  );

  if (!isLoading && (!users || users.length === 0)) {
    return (
      <div className="dash-page-container" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ textAlign: 'center', padding: '64px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>No Organization Data</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
            There are no users to display in the organization tree yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-page-container" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="goal-sheet-header" style={{ marginBottom: '28px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>Organization</div>
          <h1 className="goal-sheet-title" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '56px', fontWeight: '400', color: '#111827', letterSpacing: '0.03em', lineHeight: 1 }}>Org Alignment</h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>Reporting hierarchy across all roles.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {['ADMIN', 'MANAGER', 'EMPLOYEE'].map(r => ({
          role: r,
          count: users?.filter(u => u.role === r).length || 0,
          color: { ADMIN: '#d97706', MANAGER: '#2563eb', EMPLOYEE: '#16a34a' }[r] || '#6b7280',
          bg: { ADMIN: '#fef3c7', MANAGER: '#eff6ff', EMPLOYEE: '#f0fdf4' }[r] || '',
        })).map(p => (
          <div key={p.role} style={{ background: p.bg, border: `1px solid ${p.color}33`, borderRadius: '12px', padding: '12px 20px' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '48px', fontWeight: '400', color: p.color, lineHeight: 1 }}>{p.count}</div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{p.role}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Company Goal Cascade</div>
              <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>From company objective to department and employee goals.</div>
            </div>
            {selectedGoalNode && (
              <div style={{ padding: '10px 14px', background: '#0f172a', color: '#fff', borderRadius: 16, maxWidth: 360 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>{selectedGoalNode.kind}</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{selectedGoalNode.label}</div>
                <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
                  {selectedGoalNode.explanation?.summary || `${selectedGoalNode.progress || selectedGoalNode.score || 0}% progress`}
                </div>
              </div>
            )}
          </div>
          <GoalCascadeTree tree={cascade || null} onNodeClick={setSelectedGoalNode} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Org Chart</div>
              <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>People hierarchy and reporting lines.</div>
            </div>
          </div>
          <OrgTree users={users || []} />
        </div>
      </div>
    </div>
  );
}
