import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import OrgTree from '../components/OrgTree';

interface User { id: number; name: string; email: string; role: string; department: string; manager_id: number | null; }

export default function OrgAlignment() {
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['orgTree'],
    queryFn: () => api.get('/api/admin/org-tree').then(r => r.data),
  });

  if (isLoading) return <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif", color: '#9ca3af' }}>Loading org chart...</div>;

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

      <OrgTree users={users || []} />
    </div>
  );
}
