const crypto = require('crypto');

const aiCache = global.__goalpulseAiCache || new Map();
global.__goalpulseAiCache = aiCache;

const aiMetrics = global.__goalpulseAiMetrics || {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  byRoute: {},
  byModel: {},
  estimatedSpend: 0,
  lastRequestAt: null,
};
global.__goalpulseAiMetrics = aiMetrics;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeUomType(uomType) {
  const value = String(uomType || '').trim().toLowerCase();
  if (!value) return 'Numeric';
  if (value === 'percentage' || value === '%') return 'Percentage';
  if (value === 'timeline' || value === 'date' || value === 'deadline') return 'Timeline';
  if (value === 'zero' || value === 'zero-based' || value === 'boolean' || value === 'bool') return 'Zero';
  return 'Numeric';
}

function cacheKey(parts) {
  return sha256(JSON.stringify(parts));
}

function getCachedValue(key) {
  const entry = aiCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    aiCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedValue(key, value, ttlMs = 1000 * 60 * 60 * 12) {
  aiCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function recordAiMetric({ route, model = 'unknown', cached = false, cost = 0 }) {
  aiMetrics.totalRequests += 1;
  aiMetrics.lastRequestAt = new Date().toISOString();
  if (cached) aiMetrics.cacheHits += 1;
  else aiMetrics.cacheMisses += 1;
  aiMetrics.byRoute[route] = (aiMetrics.byRoute[route] || 0) + 1;
  aiMetrics.byModel[model] = (aiMetrics.byModel[model] || 0) + 1;
  aiMetrics.estimatedSpend = Number((aiMetrics.estimatedSpend + cost).toFixed(4));
}

function cycleWindowStatus(cycle, now = new Date()) {
  if (!cycle) {
    return { canWrite: false, reason: 'No active cycle', now: now.toISOString() };
  }

  const current = new Date(now);
  const open = new Date(cycle.open_date);
  const close = new Date(cycle.close_date);
  const canWrite = current >= open && current <= close && cycle.status === 'OPEN';

  return {
    canWrite,
    reason: canWrite
      ? 'Cycle window open'
      : current < open
        ? `Cycle opens on ${cycle.open_date}`
        : current > close
          ? `Cycle closed on ${cycle.close_date}`
          : 'Cycle is not open',
    now: current.toISOString(),
    openDate: cycle.open_date,
    closeDate: cycle.close_date,
  };
}

function statusLabel(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return 'Completed';
  if (normalized === 'ON_TRACK') return 'On Track';
  if (normalized === 'NOT_STARTED') return 'Not Started';
  if (normalized === 'AT_RISK') return 'At Risk';
  return status || 'Not Started';
}

function buildProgressNarrative(summary) {
  const lines = [];
  lines.push(`Overall achievement is ${summary.overallScore}% across ${summary.goalsCount} goals.`);
  if (summary.completionRate >= 90) lines.push('The sheet is well balanced and ready for appraisal.');
  else if (summary.completionRate >= 60) lines.push('The sheet is progressing, but a few goals still need attention.');
  else lines.push('The sheet needs more updates before it is ready for review.');

  if (summary.topThrustAreas?.length) {
    lines.push(`Strongest areas: ${summary.topThrustAreas.slice(0, 2).map(item => item.thrust_area).join(', ')}.`);
  }

  if (summary.lowestGoals?.length) {
    lines.push(`Focus next on ${summary.lowestGoals.slice(0, 1).map(g => g.title).join(', ')}.`);
  }

  return lines.join(' ');
}

function buildPerformanceSummary({ user, cycle, sheet, goals, achievements, checkins, manager }) {
  const byGoal = new Map(goals.map(goal => [goal.id, goal]));
  const achievementByGoal = new Map((achievements || []).map(a => [a.goal_id, a]));
  const checkinByGoal = new Map((checkins || []).map(c => [c.goal_id, c]));

  const goalRows = goals.map(goal => {
    const achievement = achievementByGoal.get(goal.id) || null;
    const checkin = checkinByGoal.get(goal.id) || null;
    return {
      ...goal,
      achievement,
      checkin,
      score: achievement?.score ?? null,
      actual_value: achievement?.actual_value ?? null,
      status: checkin?.status || (achievement ? 'COMPLETED' : 'NOT_STARTED'),
    };
  });

  const scoredRows = goalRows.filter(row => row.score != null);
  const totalWeight = goalRows.reduce((sum, row) => sum + Number(row.weightage || 0), 0);
  const weightedScore = goalRows.reduce((sum, row) => sum + ((row.score || 0) * (Number(row.weightage || 0) / 100)), 0);
  const completionRate = goalRows.length ? Math.round((scoredRows.length / goalRows.length) * 100) : 0;

  const thrustMap = new Map();
  goalRows.forEach(row => {
    const entry = thrustMap.get(row.thrust_area) || { thrust_area: row.thrust_area, count: 0, weightedScore: 0 };
    entry.count += 1;
    entry.weightedScore += Number(row.score || 0) * (Number(row.weightage || 0) / 100);
    thrustMap.set(row.thrust_area, entry);
  });

  const topThrustAreas = [...thrustMap.values()]
    .map(item => ({ ...item, weightedScore: Math.round(item.weightedScore * 10) / 10 }))
    .sort((a, b) => b.weightedScore - a.weightedScore);

  const lowestGoals = [...goalRows]
    .filter(row => row.score != null)
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .slice(0, 3)
    .map(row => ({ title: row.title, score: row.score, thrust_area: row.thrust_area }));

  return {
    user,
    manager,
    cycle,
    sheet,
    goals: goalRows,
    goalsCount: goalRows.length,
    totalWeight,
    scoredGoals: scoredRows.length,
    completionRate,
    overallScore: goalRows.length ? Math.round(weightedScore * 10) / 10 : 0,
    topThrustAreas,
    lowestGoals,
    narrative: buildProgressNarrative({
      overallScore: goalRows.length ? Math.round(weightedScore * 10) / 10 : 0,
      goalsCount: goalRows.length,
      completionRate,
      topThrustAreas,
      lowestGoals,
    }),
    comments: goalRows
      .filter(row => row.checkin?.employee_comment || row.checkin?.manager_comment)
      .map(row => ({
        goal_title: row.title,
        employee_comment: row.checkin?.employee_comment || '',
        manager_comment: row.checkin?.manager_comment || '',
        employee_status: statusLabel(row.checkin?.status),
      })),
    summaryLines: [
      `Employee: ${user?.name || 'Unknown'}`,
      `Cycle: ${cycle?.name || 'N/A'}`,
      `Manager: ${manager?.name || 'N/A'}`,
      `Goal count: ${goalRows.length}`,
      `Completion rate: ${completionRate}%`,
      `Overall score: ${goalRows.length ? Math.round(weightedScore * 10) / 10 : 0}%`,
    ],
  };
}

module.exports = {
  aiCache,
  aiMetrics,
  cacheKey,
  getCachedValue,
  setCachedValue,
  recordAiMetric,
  normalizeUomType,
  cycleWindowStatus,
  buildPerformanceSummary,
  statusLabel,
};
