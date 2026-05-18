const express = require('express');
const { supabase } = require('../db');
const { requireAuth } = require('./auth');
const { cycleWindowStatus, normalizeUomType } = require('../services/goalkeeper');

const router = express.Router();
const MAX_GOALS_PER_SHEET = 8;
const MIN_WEIGHTAGE = 10;

async function getCycle(cycleId) {
  if (cycleId) {
    const { data } = await supabase.from('cycles').select('*').eq('id', cycleId).maybeSingle();
    return data || null;
  }
  const { data: cycle } = await supabase
    .from('cycles')
    .select('*')
    .eq('status', 'OPEN')
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })
    .limit(1)
    .maybeSingle();
  return cycle || null;
}

function ensureWindowOpen(cycle) {
  const window = cycleWindowStatus(cycle);
  if (!window.canWrite) {
    const error = new Error(window.reason || 'Cycle window is closed');
    error.status = 400;
    throw error;
  }
}

async function getOrCreateSheet(employeeId, cycleId) {
  const { data: existing } = await supabase
    .from('goal_sheets')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('cycle_id', cycleId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('goal_sheets')
    .insert({ employee_id: employeeId, cycle_id: cycleId, status: 'DRAFT' })
    .select()
    .single();

  if (error) throw error;
  return created;
}

async function getSheetGoals(sheetId) {
  const { data } = await supabase.from('goals').select('*').eq('goal_sheet_id', sheetId).order('id');
  return data || [];
}

async function getSharedLinksByGoalId(goalId) {
  const { data } = await supabase
    .from('shared_goals')
    .select('*')
    .or(`linked_goal_id.eq.${goalId},source_goal_id.eq.${goalId}`)
    .order('id');
  return data || [];
}

function isSharedRecipient(goalId, sharedLinks) {
  return (sharedLinks || []).some(link => Number(link.linked_goal_id) === Number(goalId) && Number(link.source_goal_id) !== Number(goalId));
}

async function getTeamById(teamId) {
  if (!teamId) return null;
  const { data } = await supabase.from('teams').select('*').eq('id', teamId).maybeSingle();
  return data || null;
}

async function canManageTeam(user, teamId) {
  if (!teamId) return true;
  if (user.role === 'ADMIN') return true;
  const team = await getTeamById(teamId);
  return !!team && Number(team.manager_id) === Number(user.id) && team.is_active !== false;
}

async function enrichSheet(sheet) {
  const goals = await getSheetGoals(sheet.id);
  const { data: employee } = await supabase
    .from('users')
    .select('id, name, email, department')
    .eq('id', sheet.employee_id)
    .single();

  const totalWeightage = goals.reduce((s, g) => s + Number(g.weightage || 0), 0);
  return { ...sheet, goals, totalWeightage, employee };
}

// GET /api/goal-sheets/mine
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const cycle = await getCycle();
    if (!cycle) return res.status(404).json({ error: 'No active cycle' });

    const sheet = await getOrCreateSheet(req.user.id, cycle.id);
    const enriched = await enrichSheet(sheet);
    res.json({ cycle: { ...cycle, window: cycleWindowStatus(cycle) }, sheet: enriched });
  } catch (err) {
    console.error('GET /mine:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/goal-sheets/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: sheet } = await supabase
      .from('goal_sheets')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    res.json(await enrichSheet(sheet));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals â€” add goal to current sheet
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, uom_type, target_value, weightage, thrust_area, description, cycle_id, team_id } = req.body;
    const hasTarget = target_value !== undefined && target_value !== null && String(target_value).trim() !== '';
    const hasWeight = weightage !== undefined && weightage !== null && String(weightage).trim() !== '';
    if (!title || !uom_type || !hasTarget || !hasWeight) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedUom = normalizeUomType(uom_type);
    const weight = Number(weightage);
    if (weight < MIN_WEIGHTAGE) {
      return res.status(400).json({ error: `Minimum weightage per goal is ${MIN_WEIGHTAGE}%` });
    }

    const cycle = await getCycle(cycle_id);
    if (!cycle) return res.status(400).json({ error: 'No active cycle' });
    ensureWindowOpen(cycle);

    if (team_id && !(await canManageTeam(req.user, team_id))) {
      return res.status(403).json({ error: 'You do not manage that team' });
    }

    const sheet = await getOrCreateSheet(req.user.id, cycle.id);
    if (['APPROVED', 'PENDING_APPROVAL'].includes(sheet.status)) {
      return res.status(403).json({ error: 'Goal sheet is locked for editing' });
    }

    const existingGoals = await getSheetGoals(sheet.id);
    if (existingGoals.length >= MAX_GOALS_PER_SHEET) {
      return res.status(400).json({ error: `Maximum ${MAX_GOALS_PER_SHEET} goals per sheet` });
    }

    const currentTotal = existingGoals.reduce((s, g) => s + Number(g.weightage || 0), 0);
    if (currentTotal + weight > 100) {
      return res.status(400).json({ error: `Weightage would exceed 100% (current: ${currentTotal}%)` });
    }

    const { data: goal, error } = await supabase.from('goals').insert({
      goal_sheet_id: sheet.id,
      team_id: team_id || null,
      title,
      uom_type: normalizedUom,
      target_value: String(target_value),
      weightage: weight,
      thrust_area: thrust_area || 'General',
      description: description || '',
    }).select().single();
    if (error) throw error;

    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'CREATED',
      entity: 'goal',
      entity_id: goal.id,
      detail: JSON.stringify({
        note: `Created goal ${title}`,
        after: goal,
      }),
    });

    res.status(201).json(goal);
  } catch (err) {
    console.error('POST /goals:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals/shared â€” push a goal to multiple employees
router.post('/shared', requireAuth, async (req, res) => {
  try {
    if (!['MANAGER', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only managers can share goals' });
    }

    const { title, uom_type, target_value, weightage, thrust_area, description, employee_ids, cycle_id } = req.body;
    const hasTarget = target_value !== undefined && target_value !== null && String(target_value).trim() !== '';
    const hasWeight = weightage !== undefined && weightage !== null && String(weightage).trim() !== '';
    if (!title || !employee_ids || !employee_ids.length || !hasTarget || !hasWeight) {
      return res.status(400).json({ error: 'Missing title or employees' });
    }

    const normalizedUom = normalizeUomType(uom_type);
    const weight = Number(weightage);
    if (weight < MIN_WEIGHTAGE) return res.status(400).json({ error: `Minimum weightage per goal is ${MIN_WEIGHTAGE}%` });

    const cycle = await getCycle(cycle_id);
    if (!cycle) return res.status(400).json({ error: 'No active cycle' });
    ensureWindowOpen(cycle);

    const primaryId = employee_ids[0];
    const pSheet = await getOrCreateSheet(primaryId, cycle.id);
    const primaryGoals = await getSheetGoals(pSheet.id);
    if (primaryGoals.length >= MAX_GOALS_PER_SHEET) {
      return res.status(400).json({ error: `Primary owner already has ${MAX_GOALS_PER_SHEET} goals` });
    }
    if (primaryGoals.reduce((sum, g) => sum + Number(g.weightage || 0), 0) + weight > 100) {
      return res.status(400).json({ error: 'Primary owner weightage would exceed 100%' });
    }

    const { data: pGoal, error: pErr } = await supabase.from('goals').insert({
      goal_sheet_id: pSheet.id,
      title,
      uom_type: normalizedUom,
      target_value: String(target_value),
      weightage: weight,
      thrust_area: thrust_area || 'General',
      description: description || '',
    }).select().single();
    if (pErr) throw pErr;

    await supabase.from('shared_goals').insert({
      source_goal_id: pGoal.id,
      linked_goal_id: pGoal.id,
      target_employee_id: primaryId,
      primary_owner_id: primaryId,
    });

    for (let i = 1; i < employee_ids.length; i++) {
      const employeeId = employee_ids[i];
      const lSheet = await getOrCreateSheet(employeeId, cycle.id);
      const linkedGoals = await getSheetGoals(lSheet.id);
      if (linkedGoals.length >= MAX_GOALS_PER_SHEET) {
        return res.status(400).json({ error: `Employee ${employeeId} already has ${MAX_GOALS_PER_SHEET} goals` });
      }
      if (linkedGoals.reduce((sum, g) => sum + Number(g.weightage || 0), 0) + weight > 100) {
        return res.status(400).json({ error: `Employee ${employeeId} weightage would exceed 100%` });
      }

      const { data: linkedGoal, error: linkedErr } = await supabase.from('goals').insert({
        goal_sheet_id: lSheet.id,
        title,
        uom_type: normalizedUom,
        target_value: String(target_value),
        weightage: weight,
        thrust_area: thrust_area || 'General',
        description: description || '',
      }).select().single();
      if (linkedErr) throw linkedErr;

      await supabase.from('shared_goals').insert({
        source_goal_id: pGoal.id,
        linked_goal_id: linkedGoal.id,
        target_employee_id: employeeId,
        primary_owner_id: primaryId,
      });
    }

    res.status(201).json({ ok: true, primary_goal_id: pGoal.id, linked_count: employee_ids.length - 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { data: goal } = await supabase
      .from('goals')
      .select('*, goal_sheets!inner(status, employee_id)')
      .eq('id', req.params.id)
      .single();

    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.goal_sheets.employee_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (['APPROVED', 'PENDING_APPROVAL'].includes(goal.goal_sheets.status)) {
      return res.status(403).json({ error: 'Goal sheet is locked' });
    }

    const sharedLinks = await getSharedLinksByGoalId(goal.id);
    const isSharedRecipientGoal = isSharedRecipient(goal.id, sharedLinks);
    const hasOnlyWeightageChange = req.body.weightage !== undefined && !req.body.title && !req.body.uom_type && req.body.target_value === undefined && !req.body.thrust_area && req.body.description === undefined;

    if (isSharedRecipientGoal && req.user.role !== 'ADMIN' && !hasOnlyWeightageChange) {
      return res.status(403).json({ error: 'Linked shared goals can only adjust weightage' });
    }

    const updates = {};
    const { title, uom_type, target_value, weightage, thrust_area, description, team_id } = req.body;
    const normalizedUom = uom_type ? normalizeUomType(uom_type) : null;

    if (title && !isSharedRecipientGoal) updates.title = title;
    if (normalizedUom && !isSharedRecipientGoal) updates.uom_type = normalizedUom;
    if (target_value !== undefined && !isSharedRecipientGoal) updates.target_value = String(target_value);
    if (weightage !== undefined) {
      const newWeight = Number(weightage);
      if (newWeight < MIN_WEIGHTAGE) return res.status(400).json({ error: `Minimum weightage per goal is ${MIN_WEIGHTAGE}%` });
      const { data: sheetGoals } = await supabase.from('goals').select('id, weightage').eq('goal_sheet_id', goal.goal_sheet_id);
      const totalWithoutCurrent = (sheetGoals || []).filter(g => g.id !== goal.id).reduce((sum, g) => sum + Number(g.weightage || 0), 0);
      if (totalWithoutCurrent + newWeight > 100) return res.status(400).json({ error: 'Updated weightage would exceed 100%' });
      updates.weightage = newWeight;
    }
    if (thrust_area && !isSharedRecipientGoal) updates.thrust_area = thrust_area;
    if (description !== undefined && !isSharedRecipientGoal) updates.description = description;
    if (team_id !== undefined && !isSharedRecipientGoal) {
      if (!(await canManageTeam(req.user, team_id))) {
        return res.status(403).json({ error: 'You do not manage that team' });
      }
      updates.team_id = team_id || null;
    }

    const { data: updated, error } = await supabase.from('goals').update(updates).eq('id', goal.id).select().single();
    if (error) throw error;

    const isSharedSource = (sharedLinks || []).some(link => Number(link.source_goal_id) === Number(goal.id));
    if (isSharedSource) {
      const sharedCopies = await supabase.from('shared_goals').select('linked_goal_id').eq('source_goal_id', goal.id).neq('linked_goal_id', goal.id);
      const sharedFields = {};
      if (title) sharedFields.title = title;
      if (normalizedUom) sharedFields.uom_type = normalizedUom;
      if (target_value !== undefined) sharedFields.target_value = String(target_value);
      if (thrust_area) sharedFields.thrust_area = thrust_area;
      if (description !== undefined) sharedFields.description = description;
      if (Object.keys(sharedFields).length > 0) {
        for (const copy of sharedCopies.data || []) {
          await supabase.from('goals').update(sharedFields).eq('id', copy.linked_goal_id);
        }
      }
    }

    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'UPDATED',
      entity: 'goal',
      entity_id: goal.id,
      detail: JSON.stringify({
        note: `Updated goal ${title || goal.title}`,
        before: goal,
        after: updated,
      }),
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { data: goal } = await supabase
      .from('goals')
      .select('*, goal_sheets!inner(status, employee_id)')
      .eq('id', req.params.id)
      .single();

    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.goal_sheets.employee_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (['APPROVED', 'PENDING_APPROVAL'].includes(goal.goal_sheets.status)) {
      return res.status(403).json({ error: 'Cannot delete from a locked sheet' });
    }

    const { error } = await supabase.from('goals').delete().eq('id', goal.id);
    if (error) throw error;

    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'DELETED',
      entity: 'goal',
      entity_id: goal.id,
      detail: JSON.stringify({
        note: `Deleted goal ${goal.title}`,
        before: goal,
        after: null,
      }),
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goal-sheets/submit/:sheetId
router.post('/submit/:sheetId', requireAuth, async (req, res) => {
  try {
    const { data: sheet } = await supabase.from('goal_sheets').select('*').eq('id', req.params.sheetId).single();
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    if (sheet.employee_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (sheet.status !== 'DRAFT') return res.status(400).json({ error: 'Sheet is not in DRAFT status' });

    const { data: cycle } = await supabase.from('cycles').select('*').eq('id', sheet.cycle_id).single();
    ensureWindowOpen(cycle);

    const { data: goals } = await supabase.from('goals').select('weightage').eq('goal_sheet_id', sheet.id);
    const total = (goals || []).reduce((s, g) => s + Number(g.weightage || 0), 0);
    if (total !== 100) return res.status(400).json({ error: `Weightage must total 100% (current: ${total}%)` });

    await supabase.from('goal_sheets').update({ status: 'PENDING_APPROVAL' }).eq('id', sheet.id);
    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'SUBMITTED',
      entity: 'goal_sheet',
      entity_id: sheet.id,
      detail: JSON.stringify({
        note: 'Submitted for manager approval',
        after: { status: 'PENDING_APPROVAL' },
      }),
    });

    res.json({ ok: true, status: 'PENDING_APPROVAL' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /api/goal-sheets/approve/:sheetId
router.patch('/approve/:sheetId', requireAuth, async (req, res) => {
  try {
    if (!['MANAGER', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only managers can approve goal sheets' });
    }

    const { action, comment } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return res.status(400).json({ error: 'action must be APPROVED or REJECTED' });
    }

    const { data: sheet } = await supabase.from('goal_sheets').select('*, users!inner(manager_id)').eq('id', req.params.sheetId).single();
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    if (sheet.status !== 'PENDING_APPROVAL') return res.status(400).json({ error: 'Sheet is not pending approval' });
    if (req.user.role !== 'ADMIN' && sheet.users.manager_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the direct manager can approve this sheet' });
    }

    const newStatus = action === 'APPROVED' ? 'APPROVED' : 'DRAFT';
    const updates = { status: newStatus };
    if (action === 'APPROVED') updates.locked_at = new Date().toISOString();
    if (action === 'REJECTED') updates.locked_at = null;

    await supabase.from('goal_sheets').update(updates).eq('id', sheet.id);
    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action,
      entity: 'goal_sheet',
      entity_id: sheet.id,
      detail: JSON.stringify({
        note: comment || `Goal sheet ${action.toLowerCase()} by manager`,
        after: { status: newStatus, locked_at: updates.locked_at || null },
      }),
    });

    res.json({ ok: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
