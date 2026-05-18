import type { ReactNode } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import TeamJoinRequestModal from '../components/TeamJoinRequestModal';
import api from '../lib/api';
import {
  Target,
  Users,
  CheckCircle,
  Award,
  AlertCircle,
  Clock,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

const SANS = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Bebas Neue', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const PALETTE = {
  blue: '#2563eb',
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
  purple: '#7c3aed',
  teal: '#0f766e',
  slate: '#334155',
};

const THRUST_COLORS: Record<string, string> = {
  'Revenue Growth': '#2563eb',
  'Customer Satisfaction': '#16a34a',
  'Operational Efficiency': '#d97706',
  'People Development': '#7c3aed',
  Innovation: '#db2777',
  'Compliance & Risk': '#0f766e',
};

interface Metrics {
  cycle: any;
  totalEmployees: number;
  totalGoals: number;
  approvedSheets: number;
  pendingSheets: number;
  avgScore: number;
  completionRate: number;
  trend: Array<{ cycle: string; avgScore: number; quarter: string }>;
  thrustBreakdown: Record<string, number>;
  distribution: { excellent: number; good: number; average: number; poor: number };
}

const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#0f172a',
        color: '#fff',
        borderRadius: '14px',
        padding: '12px 14px',
        fontSize: '12px',
        fontFamily: SANS,
        boxShadow: '0 18px 36px rgba(15, 23, 42, 0.28)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ color: '#cbd5e1', marginBottom: '5px', fontWeight: 600 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill || '#fff' }} />
          <span style={{ fontWeight: 700 }}>
            {typeof p.value === 'number' ? `${p.value}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  trend,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: any;
  color: string;
  trend?: number;
}) {
  const isTrendUp = (trend || 0) >= 0;
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        borderRadius: '24px',
        padding: '20px 22px',
        boxShadow: '0 1px 1px rgba(15,23,42,0.03), 0 18px 48px rgba(15,23,42,0.04)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -36,
          right: -36,
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: `${color}12`,
          filter: 'blur(2px)',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', position: 'relative' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {title}
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: DISPLAY,
              fontSize: 52,
              fontWeight: 400,
              letterSpacing: '0.03em',
              color: '#0f172a',
              lineHeight: 1,
            }}
          >
            {value}
          </div>
          {sub && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
              {sub}
            </div>
          )}
        </div>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: `${color}14`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={20} color={color} />
        </div>
      </div>

      {trend !== undefined && (
        <div
          style={{
            marginTop: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 10px',
            borderRadius: 999,
            background: isTrendUp ? '#f0fdf4' : '#fef2f2',
            color: isTrendUp ? PALETTE.green : PALETTE.red,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {isTrendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(trend)}% vs last cycle
        </div>
      )}
    </div>
  );
}

function ShellCard({
  title,
  subtitle,
  children,
  tone = 'light',
  extra,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  tone?: 'light' | 'dark';
  extra?: ReactNode;
}) {
  const dark = tone === 'dark';
  return (
    <div
      className="dashboard-shell-card"
      style={{
        background: dark ? '#0f172a' : '#fff',
        color: dark ? '#fff' : '#0f172a',
        border: dark ? '1px solid rgba(148, 163, 184, 0.16)' : '1px solid rgba(148, 163, 184, 0.18)',
        borderRadius: 28,
        padding: 24,
        boxShadow: dark ? '0 28px 60px rgba(15, 23, 42, 0.18)' : '0 1px 1px rgba(15,23,42,0.03), 0 18px 48px rgba(15,23,42,0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 18 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: dark ? 'rgba(255,255,255,0.58)' : '#64748b',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ marginTop: 8, fontSize: 14, color: dark ? 'rgba(255,255,255,0.72)' : '#64748b', lineHeight: 1.6 }}>
              {subtitle}
            </div>
          )}
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user, role } = useAuth();
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery<Metrics>({
    queryKey: ['dashboardMetrics'],
    queryFn: () => api.get('/api/admin/dashboard-metrics').then(r => r.data),
    // Only managers and admins have access to org-wide metrics
    enabled: role === 'MANAGER' || role === 'ADMIN',
  });

  const { data: mySheet, isLoading: sheetLoading } = useQuery({
    queryKey: ['myGoalSheet'],
    queryFn: () => api.get('/api/goal-sheets/mine').then(r => r.data),
  });

  const { data: myTeams } = useQuery({
    queryKey: ['myTeams'],
    queryFn: () => api.get('/api/teams/mine').then(r => r.data),
    enabled: role === 'EMPLOYEE',
  });

  const { data: executive, isLoading: executiveLoading } = useQuery({
    queryKey: ['executiveDashboard'],
    queryFn: () => api.get('/api/admin/executive-dashboard').then(r => r.data),
    // Only managers and admins have access to executive dashboard
    enabled: role === 'ADMIN' || role === 'MANAGER',
  });

  // For employees: only wait on personal sheet. For managers/admins: also wait on metrics.
  const isPageLoading = sheetLoading ||
    ((role === 'MANAGER' || role === 'ADMIN') && (metricsLoading || executiveLoading));

  if (isPageLoading) return <DashboardSkeleton />;

  const thrustData = metrics
    ? Object.entries(metrics.thrustBreakdown || {}).map(([name, count]) => ({
        name,
        short: name.replace(' Growth', '').replace(' Satisfaction', '').replace(' Efficiency', '').replace(' Development', ' Dev'),
        count,
        color: THRUST_COLORS[name] || PALETTE.slate,
      }))
    : [];

  const distData = metrics
    ? [
        { name: 'Excellent', value: metrics.distribution?.excellent || 0, fill: PALETTE.green },
        { name: 'Good', value: metrics.distribution?.good || 0, fill: PALETTE.blue },
        { name: 'Average', value: metrics.distribution?.average || 0, fill: PALETTE.amber },
        { name: 'Poor', value: metrics.distribution?.poor || 0, fill: PALETTE.red },
      ]
    : [];
  const scoreTotal = distData.reduce((sum, item) => sum + item.value, 0);
  const positiveTotal = (metrics?.distribution?.excellent || 0) + (metrics?.distribution?.good || 0);
  const attentionTotal = scoreTotal - positiveTotal;

  const myGoals = mySheet?.sheet?.goals || [];
  const mySheetStatus = mySheet?.sheet?.status || 'NOT_STARTED';
  const myTotalWeightage = mySheet?.sheet?.totalWeightage || 0;
  const cycleWindow = mySheet?.cycle?.window;

  const openCycleLabel = metrics?.cycle
    ? `${metrics.cycle.name} · ${metrics.cycle.open_date} to ${metrics.cycle.close_date}`
    : 'No active cycle';

  return (
    <div
      className="dash-page-container"
      style={{
        minHeight: '100%',
        fontFamily: SANS,
        background:
          'radial-gradient(circle at top left, rgba(37, 99, 235, 0.05), transparent 28%), radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.05), transparent 30%), #f5f7fb',
      }}
    >
      <div className="goal-sheet-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#64748b', marginBottom: 10 }}>
            {metrics?.cycle ? 'Overview' : 'Dashboard'}
          </div>
          <h1
            className="goal-sheet-title"
            style={{
              margin: 0,
              fontFamily: DISPLAY,
              fontSize: 'clamp(44px, 6vw, 76px)',
              fontWeight: 400,
              lineHeight: 0.92,
              letterSpacing: '0.03em',
              color: '#0f172a',
              textTransform: 'uppercase',
            }}
          >
            Welcome back, {user?.name?.split(' ')[0] || 'there'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <span style={{ color: '#475569', fontSize: 14 }}>{openCycleLabel}</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 999,
                background: metrics?.cycle?.status === 'OPEN' ? '#ecfdf5' : '#f8fafc',
                border: '1px solid rgba(148, 163, 184, 0.18)',
                color: metrics?.cycle?.status === 'OPEN' ? PALETTE.green : '#64748b',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: metrics?.cycle?.status === 'OPEN' ? PALETTE.green : '#94a3b8' }} />
              {metrics?.cycle?.status || 'No cycle'}
            </span>
          </div>
        </div>

        {metrics && (role === 'MANAGER' || role === 'ADMIN') && (
          <div
            style={{
              minWidth: 220,
              padding: '18px 22px',
              borderRadius: 24,
              background: '#fff',
              color: '#0f172a',
              boxShadow: '0 1px 1px rgba(15,23,42,0.03), 0 18px 48px rgba(15,23,42,0.05)',
              border: '1px solid rgba(148, 163, 184, 0.18)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#64748b' }}>
              Team completion
            </div>
            <div style={{ marginTop: 10, fontFamily: DISPLAY, fontSize: 58, fontWeight: 400, lineHeight: 1, color: '#0f172a' }}>
              {metrics.completionRate}%
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
              Approved sheets and active check-ins across the current cycle.
            </div>
          </div>
        )}
      </div>

      {executive && (
        <div style={{ marginBottom: 24 }}>
          <div className="dash-grid-2-wide">
            <ShellCard
              title="Executive Command Center"
              subtitle={executive.weeklySummary?.headline || 'Live organization pulse for the current cycle.'}
              extra={<MiniPill label="Judge Mode" />}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
                {[
                  { label: 'Score', value: `${executive.executiveScore || 0}%`, color: PALETTE.blue },
                  { label: 'Employees', value: executive.totalEmployees || 0, color: PALETTE.green },
                  { label: 'Goals', value: executive.totalGoals || 0, color: PALETTE.purple },
                  { label: 'Risks', value: executive.riskAlerts?.length || 0, color: PALETTE.red },
                ].map(item => (
                  <div key={item.label} style={{ padding: 14, borderRadius: 18, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>{item.label}</div>
                    <div style={{ marginTop: 8, fontFamily: DISPLAY, fontSize: 38, fontWeight: 400, lineHeight: 1, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 14 }}>
                <div style={{ padding: 16, borderRadius: 18, background: '#0f172a', color: '#fff' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Weekly Summary</div>
                  <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.7 }}>{executive.weeklySummary?.headline}</div>
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(executive.weeklySummary?.bullets || []).map((bullet: string) => (
                      <div key={bullet} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', marginTop: 7, flexShrink: 0 }} />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: 16, borderRadius: 18, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#64748b' }}>Business Impact</div>
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(executive.businessImpact || []).map((item: any) => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{item.label}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Live impact metric</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 400, lineHeight: 1, color: PALETTE.blue }}>{item.value}</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: PALETTE.green, marginTop: 2 }}>{item.delta}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ShellCard>

            <ShellCard
              title="Risk Radar"
              subtitle="Intelligent at-risk goals detected before deadlines slip."
              extra={<MiniPill label="At Risk" />}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(executive.riskAlerts || []).slice(0, 5).map((risk: any) => (
                  <div key={risk.goal_id} style={{ padding: 14, borderRadius: 16, background: risk.severity === 'HIGH' ? '#fff1f2' : '#fff7ed', border: `1px solid ${risk.severity === 'HIGH' ? '#fecdd3' : '#fed7aa'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{risk.goal_title}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>{risk.employee_name} · {risk.department} · {risk.thrust_area}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: risk.severity === 'HIGH' ? '#dc2626' : '#d97706' }}>
                        {risk.riskScore} / 100
                      </div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                      {(risk.reasons || []).slice(0, 2).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </ShellCard>
          </div>
        </div>
      )}

      {mySheet && (
        <div style={{ marginBottom: 24 }}>
          <div
            className="dash-grid-2-sidebar"
          >
            <ShellCard
              title="My Goal Sheet"
              subtitle={`Status: ${mySheetStatus.replace(/_/g, ' ')} · ${myGoals.length} goals · ${myTotalWeightage}% allocated`}
              extra={<GoalStatusPill status={mySheetStatus} />}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ padding: '8px 12px', borderRadius: 999, background: '#f8fafc', color: '#0f172a', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {cycleWindow?.canWrite ? 'Editable now' : cycleWindow?.reason || 'Read only'}
                </span>
                <span style={{ padding: '8px 12px', borderRadius: 999, background: '#f8fafc', color: '#0f172a', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {myGoals.length} goals
                </span>
                <span style={{ padding: '8px 12px', borderRadius: 999, background: '#f8fafc', color: '#0f172a', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {myTotalWeightage}% weightage
                </span>
              </div>

              <div style={{ marginTop: 22, height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(myTotalWeightage, 100)}%`,
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #22c55e, #60a5fa)',
                  }}
                />
              </div>
            </ShellCard>

            <div className="dash-grid-2" style={{ marginBottom: 0 }}>
              <MetricCard
                title="My goals"
                value={myGoals.length}
                icon={Target}
                color={PALETTE.blue}
                sub="Goals in this cycle"
              />
              <MetricCard
                title="Weightage"
                value={`${myTotalWeightage}%`}
                icon={BarChart3}
                color={myTotalWeightage === 100 ? PALETTE.green : PALETTE.amber}
                sub={myTotalWeightage === 100 ? 'Fully allocated' : `${100 - myTotalWeightage}% remaining`}
              />
            </div>
          </div>
        </div>
      )}

      {role === 'EMPLOYEE' && myTeams && (
        <div style={{ marginBottom: 24 }}>
          <ShellCard
            title="My Teams"
            subtitle="Team memberships and join requests"
            extra={
              <button
                onClick={() => setJoinModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#0f172a',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <Users size={16} />
                Request Join
              </button>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 16 }}>
              {(myTeams.memberships || []).map((membership: any) => (
                <div key={membership.id} style={{ padding: 18, borderRadius: 18, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{membership.team?.name}</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                    Managed by {membership.team?.manager?.name || 'N/A'}
                  </div>
                  
                  {/* Team Progress Indicator */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      <span>Team Goals: {membership.team?.goal_count || 0}</span>
                      <span>{membership.team?.avg_progress || 0}%</span>
                    </div>
                    <div style={{ height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${membership.team?.avg_progress || 0}%`, background: '#2563eb', borderRadius: 999 }} />
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: '#ecfdf5', color: '#166534', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
                    Active member
                  </div>
                </div>
              ))}
              {!myTeams.memberships?.length && (
                <div style={{ gridColumn: '1 / -1', padding: 18, borderRadius: 18, background: '#f8fafc', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                  You are not part of any teams yet.
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 10 }}>Requests</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(myTeams.requests || []).map((request: any) => (
                  <div key={request.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{request.team?.name}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>Requested {new Date(request.requested_at).toLocaleDateString()}</div>
                    </div>
                    <span style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 800,
                      background: request.status === 'approved' ? '#f0fdf4' : request.status === 'rejected' ? '#fef2f2' : '#eff6ff',
                      color: request.status === 'approved' ? '#166534' : request.status === 'rejected' ? '#b91c1c' : '#1d4ed8',
                      whiteSpace: 'nowrap',
                    }}>
                      {request.status}
                    </span>
                  </div>
                ))}
                {!myTeams.requests?.length && (
                  <div style={{ padding: 16, borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }}>
                    No outstanding requests.
                  </div>
                )}
              </div>
            </div>
          </ShellCard>
        </div>
      )}

      {(role === 'MANAGER' || role === 'ADMIN') && metrics && (
        <>
          <div className="dash-grid-4">
            <MetricCard title="Total employees" value={metrics.totalEmployees} icon={Users} color={PALETTE.blue} sub="In organisation" />
            <MetricCard title="Approved sheets" value={metrics.approvedSheets} icon={CheckCircle} color={PALETTE.green} sub={`${metrics.completionRate}% completion`} />
            <MetricCard title="Pending review" value={metrics.pendingSheets} icon={Clock} color={PALETTE.amber} sub="Awaiting approval" />
            <MetricCard
              title="Avg achievement"
              value={`${metrics.avgScore}%`}
              icon={Award}
              color={PALETTE.purple}
              sub="Across all goals"
              trend={metrics.avgScore > 0 ? Math.round(metrics.avgScore - 75) : undefined}
            />
          </div>

          <div className="dash-grid-2-wide">
            <ShellCard
              title="Performance trend"
              subtitle="Average achievement score across cycles"
              extra={<MiniPill label="QoQ" />}
            >
              {metrics.trend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={270}>
                  <AreaChart
                    data={metrics.trend}
                    margin={{ top: 10, right: 12, left: -14, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PALETTE.blue} stopOpacity={0.32} />
                        <stop offset="100%" stopColor={PALETTE.blue} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="trendStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#14b8a6" />
                        <stop offset="55%" stopColor={PALETTE.blue} />
                        <stop offset="100%" stopColor={PALETTE.purple} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                    <XAxis
                      dataKey="quarter"
                      tick={{ fontSize: 12, fill: '#64748b', fontFamily: SANS }}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={12}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: '#64748b', fontFamily: SANS }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `${v}%`}
                      tickMargin={10}
                    />
                    <Tooltip content={<DarkTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="avgScore"
                      stroke="url(#trendStroke)"
                      strokeWidth={3.5}
                      fill="url(#trendFill)"
                      dot={{ fill: '#fff', stroke: PALETTE.blue, strokeWidth: 2.5, r: 4.5 }}
                      activeDot={{ r: 7, fill: PALETTE.blue, stroke: '#fff', strokeWidth: 2 }}
                      isAnimationActive
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No historical data yet" />
              )}
            </ShellCard>

            <ShellCard title="Score bands" subtitle="Distribution of achievement outcomes" extra={<MiniPill label="Live mix" />}>
              {distData.some(d => d.value > 0) ? (
                <div className="dashboard-donut-grid">
                  <div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={distData}
                          dataKey="value"
                          cx="50%"
                          cy="48%"
                          innerRadius={58}
                          outerRadius={94}
                          paddingAngle={3}
                          cornerRadius={8}
                          startAngle={90}
                          endAngle={-270}
                          stroke="#fff"
                          strokeWidth={4}
                          isAnimationActive
                          animationDuration={800}
                        >
                          {distData.map(entry => {
                            const fillMap: Record<string, string> = {
                              Excellent: '#16a34a',
                              Good: '#2563eb',
                              Average: '#d97706',
                              Poor: '#dc2626',
                            };
                            return <Cell key={entry.name} fill={fillMap[entry.name] || entry.fill} />;
                          })}
                        </Pie>
                        <Tooltip content={<DarkTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: '#64748b', fontWeight: 700 }}>Total</span>
                      <span style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 400, color: '#0f172a', lineHeight: 1 }}>
                        {scoreTotal}
                      </span>
                      <span style={{ fontSize: 13, color: '#64748b', fontWeight: 700 }}>
                        {positiveTotal} strong, {attentionTotal} need attention
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {distData.map(d => (
                      <div
                        key={d.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '12px 14px',
                          borderRadius: 16,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: '#334155', fontWeight: 700 }}>{d.name}</span>
                        </div>
                        <span style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 400, color: '#0f172a', lineHeight: 1 }}>
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyChart message="No scores yet" />
              )}
            </ShellCard>
          </div>

          <div className="dash-grid-2">
            <ShellCard title="Goals by thrust area" subtitle="Strategic goal distribution">
              {thrustData.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(260, thrustData.length * 58)}>
                  <BarChart
                    data={thrustData}
                    layout="vertical"
                    margin={{ top: 10, right: 18, left: 18, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: '#64748b', fontFamily: SANS }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fontSize: 12, fill: '#334155', fontFamily: SANS, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<DarkTooltip />} />
                    <Bar
                      dataKey="count"
                      radius={[0, 14, 14, 0]}
                      isAnimationActive
                    >
                      {thrustData.map((entry, i) => (
                        <Cell key={entry.name} fill={`url(#thrustGrad-${i})`} />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="right"
                        fill="#0f172a"
                        fontSize={12}
                        fontWeight={700}
                        fontFamily={SANS}
                      />
                    </Bar>
                    <defs>
                      {thrustData.map((entry, i) => (
                        <linearGradient key={entry.name} id={`thrustGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={`${entry.color}cc`} />
                          <stop offset="100%" stopColor={entry.color} />
                        </linearGradient>
                      ))}
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No goals created yet" />
              )}
            </ShellCard>

            <ShellCard title="Goal sheet funnel" subtitle="Current cycle pipeline">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'Total employees', val: metrics.totalEmployees, max: metrics.totalEmployees, color: '#64748b' },
                  { label: 'Sheets active', val: metrics.approvedSheets + metrics.pendingSheets, max: metrics.totalEmployees, color: PALETTE.blue },
                  { label: 'Pending approval', val: metrics.pendingSheets, max: metrics.totalEmployees, color: PALETTE.amber },
                  { label: 'Approved', val: metrics.approvedSheets, max: metrics.totalEmployees, color: PALETTE.green },
                ].map(row => (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: '#334155', fontWeight: 700 }}>{row.label}</span>
                      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: row.color }}>{row.val}</span>
                    </div>
                    <div style={{ height: 10, background: '#eef2f7', borderRadius: 999, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${row.max > 0 ? (row.val / row.max) * 100 : 0}%`,
                          borderRadius: 999,
                          background: `linear-gradient(90deg, ${row.color}88, ${row.color})`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ShellCard>
          </div>
        </>
      )}

      {role === 'EMPLOYEE' && myGoals.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <ShellCard title="My goals this cycle" subtitle="A grounded view of your current objectives">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myGoals.map((g: any) => (
                <div
                  key={g.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '16px 18px',
                    background: '#f8fafc',
                    borderRadius: 18,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      background: THRUST_COLORS[g.thrust_area] || '#64748b',
                      borderRadius: '50%',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{g.title}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 5 }}>
                      {g.thrust_area} · Target: {g.target_value}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 400, letterSpacing: '0.02em', color: '#0f172a' }}>
                      {g.weightage}%
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>weight</div>
                  </div>
                </div>
              ))}
            </div>
          </ShellCard>
        </div>
      )}

      {metricsError && (
        <div
          style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: 20,
            padding: 22,
            textAlign: 'center',
          }}
        >
          <AlertCircle size={32} color="#dc2626" style={{ margin: '0 auto 8px', display: 'block' }} />
          <div style={{ fontWeight: 800, color: '#b91c1c' }}>Could not load dashboard metrics</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Ensure the API is running on port 3001.</div>
        </div>
      )}

      {joinModalOpen && <TeamJoinRequestModal onClose={() => setJoinModalOpen(false)} />}
    </div>
  );
}

function MiniPill({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: '8px 12px',
        borderRadius: 999,
        background: '#eff6ff',
        color: PALETTE.blue,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function GoalStatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    APPROVED: { bg: '#ecfdf5', color: PALETTE.green, label: 'Approved' },
    PENDING_APPROVAL: { bg: '#eff6ff', color: PALETTE.blue, label: 'Pending' },
    DRAFT: { bg: '#fff7ed', color: PALETTE.amber, label: 'Draft' },
    NOT_STARTED: { bg: '#f8fafc', color: '#64748b', label: 'Not started' },
  };
  const value = map[status] || map.NOT_STARTED;
  return (
    <span
      style={{
        padding: '8px 12px',
        borderRadius: 999,
        background: value.bg,
        color: value.color,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {value.label}
    </span>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div
      style={{
        height: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#cbd5e1',
        fontSize: 14,
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <BarChart3 size={32} color="#cbd5e1" />
      {message}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ padding: '24px 28px 32px', fontFamily: SANS }}>
      <div className="skeleton" style={{ height: 86, borderRadius: 24, marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.9fr', gap: 16, marginBottom: 16 }}>
        <div className="skeleton" style={{ height: 190, borderRadius: 28 }} />
        <div className="skeleton" style={{ height: 190, borderRadius: 28 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton" style={{ height: 144, borderRadius: 24 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="skeleton" style={{ height: 290, borderRadius: 28 }} />
        <div className="skeleton" style={{ height: 290, borderRadius: 28 }} />
      </div>
    </div>
  );
}

