const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const telemetryFile = path.join(__dirname, '..', '..', 'data', 'ai_telemetry.json');

const aiCache = global.__goalpulseAiCache || new Map();
global.__goalpulseAiCache = aiCache;

let initialMetrics = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  byRoute: {},
  byModel: {},
  estimatedSpend: 0,
  lastRequestAt: null,
};

if (!global.__goalpulseAiMetrics) {
  try {
    if (!fs.existsSync(path.dirname(telemetryFile))) {
      fs.mkdirSync(path.dirname(telemetryFile), { recursive: true });
    }
    if (fs.existsSync(telemetryFile)) {
      initialMetrics = JSON.parse(fs.readFileSync(telemetryFile, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load telemetry:', err);
  }
}

const aiMetrics = global.__goalpulseAiMetrics || initialMetrics;
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
  
  fs.writeFile(telemetryFile, JSON.stringify(aiMetrics, null, 2), 'utf8', (err) => {
    if (err) console.error('Failed to save telemetry:', err);
  });
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

function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(later, earlier) {
  const a = safeDate(later);
  const b = safeDate(earlier);
  if (!a || !b) return null;
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseAuditDetail(detail) {
  if (!detail) return { raw: '', before: null, after: null, note: '' };
  if (typeof detail === 'object') {
    return {
      raw: JSON.stringify(detail),
      before: detail.before ?? null,
      after: detail.after ?? null,
      note: detail.note || '',
    };
  }

  const text = String(detail);
  try {
    const parsed = JSON.parse(text);
    return {
      raw: text,
      before: parsed.before ?? null,
      after: parsed.after ?? null,
      note: parsed.note || parsed.message || '',
    };
  } catch {
    const match = text.match(/from\s+(.+?)\s+to\s+(.+)$/i);
    return {
      raw: text,
      before: match ? match[1] : null,
      after: match ? match[2] : null,
      note: text,
    };
  }
}

function buildScoreExplanation(goal, actualValue, score) {
  const uom = normalizeUomType(goal?.uom_type);
  const target = String(goal?.target_value ?? '').trim();
  const actual = String(actualValue ?? '').trim();

  if (!actual) {
    return {
      summary: 'No actual value submitted yet.',
      formula: 'Progress is 0% until an actual value is entered.',
      score: 0,
      type: uom,
    };
  }

  if (uom === 'Zero') {
    return {
      summary: actual === '0' || /^false|no|none$/i.test(actual)
        ? 'Zero-based objective met.'
        : 'Zero-based objective not yet met.',
      formula: `Zero means "target event happened" -> ${actual} => ${score}%`,
      score,
      type: uom,
    };
  }

  if (uom === 'Timeline') {
    return {
      summary: `Compared completion date ${actual} against deadline ${target}.`,
      formula: `On or before the deadline = 100%, late completion loses 10% per day.`,
      score,
      type: uom,
    };
  }

  return {
    summary: `Compared achievement ${actual} against target ${target}.`,
    formula: `Progress = min(100, actual / target * 100)`,
    score,
    type: uom,
  };
}

function buildGoalCascadeTree({ cycle, users = [], sheets = [], goals = [], achievements = [], checkins = [] }) {
  const userById = new Map(users.map(user => [Number(user.id), user]));
  const sheetById = new Map(sheets.map(sheet => [Number(sheet.id), sheet]));
  const goalsBySheet = new Map();
  goals.forEach(goal => {
    const list = goalsBySheet.get(Number(goal.goal_sheet_id)) || [];
    list.push(goal);
    goalsBySheet.set(Number(goal.goal_sheet_id), list);
  });
  const achievementByGoal = new Map((achievements || []).map(item => [Number(item.goal_id), item]));
  const checkinByGoal = new Map((checkins || []).map(item => [Number(item.goal_id), item]));

  const totalGoals = goals.length || 1;
  const totalScored = goals.filter(goal => achievementByGoal.get(Number(goal.id))?.score != null).length;
  const companyProgress = Math.round((totalScored / totalGoals) * 100);

  const objectiveMap = new Map();
  goals.forEach(goal => {
    const sheet = sheetById.get(Number(goal.goal_sheet_id));
    const user = sheet ? userById.get(Number(sheet.employee_id)) : null;
    const objectiveName = goal.thrust_area || 'General';
    const objectiveEntry = objectiveMap.get(objectiveName) || {
      id: `objective-${objectiveName}`,
      kind: 'objective',
      label: objectiveName,
      progressTotal: 0,
      goalCount: 0,
      childrenMap: new Map(),
    };
    objectiveEntry.goalCount += 1;

    const deptName = user?.department || 'General';
    const deptEntry = objectiveEntry.childrenMap.get(deptName) || {
      id: `dept-${objectiveName}-${deptName}`,
      kind: 'department',
      label: deptName,
      progressTotal: 0,
      goalCount: 0,
      childrenMap: new Map(),
    };
    deptEntry.goalCount += 1;

    const employeeName = user?.name || 'Unknown';
    const employeeEntry = deptEntry.childrenMap.get(String(user?.id || goal.goal_sheet_id)) || {
      id: `employee-${user?.id || goal.goal_sheet_id}`,
      kind: 'employee',
      label: employeeName,
      email: user?.email || '',
      goalCount: 0,
      progressTotal: 0,
      children: [],
    };
    employeeEntry.goalCount += 1;

    const achievement = achievementByGoal.get(Number(goal.id));
    const checkin = checkinByGoal.get(Number(goal.id));
    const score = Number(achievement?.score || 0);
    const goalNode = {
      id: `goal-${goal.id}`,
      kind: 'goal',
      label: goal.title,
      score,
      weightage: Number(goal.weightage || 0),
      status: checkin?.status || (achievement ? 'COMPLETED' : 'NOT_STARTED'),
      target_value: goal.target_value,
      actual_value: achievement?.actual_value || '',
      uom_type: normalizeUomType(goal.uom_type),
      thrust_area: objectiveName,
      department: deptName,
      employee: employeeName,
      explanation: buildScoreExplanation(goal, achievement?.actual_value, score),
    };
    employeeEntry.children.push(goalNode);
    employeeEntry.progressTotal += score;
    deptEntry.childrenMap.set(String(user?.id || goal.goal_sheet_id), employeeEntry);
    deptEntry.progressTotal += score;
    objectiveEntry.childrenMap.set(deptName, deptEntry);
    objectiveEntry.progressTotal += score;
    objectiveMap.set(objectiveName, objectiveEntry);
  });

  const objectives = [...objectiveMap.values()].map(objective => ({
    id: objective.id,
    kind: objective.kind,
    label: objective.label,
    progress: objective.goalCount ? Math.round(objective.progressTotal / objective.goalCount) : 0,
    goalCount: objective.goalCount,
    children: [...objective.childrenMap.values()].map(dept => ({
      id: dept.id,
      kind: dept.kind,
      label: dept.label,
      progress: dept.goalCount ? Math.round(dept.progressTotal / dept.goalCount) : 0,
      goalCount: dept.goalCount,
      children: [...dept.childrenMap.values()].map(employee => ({
        id: employee.id,
        kind: employee.kind,
        label: employee.label,
        email: employee.email,
        progress: employee.goalCount ? Math.round(employee.progressTotal / employee.goalCount) : 0,
        goalCount: employee.goalCount,
        children: employee.children,
      })),
    })),
  }));

  return {
    id: `cycle-${cycle?.id || 'current'}`,
    kind: 'company',
    label: cycle?.name || 'Company Goals',
    progress: companyProgress,
    goalCount: goals.length,
    children: objectives,
  };
}

function buildRiskSignals({ cycle, goals = [], sheets = [], checkins = [], achievements = [], users = [] }) {
  const sheetById = new Map(sheets.map(sheet => [Number(sheet.id), sheet]));
  const userById = new Map(users.map(user => [Number(user.id), user]));
  const achievementByGoal = new Map((achievements || []).map(item => [Number(item.goal_id), item]));
  const checkinByGoal = new Map((checkins || []).map(item => [Number(item.goal_id), item]));
  const now = new Date();
  const cycleOpen = safeDate(cycle?.open_date);
  const cycleClose = safeDate(cycle?.close_date);
  const cycleSpanDays = cycleOpen && cycleClose ? Math.max(1, daysBetween(cycleClose, cycleOpen) || 1) : 90;
  const cycleElapsed = cycleOpen ? clamp((now - cycleOpen) / (cycleClose ? (cycleClose - cycleOpen) : cycleSpanDays * 24 * 60 * 60 * 1000), 0, 1) : 0.5;
  const expectedProgress = Math.round(cycleElapsed * 100);

  return goals.map(goal => {
    const sheet = sheetById.get(Number(goal.goal_sheet_id));
    const employee = sheet ? userById.get(Number(sheet.employee_id)) : null;
    const achievement = achievementByGoal.get(Number(goal.id));
    const checkin = checkinByGoal.get(Number(goal.id));
    const lastActivity = [
      achievement?.submitted_at,
      checkin?.manager_submitted_at,
      checkin?.employee_submitted_at,
      goal.created_at,
      sheet?.created_at,
    ].map(safeDate).filter(Boolean).sort((a, b) => b - a)[0] || null;
    const inactiveDays = lastActivity ? daysBetween(now, lastActivity) : null;
    const score = Number(achievement?.score || 0);
    const reasons = [];
    let riskScore = 0;

    if (!achievement && !checkin) {
      riskScore += 35;
      reasons.push('No check-in or achievement recorded yet');
    }
    if (inactiveDays != null && inactiveDays >= 21) {
      riskScore += 25;
      reasons.push(`Inactive for ${inactiveDays} days`);
    }
    if (inactiveDays != null && inactiveDays >= 14 && inactiveDays < 21) {
      riskScore += 12;
      reasons.push(`Inactive for ${inactiveDays} days`);
    }
    if (checkin?.status === 'NOT_STARTED') {
      riskScore += 20;
      reasons.push('Consecutive not-started status');
    }
    if (sheet?.status === 'PENDING_APPROVAL') {
      riskScore += 18;
      reasons.push('Manager review overdue');
    }
    if (sheet?.status === 'DRAFT') {
      riskScore += 10;
      reasons.push('Goal sheet still in draft');
    }
    if (goal.weightage >= 30) {
      riskScore += 8;
      reasons.push('High-weight goal needs close attention');
    }
    if (score > 0 && score < expectedProgress - 20) {
      riskScore += 18;
      reasons.push(`Performance below expected trajectory (${score}% vs ${expectedProgress}%)`);
    }
    if (score < 40 && achievement) {
      riskScore += 15;
      reasons.push('Low achievement score');
    }
    if (sheet && sheet.status === 'APPROVED' && !checkin?.manager_submitted_at) {
      riskScore += 10;
      reasons.push('Manager sign-off missing');
    }

    const severity = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';
    return {
      goal_id: goal.id,
      goal_title: goal.title,
      employee_id: employee?.id || null,
      employee_name: employee?.name || 'Unknown',
      department: employee?.department || 'General',
      thrust_area: goal.thrust_area || 'General',
      status: checkin?.status || (achievement ? 'COMPLETED' : 'NOT_STARTED'),
      score,
      riskScore: Math.min(100, riskScore),
      severity,
      inactiveDays,
      expectedProgress,
      actualProgress: score,
      reasons,
      lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
      weightage: Number(goal.weightage || 0),
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

function compareCycles(current = {}, previous = {}) {
  const currentScore = Number(current.overallScore || 0);
  const previousScore = Number(previous.overallScore || 0);
  const completionDelta = Number((Number(current.completionRate || 0) - Number(previous.completionRate || 0)).toFixed(1));
  const scoreDelta = Number((currentScore - previousScore).toFixed(1));
  return {
    cycle: current.cycle?.name || current.name || 'Current cycle',
    previousCycle: previous.cycle?.name || previous.name || 'Previous cycle',
    scoreDelta,
    completionDelta,
    direction: scoreDelta >= 0 ? 'up' : 'down',
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
  safeDate,
  daysBetween,
  parseAuditDetail,
  buildScoreExplanation,
  buildGoalCascadeTree,
  buildRiskSignals,
  compareCycles,
};
