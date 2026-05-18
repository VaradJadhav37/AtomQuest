// goalSheets.js — Goal Sheet management routes (separate from goal CRUD)
// Fixes route collision: /api/goal-sheets and /api/goals previously shared one router
const express = require('express');
const { supabase } = require('../db');
const { requireAuth } = require('./auth');
const { cycleWindowStatus } = require('../services/goalkeeper');

const router = express.Router();

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

async function enrichSheet(sheet) {
  const { data: goals } = await supabase.from('goals').select('*').eq('goal_sheet_id', sheet.id).order('id');
  const { data: employee } = await supabase
    .from('users')
    .select('id, name, email, department')
    .eq('id', sheet.employee_id)
    .single();
  const allGoals = goals || [];
  const teamGoals = allGoals.filter(g => g.team_id != null);
  const individualGoals = allGoals.filter(g => g.team_id == null);
  const teamWeightage = teamGoals.reduce((s, g) => s + Number(g.weightage || 0), 0);
  const individualWeightage = individualGoals.reduce((s, g) => s + Number(g.weightage || 0), 0);
  return {
    ...sheet,
    goals: allGoals,
    // totalWeightage = individual only (used for submit validation & legacy calcs)
    totalWeightage: individualWeightage,
    teamWeightage,
    individualWeightage,
    employee,
  };
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

// GET /api/goal-sheets/employee/:employeeId
router.get('/employee/:employeeId', requireAuth, async (req, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    if (req.user.role === 'EMPLOYEE' && employeeId !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'MANAGER') {
      const { data: reportCheck } = await supabase
        .from('users')
        .select('id')
        .eq('id', employeeId)
        .eq('manager_id', req.user.id)
        .maybeSingle();
      if (!reportCheck && employeeId !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const cycle = await getCycle();
    if (!cycle) return res.status(404).json({ error: 'No active cycle found' });
    const sheet = await getOrCreateSheet(employeeId, cycle.id);
    const enriched = await enrichSheet(sheet);
    res.json({ cycle: { ...cycle, window: cycleWindowStatus(cycle) }, sheet: enriched });
  } catch (err) {
    console.error('GET /employee/:employeeId:', err);
    res.status(500).json({ error: err.message });
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
    if (req.user.role === 'EMPLOYEE' && Number(sheet.employee_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'MANAGER') {
      const { data: reportCheck } = await supabase
        .from('users')
        .select('id')
        .eq('id', sheet.employee_id)
        .eq('manager_id', req.user.id)
        .maybeSingle();
      if (!reportCheck && Number(sheet.employee_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    res.json(await enrichSheet(sheet));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goal-sheets/submit/:sheetId
router.post('/submit/:sheetId', requireAuth, async (req, res) => {
  try {
    const { data: sheet } = await supabase.from('goal_sheets').select('*').eq('id', req.params.sheetId).single();
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    if (Number(sheet.employee_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    if (sheet.status !== 'DRAFT') return res.status(400).json({ error: 'Sheet is not in DRAFT status' });

    const { data: cycle } = await supabase.from('cycles').select('*').eq('id', sheet.cycle_id).single();
    ensureWindowOpen(cycle);

    const { data: goals } = await supabase.from('goals').select('weightage, team_id').eq('goal_sheet_id', sheet.id);
    const individualGoals = (goals || []).filter(g => g.team_id == null);
    const individualTotal = individualGoals.reduce((s, g) => s + Number(g.weightage || 0), 0);
    if (individualTotal !== 100) {
      return res.status(400).json({
        error: `Individual goal weightage must total 100% (current: ${individualTotal}%). Team goals have a separate budget.`,
      });
    }

    await supabase.from('goal_sheets').update({ status: 'PENDING_APPROVAL' }).eq('id', sheet.id);
    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'SUBMITTED',
      entity: 'goal_sheet',
      entity_id: sheet.id,
      detail: JSON.stringify({ note: 'Submitted for manager approval', after: { status: 'PENDING_APPROVAL' } }),
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
    const { data: sheet } = await supabase
      .from('goal_sheets')
      .select('*, users!inner(manager_id)')
      .eq('id', req.params.sheetId)
      .single();
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
