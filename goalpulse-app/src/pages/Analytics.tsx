import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart
} from 'recharts';
import { TrendingUp, Grid, PieChart as PieChartIcon, Users, AlertCircle } from 'lucide-react';
import api from '../lib/api';

const IBM = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899'];

const S_CARD: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e8eaed',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
  minHeight: '420px',
  display: 'flex',
  flexDirection: 'column',
};

const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#111827', color: '#fff', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', fontFamily: IBM, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
      <div style={{ fontWeight: '600', marginBottom: '4px', color: '#9ca3af' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill || '#fff' }} />
          <span style={{ fontWeight: '700' }}>{typeof p.value === 'number' ? `${p.value}%` : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<'trends' | 'heatmap' | 'distribution' | 'manager'>('trends');

  const { data, isLoading, error } = useQuery({
    queryKey: ['analyticsData'],
    queryFn: () => api.get('/api/admin/analytics').then(r => r.data),
  });

  const TABS = [
    { id: 'trends' as const, label: 'QoQ Trends', icon: TrendingUp },
    { id: 'heatmap' as const, label: 'Org Heatmap', icon: Grid },
    { id: 'distribution' as const, label: 'Distribution', icon: PieChartIcon },
    { id: 'manager' as const, label: 'Manager Effectiveness', icon: Users },
  ];

  if (isLoading) return (
    <div className="page-container fade-in" style={{ padding: '28px 32px' }}>
      <div className="skeleton" style={{ height: '80px', borderRadius: '12px', marginBottom: '24px' }} />
      <div className="skeleton" style={{ height: '420px', borderRadius: '20px' }} />
    </div>
  );

  if (error) return (
    <div style={{ padding: '40px', display: 'flex', gap: '12px', alignItems: 'center', fontFamily: IBM }}>
      <AlertCircle color="#ef4444" size={20} />
      <span style={{ color: '#ef4444', fontWeight: '600' }}>Failed to load analytics</span>
    </div>
  );

  const { trends, heatmap, distribution, managerEffectiveness } = data;

  const radarData = (() => {
    if (!heatmap || heatmap.length === 0) return [];
    const keys = Object.keys(heatmap[0]).filter((k: string) => k !== 'name');
    return keys.map((k: string) => ({
      subject: k,
      value: Math.round(heatmap.reduce((sum: number, row: any) => sum + (row[k] || 0), 0) / heatmap.length),
    }));
  })();

  return (
    <div className="dash-page-container" style={{ fontFamily: IBM, background: '#f8f9fb' }}>
      <div className="goal-sheet-header" style={{ marginBottom: '28px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Reports</div>
          <h1 className="goal-sheet-title" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '56px', fontWeight: '400', color: '#111827', letterSpacing: '0.03em', lineHeight: 1 }}>Analytics</h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '6px' }}>Deep-dive organizational performance metrics.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px',
              borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              fontFamily: IBM, transition: 'all 0.2s', border: 'none',
              background: activeTab === tab.id ? '#111827' : '#fff',
              color: activeTab === tab.id ? '#fff' : '#6b7280',
              boxShadow: activeTab === tab.id ? '0 4px 14px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
            }}>
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'trends' && (
        <div className="dash-grid-2-wide" style={{ gap: '16px' }}>
          <div style={S_CARD}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', fontWeight: '400', letterSpacing: '0.03em', color: '#111827' }}>Quarter-over-Quarter Score</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '3px' }}>Average achievement across all employees</div>
            </div>
            <div style={{ flex: 1, minHeight: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: IBM }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: IBM }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <RechartsTooltip content={<DarkTooltip />} />
                  <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} fill="url(#areaGrad)"
                    dot={{ fill: '#fff', stroke: '#3b82f6', strokeWidth: 2.5, r: 5 }} activeDot={{ r: 7, fill: '#3b82f6' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={S_CARD}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', fontWeight: '400', letterSpacing: '0.03em', color: '#111827' }}>Org Radar</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '3px' }}>Avg score per quarter across team</div>
            </div>
            <div style={{ flex: 1, minHeight: '280px' }}>
              {radarData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: IBM }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#d1d5db' }} />
                    <Radar name="Avg Score" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} />
                    <RechartsTooltip content={<DarkTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: '13px' }}>
                  Not enough cycle data yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'heatmap' && (
        <div style={S_CARD}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', fontWeight: '400', letterSpacing: '0.03em', color: '#111827' }}>Organization Completion Heatmap</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '3px' }}>Employee scores per quarter — deeper colour = higher score</div>
          </div>
          <div className="table-responsive">
            {heatmap && heatmap.length > 0 ? (
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'separate', borderSpacing: '4px' }}>
                <thead>
                  <tr>
                    <th style={{ fontFamily: IBM, fontSize: '11px', color: '#9ca3af', fontWeight: '700', textAlign: 'left', padding: '4px 8px', minWidth: '150px' }}>Employee</th>
                    {Object.keys(heatmap[0]).filter((k: string) => k !== 'name').map((q: string) => (
                      <th key={q} style={{ fontFamily: IBM, fontSize: '11px', color: '#9ca3af', fontWeight: '700', textAlign: 'center', padding: '4px 8px', minWidth: '80px' }}>{q}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.map((row: any, i: number) => {
                    const keys = Object.keys(row).filter((k: string) => k !== 'name');
                    return (
                      <tr key={i}>
                        <td style={{ fontFamily: IBM, fontSize: '12px', fontWeight: '600', color: '#374151', padding: '4px 8px' }}>{row.name}</td>
                        {keys.map((k: string) => {
                          const val = row[k] || 0;
                          const opacity = val > 0 ? 0.12 + (val / 100) * 0.88 : 0;
                          return (
                            <td key={k} style={{ textAlign: 'center', padding: '4px' }}>
                              <div style={{
                                background: val > 0 ? `rgba(59,130,246,${opacity})` : '#f9fafb',
                                borderRadius: '8px', padding: '8px 4px',
                                fontFamily: MONO, fontSize: '12px', fontWeight: '700',
                                color: val >= 70 ? '#1d4ed8' : val > 0 ? '#3b82f6' : '#d1d5db',
                                border: `1px solid ${val > 0 ? `rgba(59,130,246,${opacity * 0.5})` : '#f0f0f0'}`,
                              }}>
                                {val > 0 ? `${val}%` : '—'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#9ca3af' }}>No data available</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'distribution' && (
        <div className="dash-grid-2" style={{ gap: '16px' }}>
          <div style={S_CARD}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', fontWeight: '400', letterSpacing: '0.03em', color: '#111827', marginBottom: '4px' }}>Goals by Thrust Area</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>Strategic category breakdown</div>
            <div style={{ flex: 1, minHeight: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution.thrustAreas} cx="50%" cy="50%" innerRadius="38%" outerRadius="62%" paddingAngle={4} dataKey="value" strokeWidth={0}>
                    {distribution.thrustAreas.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip content={<DarkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
              {distribution.thrustAreas.map((d: any, i: number) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#6b7280', fontFamily: IBM }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                  {d.name} <span style={{ fontFamily: MONO, fontWeight: '700', color: '#111827' }}>({d.value})</span>
                </div>
              ))}
            </div>
          </div>

          <div style={S_CARD}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', fontWeight: '400', letterSpacing: '0.03em', color: '#111827', marginBottom: '4px' }}>Goals by Measurement Type</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>Unit of measurement distribution</div>
            <div style={{ flex: 1, minHeight: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution.uomTypes} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    {COLORS.map((c, i) => (
                      <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={c} stopOpacity={0.5} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: IBM }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: IBM }} tickLine={false} axisLine={false} />
                  <RechartsTooltip content={<DarkTooltip />} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={60}>
                    {distribution.uomTypes.map((_: any, i: number) => (
                      <Cell key={i} fill={`url(#barGrad${i % COLORS.length})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'manager' && (
        <div style={S_CARD}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', fontWeight: '400', letterSpacing: '0.03em', color: '#111827' }}>Manager Effectiveness</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '3px' }}>Average achievement score of each manager's direct reports</div>
          </div>
          <div style={{ flex: 1 }}>
            {managerEffectiveness && managerEffectiveness.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  {managerEffectiveness.map((m: any, i: number) => {
                    const color = COLORS[i % COLORS.length];
                    return (
                      <div key={m.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div>
                            <span style={{ fontFamily: IBM, fontSize: '13px', fontWeight: '700', color: '#111827' }}>{m.name}</span>
                            <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px', fontFamily: IBM }}>{m.teamSize} reports</span>
                          </div>
                          <span style={{ fontFamily: MONO, fontSize: '14px', fontWeight: '800', color }}>{m.score}%</span>
                        </div>
                        <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '999px',
                            width: `${m.score}%`,
                            background: `linear-gradient(90deg, ${color}88, ${color})`,
                            transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ minHeight: '160px' }}>
                  <ResponsiveContainer width="100%" height={160}>
                    <ComposedChart data={managerEffectiveness} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: IBM }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151', fontFamily: IBM, fontWeight: 600 }} tickLine={false} axisLine={false} />
                      <RechartsTooltip content={<DarkTooltip />} />
                      <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={14}>
                        {managerEffectiveness.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#9ca3af', fontFamily: IBM, fontSize: '14px' }}>No manager data yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
