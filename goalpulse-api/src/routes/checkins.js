const express = require('express');
const { supabase } = require('../db');
const { requireAuth } = require('./auth');
const { cycleWindowStatus, statusLabel, normalizeUomType, buildScoreExplanation } = require('../services/goalkeeper');

const router = express.Router();

function computeScore(goal, actual) {
  const type = normalizeUomType(goal.uom_type);
  const actualText = actual === undefined || actual === null ? '' : String(actual).trim();

  if (!actualText) return 0;

  if (type === 'Zero') {
    if (['0', 'false', 'no', 'none'].includes(actualText.toLowerCase())) return 100;
    const num = Number(actualText);
    if (!Number.isNaN(num)) return num === 0 ? 100 : 0;
    return 0;
  }

  if (type === 'Timeline') {
    const deadline = new Date(goal.target_value);
    const completion = new Date(actualText);
    if (Number.isNaN(deadline.getTime()) || Number.isNaN(completion.getTime())) return 0;
    if (completion <= deadline) return 100;
    const lateDays = Math.ceil((completion.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, 100 - lateDays * 10);
  }

  const target = parseFloat(goal.target_value);
  const act = parseFloat(actualText);
  if (Number.isNaN(target) || Number.isNaN(act)) return 0;
  if (target === 0) return act === 0 ? 100 : 0;
  return Math.min(100, Math.round((act / target) * 1000) / 10);
}

function deriveStatus(score, actualValue) {
  if (actualValue === null || actualValue === undefined || actualValue === '') return 'NOT_STARTED';
  if (score >= 100) return 'COMPLETED';
  if (score >= 50) return 'ON_TRACK';
  return 'ON_TRACK';
}

async function getOpenCycle() {
  const { data: cycle } = await supabase.from('cycles').select('*').eq('status', 'OPEN').order('year', { ascending: false }).order('quarter', { ascending: false }).limit(1).maybeSingle();
  return cycle || null;
}

// GET /api/checkins/goal/:goalId
router.get('/goal/:goalId', requireAuth, async (req, res) => {
  try {
    const cycle = await getOpenCycle();
    if (!cycle) return res.status(404).json({ error: 'No active cycle' });

    const [{ data: checkin }, { data: achievement }] = await Promise.all([
      supabase.from('check_ins').select('*').eq('goal_id', req.params.goalId).eq('cycle_id', cycle.id).maybeSingle(),
      supabase.from('goal_achievements').select('*').eq('goal_id', req.params.goalId).eq('cycle_id', cycle.id).maybeSingle(),
    ]);

    res.json({ checkin: checkin || null, achievement: achievement || null, cycle: { ...cycle, window: cycleWindowStatus(cycle) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/checkins/employee
router.post('/employee', requireAuth, async (req, res) => {
  try {
    const { goal_id, actual_value, employee_comment, status } = req.body;
    if (!goal_id) return res.status(400).json({ error: 'goal_id required' });

    const cycle = await getOpenCycle();
    if (!cycle) return res.status(400).json({ error: 'No active cycle' });
    const window = cycleWindowStatus(cycle);
    if (!window.canWrite) return res.status(400).json({ error: window.reason || 'Check-in window is closed' });

    const { data: goal } = await supabase.from('goals').select('*, goal_sheets!inner(employee_id, status)').eq('id', goal_id).single();
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.goal_sheets.employee_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (goal.goal_sheets.status !== 'APPROVED') return res.status(400).json({ error: 'Goal sheet must be approved before check-in' });

    const score = computeScore(goal, actual_value);
    const normalizedStatus = ['NOT_STARTED', 'ON_TRACK', 'COMPLETED'].includes(String(status || '').toUpperCase())
      ? String(status).toUpperCase()
      : deriveStatus(score, actual_value);
    const now = new Date().toISOString();

    await supabase.from('check_ins').upsert({
      goal_id,
      cycle_id: cycle.id,
      status: normalizedStatus,
      employee_comment: employee_comment || '',
      employee_submitted_at: now,
    }, { onConflict: 'goal_id,cycle_id' });

    await supabase.from('goal_achievements').upsert({
      goal_id,
      cycle_id: cycle.id,
      actual_value: actual_value === undefined || actual_value === null ? '' : String(actual_value),
      score,
    }, { onConflict: 'goal_id,cycle_id' });

    const { data: sharedLinks } = await supabase
      .from('shared_goals')
      .select('linked_goal_id')
      .eq('source_goal_id', goal_id)
      .neq('linked_goal_id', goal_id);

    for (const link of sharedLinks || []) {
      await supabase.from('goal_achievements').upsert({
        goal_id: link.linked_goal_id,
        cycle_id: cycle.id,
        actual_value: actual_value === undefined || actual_value === null ? '' : String(actual_value),
        score,
      }, { onConflict: 'goal_id,cycle_id' });
    }

    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'CHECK_IN',
      entity: 'goal',
      entity_id: goal_id,
      detail: JSON.stringify({
        note: 'Employee submitted actuals',
        before: null,
        after: { actual_value: String(actual_value), score, status: normalizedStatus },
      }),
    });

    res.json({
      ok: true,
      score,
      status: statusLabel(normalizedStatus),
      explanation: buildScoreExplanation(goal, actual_value, score),
    });
  } catch (err) {
    console.error('POST /checkins/employee:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/checkins/manager
router.post('/manager', requireAuth, async (req, res) => {
  try {
    if (!['MANAGER', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only managers can add manager comments' });
    }

    const { goal_id, manager_comment, status } = req.body;
    if (!goal_id) return res.status(400).json({ error: 'goal_id required' });

    const cycle = await getOpenCycle();
    if (!cycle) return res.status(400).json({ error: 'No active cycle' });
    const window = cycleWindowStatus(cycle);
    if (!window.canWrite && req.user.role !== 'ADMIN') return res.status(400).json({ error: window.reason || 'Check-in window is closed' });

    const normalizedStatus = ['NOT_STARTED', 'ON_TRACK', 'COMPLETED'].includes(String(status || '').toUpperCase())
      ? String(status).toUpperCase()
      : null;

    await supabase.from('check_ins').upsert({
      goal_id,
      cycle_id: cycle.id,
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      manager_comment: manager_comment || '',
      manager_submitted_at: new Date().toISOString(),
    }, { onConflict: 'goal_id,cycle_id' });

    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'MANAGER_COMMENT',
      entity: 'goal',
      entity_id: goal_id,
      detail: JSON.stringify({
        note: 'Manager comment added',
        after: { manager_comment: manager_comment || '', status: normalizedStatus },
      }),
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
