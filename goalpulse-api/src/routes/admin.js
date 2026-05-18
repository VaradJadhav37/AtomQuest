// src/routes/admin.js — Supabase JS client version
const express = require('express');
const XLSX = require('xlsx');
const { supabase } = require('../db');
const { requireAuth } = require('./auth');
const {
  aiMetrics,
  cycleWindowStatus,
  normalizeUomType,
  buildGoalCascadeTree,
  buildRiskSignals,
  parseAuditDetail,
  compareCycles,
  buildScoreExplanation,
} = require('../services/goalkeeper');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  next();
}
function requireManagerOrAdmin(req, res, next) {
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) return res.status(403).json({ error: 'Manager or Admin only' });
  next();
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
}

async function logAdminEvent({ userId, action, entity, entityId, detail }) {
  await supabase.from('audit_log').insert({
    user_id: userId,
    action,
    entity,
    entity_id: entityId,
    detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
  });
}

async function getTeam(teamId) {
  const { data } = await supabase.from('teams').select('*').eq('id', teamId).maybeSingle();
  return data || null;
}

async function getUser(userId) {
  const { data } = await supabase.from('users').select('id, name, email, role, department, manager_id, is_active, created_at').eq('id', userId).maybeSingle();
  return data || null;
}

async function getOpenCycle() {
  const { data } = await supabase.from('cycles').select('*').eq('status', 'OPEN').order('year', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

async function getPreviousCycle(currentCycle) {
  if (!currentCycle) return null;
  const { data } = await supabase.from('cycles').select('*').order('year', { ascending: false }).order('quarter', { ascending: false });
  const list = data || [];
  return list.find(c => c.year < currentCycle.year || (c.year === currentCycle.year && c.quarter < currentCycle.quarter)) || null;
}

async function fetchCoreData(cycle) {
  let auditQuery = supabase.from('audit_log').select('id, user_id, action, entity, entity_id, detail, ts').order('ts', { ascending: false });
  if (cycle?.open_date) {
    auditQuery = auditQuery.gte('ts', `${cycle.open_date}T00:00:00Z`);
  }
  if (cycle?.close_date) {
    auditQuery = auditQuery.lte('ts', `${cycle.close_date}T23:59:59Z`);
  }
  auditQuery = auditQuery.limit(500);

  const [usersRes, sheetsRes, goalsRes, achievementsRes, checkinsRes, auditsRes, cyclesRes] = await Promise.all([
    supabase.from('users').select('id, name, email, role, department, manager_id, created_at'),
    supabase.from('goal_sheets').select('id, employee_id, cycle_id, status, locked_at, created_at'),
    supabase.from('goals').select('id, goal_sheet_id, title, uom_type, target_value, weightage, thrust_area, description, created_at'),
    supabase.from('goal_achievements').select('id, goal_id, cycle_id, actual_value, score, submitted_at'),
    supabase.from('check_ins').select('id, goal_id, cycle_id, status, employee_comment, manager_comment, employee_submitted_at, manager_submitted_at'),
    auditQuery,
    supabase.from('cycles').select('*').order('year', { ascending: false }).order('quarter', { ascending: false }).limit(8),
  ]);

  const users = usersRes.data || [];
  const sheets = cycle ? (sheetsRes.data || []).filter(sheet => Number(sheet.cycle_id) === Number(cycle.id)) : (sheetsRes.data || []);
  const goalSheetIds = sheets.map(sheet => sheet.id);
  const goals = goalSheetIds.length
    ? (goalsRes.data || []).filter(goal => goalSheetIds.includes(goal.goal_sheet_id))
    : (goalsRes.data || []);
  const goalIds = goals.map(goal => goal.id);
  const achievements = goalIds.length
    ? (achievementsRes.data || []).filter(item => goalIds.includes(item.goal_id))
    : (achievementsRes.data || []);
  const checkins = goalIds.length
    ? (checkinsRes.data || []).filter(item => goalIds.includes(item.goal_id))
    : (checkinsRes.data || []);

  return {
    users,
    sheets,
    goals,
    achievements,
    checkins,
    audits: auditsRes.data || [],
    cycles: cyclesRes.data || [],
  };
}

// GET /api/admin/completion
router.get('/completion', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const { data: cycle } = await supabase.from('cycles').select('*').eq('status', 'OPEN').order('year', { ascending: false }).limit(1).maybeSingle();
    if (!cycle) return res.json({ totalEmployees: 0, sheets: [], cycle: null, summary: {} });

    // Bulk-fetch everything in parallel — eliminates the N+1 pattern
    const [{ data: employees }, { data: sheets }, { data: allGoals }, { data: allAchievements }] = await Promise.all([
      supabase.from('users').select('id, name, email, department').eq('role', 'EMPLOYEE'),
      supabase.from('goal_sheets').select('*').eq('cycle_id', cycle.id),
      supabase.from('goals').select('id, goal_sheet_id, weightage'),
      supabase.from('goal_achievements').select('goal_id, score').eq('cycle_id', cycle.id),
    ]);

    // Build O(1) lookup maps
    const sheetByEmployee = new Map((sheets || []).map(s => [s.employee_id, s]));
    const goalsBySheet = new Map();
    (allGoals || []).forEach(g => {
      const list = goalsBySheet.get(g.goal_sheet_id) || [];
      list.push(g);
      goalsBySheet.set(g.goal_sheet_id, list);
    });
    const achievementsByGoal = new Map((allAchievements || []).map(a => [a.goal_id, a]));

    const stats = (employees || []).map(emp => {
      const sheet = sheetByEmployee.get(emp.id) || null;
      const goals = sheet ? (goalsBySheet.get(sheet.id) || []) : [];
      const totalWeightage = goals.reduce((s, g) => s + Number(g.weightage || 0), 0);
      const achievements = goals.map(g => achievementsByGoal.get(g.id)).filter(Boolean);
      const weightedScore = achievements.reduce((s, a) => {
        const goal = goals.find(g => g.id === a.goal_id);
        return s + (Number(a.score || 0)) * (goal ? Number(goal.weightage || 0) / 100 : 0);
      }, 0);
      return {
        employee: emp,
        sheetStatus: sheet?.status || 'NOT_STARTED',
        goalsCount: goals.length,
        totalWeightage,
        achievementsCount: achievements.length,
        overallScore: Math.round(weightedScore * 10) / 10,
        checkInsComplete: goals.length > 0 && achievements.length === goals.length,
      };
    });

    const summary = {
      totalEmployees: stats.length,
      approved: stats.filter(s => s.sheetStatus === 'APPROVED').length,
      pending: stats.filter(s => s.sheetStatus === 'PENDING_APPROVAL').length,
      draft: stats.filter(s => s.sheetStatus === 'DRAFT').length,
      notStarted: stats.filter(s => s.sheetStatus === 'NOT_STARTED').length,
      checkInsComplete: stats.filter(s => s.checkInsComplete).length,
      totalSheets: (sheets || []).length,
    };

    res.json({ cycle, summary, employees: stats });
  } catch (err) {
    console.error('GET /completion:', err);
    res.status(500).json({ error: err.message });
  }
});


// GET /api/admin/dashboard-metrics — REAL metrics for the Overview dashboard
router.get('/dashboard-metrics', requireAuth, async (req, res) => {
  try {
    const cycle = await getOpenCycle();
    const previousCycle = await getPreviousCycle(cycle);
    const { data: allCycles } = await supabase.from('cycles').select('*').order('year', { ascending: false }).order('quarter', { ascending: false }).limit(6);
    const { data: employees } = await supabase.from('users').select('id');
    const { data: allSheets } = await supabase.from('goal_sheets').select('id, status, cycle_id, employee_id, created_at');
    const { data: currentGoals } = cycle && allSheets?.length
      ? await supabase.from('goals').select('id, weightage, goal_sheet_id').in('goal_sheet_id', allSheets.filter(s => s.cycle_id === cycle.id).map(s => s.id))
      : { data: [] };
    const { data: allGoals } = await supabase.from('goals').select('id, weightage, goal_sheet_id, thrust_area, uom_type, title');
    const { data: allAchievements } = await supabase.from('goal_achievements').select('score, goal_id, cycle_id, actual_value, submitted_at');
    const { data: allCheckins } = await supabase.from('check_ins').select('goal_id, cycle_id, status, employee_submitted_at, manager_submitted_at');

    const totalEmployees = (employees || []).length;
    const totalGoals = (currentGoals || []).length;
    const approvedSheets = (allSheets || []).filter(s => cycle && s.cycle_id === cycle.id && s.status === 'APPROVED').length;
    const pendingSheets = (allSheets || []).filter(s => cycle && s.cycle_id === cycle.id && s.status === 'PENDING_APPROVAL').length;

    const scores = (allAchievements || []).filter(a => a.score != null && (!cycle || a.cycle_id === cycle.id)).map(a => a.score);
    const avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;

    const trend = (allCycles || []).map(c => {
      const cycleAch = (allAchievements || []).filter(a => a.cycle_id === c.id && a.score != null);
      const avg = cycleAch.length ? Math.round(cycleAch.reduce((s, a) => s + Number(a.score || 0), 0) / cycleAch.length * 10) / 10 : 0;
      return { cycle: c.name, avgScore: avg, quarter: `Q${c.quarter} ${c.year}` };
    }).reverse();

    const goalSheetIds = (allSheets || []).filter(s => cycle && s.cycle_id === cycle.id).map(s => s.id);
    const goalDetails = goalSheetIds.length
      ? (allGoals || []).filter(g => goalSheetIds.includes(g.goal_sheet_id))
      : (allGoals || []);
    const thrustBreakdown = {};
    (goalDetails || []).forEach(g => {
      thrustBreakdown[g.thrust_area] = (thrustBreakdown[g.thrust_area] || 0) + 1;
    });
    const uomBreakdown = {};
    (goalDetails || []).forEach(g => {
      const key = normalizeUomType(g.uom_type);
      uomBreakdown[key] = (uomBreakdown[key] || 0) + 1;
    });

    const distribution = { excellent: 0, good: 0, average: 0, poor: 0 };
    (allAchievements || []).forEach(a => {
      if (a.score >= 90) distribution.excellent++;
      else if (a.score >= 75) distribution.good++;
      else if (a.score >= 50) distribution.average++;
      else distribution.poor++;
    });

    const riskAlerts = buildRiskSignals({
      cycle,
      goals: goalDetails || [],
      sheets: (allSheets || []).filter(s => !cycle || s.cycle_id === cycle.id),
      achievements: allAchievements || [],
      checkins: allCheckins || [],
      users: (await supabase.from('users').select('id, name, email, department, manager_id, role')).data || [],
    }).slice(0, 6);

    const latestTrend = trend[trend.length - 1] || null;
    const priorTrend = trend[trend.length - 2] || null;
    const previousTrend = latestTrend && priorTrend
      ? compareCycles(
          {
            cycle: allCycles?.[0] || null,
            overallScore: latestTrend.avgScore || 0,
            completionRate: approvedSheets,
          },
          {
            cycle: previousCycle,
            overallScore: priorTrend.avgScore || 0,
            completionRate: 0,
          }
        )
      : null;

    const weeklySummary = {
      headline: cycle
        ? `${cycle.name} is at ${approvedSheets} approved sheets and ${avgScore}% average achievement.`
        : 'No active cycle found.',
      bullets: [
        `${pendingSheets} sheets are pending approval.`,
        `${riskAlerts.filter(item => item.severity === 'HIGH').length} goals are at high risk.`,
        `${totalGoals} goals are active in the current cycle.`,
      ],
    };

    const businessImpact = [
      {
        label: 'Goal completion lift',
        value: `${Math.max(0, Math.round(avgScore - 70))}%`,
        delta: `${Math.max(0, Math.round((avgScore - 70) * 1.2))}%`,
      },
      {
        label: 'Delayed reviews reduced',
        value: `${Math.max(0, 100 - pendingSheets)}%`,
        delta: `${Math.max(0, Math.round((approvedSheets / Math.max(1, totalEmployees)) * 100))}%`,
      },
      {
        label: 'Org alignment score',
        value: `${Math.min(100, Math.round((approvedSheets / Math.max(1, totalEmployees)) * 100))}%`,
        delta: `${Math.max(0, Math.round((approvedSheets / Math.max(1, totalEmployees)) * 100 - 10))}%`,
      },
    ];

    res.json({
      cycle,
      previousCycle,
      totalEmployees,
      totalGoals,
      approvedSheets,
      pendingSheets,
      avgScore,
      completionRate: totalEmployees > 0 ? Math.min(100, Math.round((approvedSheets / totalEmployees) * 100)) : 0,
      trend,
      thrustBreakdown,
      distribution: { ...distribution, uomTypes: Object.entries(uomBreakdown).map(([name, value]) => ({ name, value })) },
      recentActivity: (await supabase.from('audit_log').select('id, action, entity, entity_id, detail, ts, users(name, email)').order('ts', { ascending: false }).limit(8)).data || [],
      riskAlerts,
      weeklySummary,
      businessImpact,
      qoq: previousTrend,
      executiveScore: Math.min(100, Math.round((avgScore + Math.min(100, Math.round((approvedSheets / Math.max(1, totalEmployees)) * 100))) / 2)),
    });
  } catch (err) {
    console.error('GET /dashboard-metrics:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/executive-dashboard
router.get('/executive-dashboard', requireAuth, async (req, res) => {
  try {
    const cycle = await getOpenCycle();
    const core = await fetchCoreData(cycle);
    const goalCascade = buildGoalCascadeTree({ cycle, ...core });
    const riskAlerts = buildRiskSignals({ cycle, ...core }).slice(0, 10);
    const totalGoals = core.goals.length || 1;
    const approvedSheets = core.sheets.filter(sheet => sheet.status === 'APPROVED').length;
    const completionRate = Math.min(100, Math.round((approvedSheets / Math.max(1, core.users.filter(u => u.role === 'EMPLOYEE').length)) * 100));
    const avgScore = core.achievements.filter(a => a.score != null).length
      ? Math.round((core.achievements.reduce((sum, a) => sum + Number(a.score || 0), 0) / core.achievements.filter(a => a.score != null).length) * 10) / 10
      : 0;
    const recentActivity = core.audits.slice(0, 10).map(item => ({
      id: item.id,
      action: item.action,
      entity: item.entity,
      entity_id: item.entity_id,
      ts: item.ts,
      user: item.users || null,
      detail: parseAuditDetail(item.detail),
    }));
    const impact = [
      { label: 'Active cycles', value: core.cycles.length },
      { label: 'Approved sheets', value: approvedSheets },
      { label: 'Risk alerts', value: riskAlerts.length },
      { label: 'Alignment score', value: Math.min(100, Math.round((completionRate + avgScore) / 2)) },
    ];

    res.json({
      cycle,
      executiveScore: Math.min(100, Math.round((completionRate + avgScore) / 2)),
      activeCycles: core.cycles.filter(c => c.status === 'OPEN').length,
      totalEmployees: core.users.filter(u => u.role === 'EMPLOYEE').length,
      totalGoals,
      approvedSheets,
      pendingSheets: core.sheets.filter(sheet => sheet.status === 'PENDING_APPROVAL').length,
      completionRate,
      avgScore,
      goalCascade,
      riskAlerts,
      recentActivity,
      businessImpact: impact,
      weeklySummary: {
        headline: cycle
          ? `${cycle.name} is tracking at ${completionRate}% completion and ${avgScore}% average achievement.`
          : 'No active cycle found.',
        bullets: [
          `${riskAlerts.filter(item => item.severity === 'HIGH').length} goals need immediate attention.`,
          `${core.sheets.filter(sheet => sheet.status === 'PENDING_APPROVAL').length} sheets are awaiting review.`,
          `${core.goals.filter(goal => goal.thrust_area).length} goals are mapped to strategic thrust areas.`,
        ],
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/risk-alerts
router.get('/risk-alerts', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const cycle = await getOpenCycle();
    const core = await fetchCoreData(cycle);
    res.json(buildRiskSignals({ cycle, ...core }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/company-goal-cascade
router.get('/company-goal-cascade', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const cycle = await getOpenCycle();
    const core = await fetchCoreData(cycle);
    res.json(buildGoalCascadeTree({ cycle, ...core }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/audit-replay
router.get('/audit-replay', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const { data: rows } = await supabase
      .from('audit_log')
      .select('id, user_id, action, entity, entity_id, detail, ts, users(name, email, role)')
      .order('ts', { ascending: false })
      .limit(200);

    const replay = (rows || []).map(row => {
      const detail = parseAuditDetail(row.detail);
      return {
        id: row.id,
        action: row.action,
        entity: row.entity,
        entity_id: row.entity_id,
        timestamp: row.ts,
        role: row.users?.role || 'UNKNOWN',
        user_name: row.users?.name || 'System',
        user_email: row.users?.email || '',
        before: detail.before,
        after: detail.after,
        note: detail.note || detail.raw,
        raw: detail.raw,
      };
    });

    res.json(replay);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/weekly-summary
router.get('/weekly-summary', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const cycle = await getOpenCycle();
    const core = await fetchCoreData(cycle);
    const riskAlerts = buildRiskSignals({ cycle, ...core }).slice(0, 5);
    const scored = core.achievements.filter(a => a.score != null);
    const avgScore = scored.length ? Math.round((scored.reduce((s, a) => s + Number(a.score || 0), 0) / scored.length) * 10) / 10 : 0;
    const approvedSheets = core.sheets.filter(sheet => sheet.status === 'APPROVED').length;
    res.json({
      headline: cycle
        ? `${cycle.name}: ${approvedSheets} approved sheets, ${avgScore}% average achievement, ${riskAlerts.length} risk signals.`
        : 'No active cycle.',
      bullets: [
        `${core.sheets.filter(sheet => sheet.status === 'PENDING_APPROVAL').length} sheets are pending review.`,
        `${riskAlerts.filter(alert => alert.severity === 'HIGH').length} goals are high risk.`,
        `${core.goals.length} goals are active in the current cycle.`,
      ],
      riskAlerts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/qoq-insights
router.get('/qoq-insights', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const { data: cycles } = await supabase.from('cycles').select('*').order('year', { ascending: false }).order('quarter', { ascending: false }).limit(6);
    const { data: goals } = await supabase.from('goals').select('id, goal_sheet_id, title, thrust_area, uom_type, weightage');
    const { data: sheets } = await supabase.from('goal_sheets').select('id, employee_id, cycle_id, status');
    const { data: achievements } = await supabase.from('goal_achievements').select('goal_id, cycle_id, score');
    const rows = (cycles || []).map(cycle => {
      const cycleGoals = (goals || []).filter(goal => (sheets || []).some(sheet => sheet.id === goal.goal_sheet_id && sheet.cycle_id === cycle.id));
      const cycleSheets = (sheets || []).filter(sheet => sheet.cycle_id === cycle.id);
      const cycleAchs = (achievements || []).filter(ach => ach.cycle_id === cycle.id);
      const avg = cycleAchs.length ? Math.round((cycleAchs.reduce((sum, ach) => sum + Number(ach.score || 0), 0) / cycleAchs.length) * 10) / 10 : 0;
      const approved = cycleSheets.filter(sheet => sheet.status === 'APPROVED').length;
      return {
        cycle: cycle.name,
        quarter: `Q${cycle.quarter} ${cycle.year}`,
        avgScore: avg,
        approvedSheets: approved,
        goals: cycleGoals.length,
      };
    }).reverse();
    const latest = rows[rows.length - 1] || null;
    const previous = rows[rows.length - 2] || null;
    res.json({
      rows,
      highlight: latest && previous ? {
        achievementChange: Number((latest.avgScore - previous.avgScore).toFixed(1)),
        approvalChange: latest.approvedSheets - previous.approvedSheets,
        goalChange: latest.goals - previous.goals,
      } : null,
      insights: latest && previous ? [
        latest.avgScore >= previous.avgScore ? 'Achievement improved quarter over quarter.' : 'Achievement dipped this quarter and needs attention.',
        latest.approvedSheets >= previous.approvedSheets ? 'Approval velocity improved.' : 'Approval velocity slowed down.',
        latest.goals >= previous.goals ? 'Goal coverage expanded.' : 'Goal count tightened, possibly due to focus.',
      ] : ['Not enough cycle data for a QoQ comparison.'],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/judge-mode
router.get('/judge-mode', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const cycle = await getOpenCycle();
    const core = await fetchCoreData(cycle);
    const hotspots = buildRiskSignals({ cycle, ...core }).slice(0, 3);
    res.json({
      shortcuts: [
        { label: 'Open Executive Dashboard', target: '/dashboard' },
        { label: 'Show Goal Tree', target: '/org-alignment' },
        { label: 'Review Risk Alerts', target: '/reports' },
        { label: 'Run Demo Reset', target: '/reports?action=reset' },
      ],
      preloadedFlow: [
        'Executive dashboard',
        'Org alignment tree',
        'Weekly summary',
        'Risk alerts',
        'Audit replay',
      ],
      hotspots,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/business-impact
router.get('/business-impact', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const cycle = await getOpenCycle();
    const core = await fetchCoreData(cycle);
    const riskAlerts = buildRiskSignals({ cycle, ...core });
    const approvedSheets = core.sheets.filter(sheet => sheet.status === 'APPROVED').length;
    const avgScore = core.achievements.filter(a => a.score != null).length
      ? Math.round((core.achievements.reduce((sum, a) => sum + Number(a.score || 0), 0) / core.achievements.filter(a => a.score != null).length) * 10) / 10
      : 0;

    res.json({
      metrics: [
        { label: 'Goal completion increase', value: `${Math.max(0, Math.round(avgScore - 70))}%` },
        { label: 'Delayed reviews reduced', value: `${Math.max(0, 100 - core.sheets.filter(sheet => sheet.status === 'PENDING_APPROVAL').length)}%` },
        { label: 'Manager responsiveness', value: `${Math.max(0, Math.round((approvedSheets / Math.max(1, core.users.filter(u => u.role === 'EMPLOYEE').length)) * 100))}%` },
        { label: 'Org alignment score', value: `${Math.min(100, Math.round((approvedSheets + Math.max(0, 100 - riskAlerts.filter(r => r.severity === 'HIGH').length)) / 2))}%` },
      ],
      summary: {
        cycle: cycle?.name || null,
        avgScore,
        approvedSheets,
        riskCount: riskAlerts.length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/audit
router.get('/audit', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data } = await supabase
      .from('audit_log')
      .select('*, users(name, email)')
      .order('ts', { ascending: false })
      .limit(100);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/org-tree
router.get('/org-tree', requireAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('users').select('id, name, email, role, department, manager_id');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/escalations
router.get('/escalations', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    // Return escalations directly from the escalation_events table instead of generating dynamically
    const { data: events, error } = await supabase.from('escalation_events').select('*, escalation_rules!inner(*)').eq('resolved', false).order('priority', { ascending: true });
    
    // If the table doesn't exist yet (migration not run), fallback to dynamic generation so the app doesn't break
    if (error && error.code === '42P01') {
      const { data: sheets } = await supabase.from('goal_sheets').select('*, users!inner(name, email, manager_id)');
      const escalations = [];
      (sheets || []).forEach(sheet => {
        const created = new Date(sheet.created_at);
        const daysOld = Math.floor((new Date() - created) / (1000 * 60 * 60 * 24));
        if (sheet.status === 'PENDING_APPROVAL') {
          escalations.push({ id: `esc-mgr-${sheet.id}`, type: 'MANAGER_APPROVAL_OVERDUE', priority: 'HIGH', entity: 'Goal Sheet', message: `Manager approval pending for ${sheet.users.name}`, days_overdue: daysOld, assignee_id: sheet.users.manager_id });
        } else if (sheet.status === 'DRAFT' && daysOld > 3) {
          escalations.push({ id: `esc-emp-${sheet.id}`, type: 'EMPLOYEE_SUBMISSION_OVERDUE', priority: 'MEDIUM', entity: 'Goal Sheet', message: `${sheet.users.name} has not submitted their goals`, days_overdue: daysOld - 3, assignee_id: sheet.employee_id });
        }
      });
      return res.json(escalations.sort((a, b) => b.days_overdue - a.days_overdue));
    }

    // Format events for the frontend
    const formatted = (events || []).map(e => ({
      id: e.id,
      type: e.escalation_rules.trigger_type,
      priority: e.priority,
      entity: `Goal Sheet #${e.entity_id}`,
      message: e.message,
      days_overdue: e.escalation_rules.threshold_days, // Proxy for display
      assignee_id: e.assignee_id
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/escalation-rules
router.get('/escalation-rules', requireAuth, requireManagerOrAdmin, async (req, res) => {
  const { data } = await supabase.from('escalation_rules').select('*').order('id');
  res.json(data || []);
});

// POST /api/admin/escalation-rules
router.post('/escalation-rules', requireAuth, requireAdmin, async (req, res) => {
  const { trigger_type, threshold_days, action } = req.body;
  const { data, error } = await supabase.from('escalation_rules').insert([{
    trigger_type, threshold_days: Number(threshold_days), action, is_active: true
  }]).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/admin/escalations/evaluate
router.post('/escalations/evaluate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: rules } = await supabase.from('escalation_rules').select('*').eq('is_active', true);
    if (!rules || rules.length === 0) return res.json({ message: 'No active rules', newEvents: 0 });

    const { data: sheets } = await supabase.from('goal_sheets').select('*, users!inner(name, manager_id)');
    
    let newEvents = 0;
    
    const demoMode = req.query.demo === '1';
    
    // Evaluate rules
    for (const sheet of sheets || []) {
      const created = new Date(sheet.created_at);
      let daysOld = Math.floor((new Date() - created) / (1000 * 60 * 60 * 24));
      
      if (demoMode) {
        // Artificially age the sheets by 14 days to ensure triggers fire during hackathon demos
        daysOld += 14;
      }

      for (const rule of rules) {
        let trigger = false;
        let priority = 'MEDIUM';
        let message = '';
        let assignee = null;

        if (rule.trigger_type === 'DRAFT_OVERDUE' && sheet.status === 'DRAFT' && daysOld >= rule.threshold_days) {
          trigger = true; priority = 'MEDIUM'; message = `${sheet.users.name} has not submitted goals (${daysOld} days)`; assignee = sheet.employee_id;
        } else if (rule.trigger_type === 'APPROVAL_OVERDUE' && sheet.status === 'PENDING_APPROVAL' && daysOld >= rule.threshold_days) {
          trigger = true; priority = 'HIGH'; message = `Manager approval pending for ${sheet.users.name} (${daysOld} days)`; assignee = sheet.users.manager_id;
        } else if (rule.trigger_type === 'CHECKIN_OVERDUE' && sheet.status === 'APPROVED' && daysOld >= rule.threshold_days) {
          trigger = true; priority = 'LOW'; message = `${sheet.users.name} has no recent check-ins`; assignee = sheet.employee_id;
        }

        if (trigger) {
          // check if already an unresolved event exists
          const { data: existing } = await supabase.from('escalation_events').select('id').eq('rule_id', rule.id).eq('entity_id', sheet.id).eq('resolved', false).maybeSingle();
          if (!existing) {
            await supabase.from('escalation_events').insert([{
              rule_id: rule.id, entity_id: sheet.id, assignee_id: assignee, message, priority
            }]);
            newEvents++;
          }
        }
      }
    }

    res.json({ message: 'Evaluator run completed successfully', newEvents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/seed-reset
router.post('/seed-reset', requireAuth, requireAdmin, (req, res) => {
  const { exec } = require('child_process');
  const path = require('path');
  const seedScript = path.join(__dirname, '..', 'seed.js');
  
  exec(`node "${seedScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing seed: ${error.message}`);
      return res.status(500).json({ error: 'Failed to reset database' });
    }
    res.json({ message: 'Database reset successfully' });
  });
});

// GET /api/admin/thrust-areas
router.get('/thrust-areas', requireAuth, async (req, res) => {
  const { data } = await supabase.from('thrust_areas').select('*');
  res.json(data || []);
});

// GET /api/admin/report
router.get('/report', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const cycleId = req.query.cycle_id;
    const format = String(req.query.format || 'json').toLowerCase();
    const { data: cycle } = cycleId
      ? await supabase.from('cycles').select('*').eq('id', cycleId).single()
      : await supabase.from('cycles').select('*').order('year', { ascending: false }).order('quarter', { ascending: false }).limit(1).maybeSingle();

    if (!cycle) return res.json({ cycle: null, rows: [] });

    const { data: sheets } = await supabase.from('goal_sheets').select('*, users!inner(name, email, department)').eq('cycle_id', cycle.id);

    const rows = [];
    for (const sheet of sheets || []) {
      const { data: goals } = await supabase.from('goals').select('*').eq('goal_sheet_id', sheet.id);
      for (const goal of goals || []) {
        const { data: ach } = await supabase.from('goal_achievements').select('*').eq('goal_id', goal.id).eq('cycle_id', cycle.id).maybeSingle();
        rows.push({
          employee_name: sheet.users.name,
          email: sheet.users.email,
          department: sheet.users.department,
          goal_title: goal.title,
          uom_type: normalizeUomType(goal.uom_type),
          target_value: goal.target_value,
          weightage: goal.weightage,
          thrust_area: goal.thrust_area,
          actual_value: ach?.actual_value || null,
          score: ach?.score || null,
          sheet_status: sheet.status,
        });
      }
    }

    if (format === 'csv') {
      const headers = ['Employee Name', 'Email', 'Department', 'Goal Title', 'UoM', 'Target', 'Weightage', 'Thrust Area', 'Actual Achievement', 'Score', 'Sheet Status'];
      const lines = [
        headers.join(','),
        ...rows.map(row => [
          row.employee_name,
          row.email,
          row.department,
          row.goal_title,
          row.uom_type,
          row.target_value,
          row.weightage,
          row.thrust_area,
          row.actual_value ?? '',
          row.score ?? '',
          row.sheet_status,
        ].map(csvCell).join(',')),
      ];

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="GoalKeeper_Report_${cycle.name}.csv"`);
      return res.send(lines.join('\n'));
    }

    if (format === 'xlsx') {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows.map(row => ({
        'Employee Name': row.employee_name,
        Email: row.email,
        Department: row.department,
        'Goal Title': row.goal_title,
        UoM: row.uom_type,
        Target: row.target_value,
        Weightage: row.weightage,
        'Thrust Area': row.thrust_area,
        'Actual Achievement': row.actual_value ?? '',
        Score: row.score ?? '',
        'Sheet Status': row.sheet_status,
      })));

      const columnWidths = [
        { wch: 22 },
        { wch: 26 },
        { wch: 18 },
        { wch: 30 },
        { wch: 12 },
        { wch: 14 },
        { wch: 12 },
        { wch: 20 },
        { wch: 18 },
        { wch: 10 },
        { wch: 16 },
      ];
      worksheet['!cols'] = columnWidths;
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="GoalKeeper_Report_${cycle.name}.xlsx"`);
      return res.send(buffer);
    }

    res.json({ cycle, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/seed-reset
router.post('/seed-reset', requireAuth, requireAdmin, async (req, res) => {
  try {
    const seed = require('../seed');
    // seed is async setup function
    await (typeof seed === 'function' ? seed() : Promise.resolve());
    res.json({ ok: true, message: 'Database seeded successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/analytics
router.get('/analytics', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    // 1. Fetch all cycles
    const { data: cycles } = await supabase.from('cycles').select('*').order('year').order('quarter');
    
    // 2. Fetch all users
    const { data: users } = await supabase.from('users').select('id, name, department, manager_id');
    
    // 3. Fetch all goals and achievements
    const { data: goals } = await supabase.from('goals').select('id, goal_sheet_id, title, thrust_area, uom_type, weightage');
    const { data: sheets } = await supabase.from('goal_sheets').select('id, employee_id, cycle_id, status');
    const { data: achievements } = await supabase.from('goal_achievements').select('goal_id, cycle_id, score');

    // Tab 1: Trends (QoQ Average Score)
    const trends = cycles.map(c => {
      const cycleAchs = achievements.filter(a => a.cycle_id === c.id);
      const avg = cycleAchs.length ? cycleAchs.reduce((sum, a) => sum + (a.score || 0), 0) / cycleAchs.length : 0;
      return { name: `Q${c.quarter} ${c.year}`, score: Math.round(avg) };
    });

    // Tab 2: Heatmap proxy (Employees by Cycle)
    const heatmap = users.map(u => {
      const row = { name: u.name.split(' ')[0] }; // short name
      cycles.forEach(c => {
        // find their sheet for this cycle
        const sheet = sheets.find(s => s.employee_id === u.id && s.cycle_id === c.id);
        if (!sheet) {
          row[`Q${c.quarter}`] = 0;
          return;
        }
        const sheetGoals = goals.filter(g => g.goal_sheet_id === sheet.id).map(g => g.id);
        const cycleAchs = achievements.filter(a => sheetGoals.includes(a.goal_id));
        const avg = cycleAchs.length ? cycleAchs.reduce((sum, a) => sum + (a.score || 0), 0) / cycleAchs.length : 0;
        row[`Q${c.quarter}`] = Math.round(avg);
      });
      return row;
    }).slice(0, 8); // Limit to top 8 for visual clarity

    // Tab 3: Distribution (Thrust Area & UoM)
    const thrustAreaMap = {};
    const uomMap = {};
    goals.forEach(g => {
      thrustAreaMap[g.thrust_area] = (thrustAreaMap[g.thrust_area] || 0) + 1;
      const key = normalizeUomType(g.uom_type);
      uomMap[key] = (uomMap[key] || 0) + 1;
    });
    
    const distribution = {
      thrustAreas: Object.entries(thrustAreaMap).map(([name, value]) => ({ name, value })),
      uomTypes: Object.entries(uomMap).map(([name, value]) => ({ name, value }))
    };

    // Tab 4: Manager Effectiveness (Avg score of their direct reports)
    const managers = users.filter(u => users.some(e => e.manager_id === u.id));
    const managerEffectiveness = managers.map(m => {
      const directReports = users.filter(u => u.manager_id === m.id).map(u => u.id);
      const teamSheets = sheets.filter(s => directReports.includes(s.employee_id));
      const teamSheetIds = teamSheets.map(s => s.id);
      const teamGoals = goals.filter(g => teamSheetIds.includes(g.goal_sheet_id)).map(g => g.id);
      const teamAchs = achievements.filter(a => teamGoals.includes(a.goal_id));
      const avg = teamAchs.length ? teamAchs.reduce((sum, a) => sum + (a.score || 0), 0) / teamAchs.length : 0;
      
      return {
        name: m.name.split(' ')[0],
        score: Math.round(avg),
        teamSize: directReports.length
      };
    }).filter(m => m.teamSize > 0);

    res.json({ trends, heatmap, distribution, managerEffectiveness });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/cost-dashboard
router.get('/cost-dashboard', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: employees } = await supabase.from('users').select('id, role');
    const employeeCount = (employees || []).filter(u => u.role === 'EMPLOYEE').length;
    const totalRequests = aiMetrics.totalRequests || 0;
    const cacheHits = aiMetrics.cacheHits || 0;
    const cacheMisses = aiMetrics.cacheMisses || 0;
    const cacheHitRate = totalRequests ? Math.round((cacheHits / totalRequests) * 100) : 0;
    const estimatedSpend = Number((aiMetrics.estimatedSpend || 0).toFixed(4));
    const costPerRequest = totalRequests ? Number((estimatedSpend / totalRequests).toFixed(4)) : 0;
    const projectedMonthlyCost100Users = Number((costPerRequest * 100 * 12).toFixed(2));

    res.json({
      totalRequests,
      cacheHits,
      cacheMisses,
      cacheHitRate,
      estimatedSpend,
      projectedMonthlyCost100Users,
      costPerRequest,
      employees: employeeCount,
      byRoute: aiMetrics.byRoute,
      byModel: aiMetrics.byModel,
      lastRequestAt: aiMetrics.lastRequestAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/compliance-checklist
router.get('/compliance-checklist', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: cycle } = await supabase.from('cycles').select('*').eq('status', 'OPEN').order('year', { ascending: false }).limit(1).maybeSingle();
    const { data: sheets } = await supabase.from('goal_sheets').select('id, status, employee_id, cycle_id, locked_at');
    const { data: goals } = await supabase.from('goals').select('id, goal_sheet_id, weightage');
    const { data: users } = await supabase.from('users').select('id, role, manager_id');
    const { data: shared } = await supabase.from('shared_goals').select('id, source_goal_id, linked_goal_id');
    const { data: auditRows } = await supabase.from('audit_log').select('id').limit(1);

    const approvedSheet = (sheets || []).find(s => s.status === 'APPROVED');
    const currentWindow = cycleWindowStatus(cycle);
    const totalWeightOk = (sheets || []).every(sheet => {
      const sheetGoals = (goals || []).filter(goal => goal.goal_sheet_id === sheet.id);
      return sheet.status !== 'APPROVED' || sheetGoals.reduce((sum, goal) => sum + Number(goal.weightage || 0), 0) === 100;
    });

    const checklist = [
      {
        key: 'demo_accounts',
        label: 'Demo accounts seeded',
        passed: (users || []).some(u => u.role === 'EMPLOYEE') && (users || []).some(u => u.role === 'MANAGER') && (users || []).some(u => u.role === 'ADMIN'),
      },
      {
        key: 'approval_flow',
        label: 'Approval flow available',
        passed: (sheets || []).some(s => s.status === 'PENDING_APPROVAL') && (sheets || []).some(s => s.status === 'APPROVED'),
      },
      {
        key: 'lock_enforcement',
        label: 'Locked goals remain read-only',
        passed: !!approvedSheet && !!approvedSheet.locked_at,
      },
      {
        key: 'weightage_validation',
        label: 'Approved sheets total 100% weightage',
        passed: totalWeightOk,
      },
      {
        key: 'quarter_window',
        label: 'Quarter window matches open dates',
        passed: !!cycle && currentWindow.canWrite,
        detail: currentWindow.reason,
      },
      {
        key: 'shared_goals',
        label: 'Shared goal links exist',
        passed: (shared || []).length > 0,
      },
      {
        key: 'audit_trail',
        label: 'Audit trail captures actions',
        passed: (auditRows || []).length > 0,
      },
      {
        key: 'cost_telemetry',
        label: 'AI cost telemetry captured',
        passed: aiMetrics.totalRequests > 0 || aiMetrics.cacheHits > 0 || aiMetrics.cacheMisses > 0,
      },
    ];

    res.json({ checklist, cycle, currentWindow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function tokenizeSearch(query) {
  return String(query || '').toLowerCase().split(/[^a-z0-9%$]+/).filter(Boolean);
}

// GET /api/admin/search?q=
router.get('/search', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) return res.json({ query, employees: [], sheets: [], goals: [], insights: [] });

    const tokens = tokenizeSearch(query);
    const { data: users } = await supabase.from('users').select('id, name, email, role, department, manager_id');
    const { data: sheets } = await supabase.from('goal_sheets').select('id, employee_id, cycle_id, status, locked_at');
    const { data: goals } = await supabase.from('goals').select('id, goal_sheet_id, title, thrust_area, uom_type, target_value, weightage, description');
    const { data: cycles } = await supabase.from('cycles').select('id, name, year, quarter, status');
    const { data: achievements } = await supabase.from('goal_achievements').select('goal_id, cycle_id, actual_value, score');

    const textScore = (text) => {
      const hay = String(text || '').toLowerCase();
      return tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
    };

    const employeeMatches = (users || []).map(user => ({
      ...user,
      score: textScore(`${user.name} ${user.email} ${user.department} ${user.role}`),
    })).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);

    const goalMatches = (goals || []).map(goal => ({
      ...goal,
      score: textScore(`${goal.title} ${goal.description} ${goal.thrust_area} ${goal.uom_type} ${goal.target_value}`),
    })).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);

    const sheetMatches = (sheets || []).map(sheet => {
      const user = (users || []).find(u => u.id === sheet.employee_id);
      const cycle = (cycles || []).find(c => c.id === sheet.cycle_id);
      return {
        ...sheet,
        employee_name: user?.name || 'Unknown',
        cycle_name: cycle?.name || 'Unknown',
        score: textScore(`${user?.name || ''} ${user?.email || ''} ${cycle?.name || ''} ${sheet.status}`),
      };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);

    const insightSet = [];
    if (/approved|lock/i.test(query)) insightSet.push('Matched approved or locked goal sheets.');
    if (/pending|review/i.test(query)) insightSet.push('Matched sheets awaiting manager review.');
    if (/goal|pipeline|revenue|churn|customer/i.test(query)) insightSet.push('Matched goal titles and thrust areas.');
    if (/q[1-4]|quarter|cycle/i.test(query)) insightSet.push('Matched cycle metadata.');

    res.json({ query, employees: employeeMatches, goals: goalMatches, sheets: sheetMatches, insights: insightSet });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/unlock-sheet/:sheetId
router.post('/unlock-sheet/:sheetId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const { data: sheet } = await supabase.from('goal_sheets').select('*').eq('id', req.params.sheetId).single();
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });

    await supabase.from('goal_sheets').update({ status: 'DRAFT', locked_at: null }).eq('id', sheet.id);
    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'UNLOCKED',
      entity: 'goal_sheet',
      entity_id: sheet.id,
      detail: reason || 'Unlocked by admin',
    });

    res.json({ ok: true, status: 'DRAFT' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role, department, manager_id, is_active, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const userIds = (users || []).map(user => user.id);
    const memberships = userIds.length
      ? (await supabase.from('team_members').select('id, team_id, employee_id, status, joined_at').in('employee_id', userIds)).data || []
      : [];
    const teamIds = [...new Set(memberships.map(member => member.team_id))];
    const teams = teamIds.length
      ? (await supabase.from('teams').select('id, name, description, manager_id, is_active').in('id', teamIds)).data || []
      : [];
    const teamMap = new Map(teams.map(team => [Number(team.id), team]));

    res.json({
      users: (users || []).map(user => ({
        ...user,
        teams: memberships.filter(member => Number(member.employee_id) === Number(user.id)).map(member => ({
          ...member,
          team: teamMap.get(Number(member.team_id)) || null,
        })),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/team-requests
router.get('/team-requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : 'pending';
    const query = supabase.from('team_join_requests').select('*');
    if (status !== 'all') query.eq('status', status);
    const { data: requests, error } = await query.order('requested_at', { ascending: false });
    if (error) throw error;

    const teams = (requests || []).length
      ? (await supabase.from('teams').select('id, name, description, manager_id, is_active').in('id', requests.map(request => request.team_id))).data || []
      : [];
    const users = (requests || []).length
      ? (await supabase.from('users').select('id, name, email, role, department').in('id', requests.map(request => request.employee_id))).data || []
      : [];
    const reviewers = (requests || []).length
      ? (await supabase.from('users').select('id, name, email, role, department').in('id', requests.map(request => request.reviewed_by).filter(Boolean))).data || []
      : [];
    const teamMap = new Map(teams.map(team => [Number(team.id), team]));
    const userMap = new Map(users.map(user => [Number(user.id), user]));
    const reviewerMap = new Map(reviewers.map(user => [Number(user.id), user]));

    res.json({
      requests: (requests || []).map(request => ({
        ...request,
        team: teamMap.get(Number(request.team_id)) || null,
        employee: userMap.get(Number(request.employee_id)) || null,
        reviewer: reviewerMap.get(Number(request.reviewed_by)) || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users/:userId/add-to-team
router.post('/users/:userId/add-to-team', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'EMPLOYEE') return res.status(400).json({ error: 'Only employees can be added to teams' });

    const teamId = Number(req.body.team_id);
    const team = await getTeam(teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });

    const now = new Date().toISOString();
    const existingMembership = await supabase.from('team_members').select('*').eq('team_id', team.id).eq('employee_id', user.id).maybeSingle();
    if (existingMembership.data) {
      const { error: memberUpdateError } = await supabase.from('team_members').update({ status: 'active', joined_at: now }).eq('id', existingMembership.data.id);
      if (memberUpdateError) throw memberUpdateError;
    } else {
      const { error: memberInsertError } = await supabase.from('team_members').insert({
        team_id: team.id,
        employee_id: user.id,
        status: 'active',
        joined_at: now,
      });
      if (memberInsertError) throw memberInsertError;
    }

    const { data: request, error: requestError } = await supabase.from('team_join_requests').upsert({
      team_id: team.id,
      employee_id: user.id,
      status: 'approved',
      reviewed_by: req.user.id,
      reviewed_at: now,
    }, { onConflict: 'team_id,employee_id,status' }).select().single();
    if (requestError) throw requestError;

    await logAdminEvent({
      userId: req.user.id,
      action: 'TEAM_EVENT',
      entity: 'team_join_request',
      entityId: request.id,
      detail: {
        note: `Admin added ${user.name} to team ${team.name}`,
        after: request,
      },
    });

    res.status(201).json({ ok: true, request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:userId/deactivate
router.patch('/users/:userId/deactivate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { data: updated, error } = await supabase.from('users').update({ is_active: false }).eq('id', user.id).select().single();
    if (error) throw error;

    await logAdminEvent({
      userId: req.user.id,
      action: 'UPDATED',
      entity: 'user',
      entityId: user.id,
      detail: {
        note: `Deactivated account for ${user.email}`,
        before: user,
        after: updated,
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:userId/reactivate
router.patch('/users/:userId/reactivate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { data: updated, error } = await supabase.from('users').update({ is_active: true }).eq('id', user.id).select().single();
    if (error) throw error;

    await logAdminEvent({
      userId: req.user.id,
      action: 'UPDATED',
      entity: 'user',
      entityId: user.id,
      detail: {
        note: `Reactivated account for ${user.email}`,
        before: user,
        after: updated,
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
