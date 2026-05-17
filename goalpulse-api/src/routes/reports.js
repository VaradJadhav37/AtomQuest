const express = require('express');
const { supabase } = require('../db');
const { requireAuth } = require('./auth');
const { buildPerformanceSummary, cycleWindowStatus } = require('../services/goalpulse');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  next();
}

async function getCycleById(cycleId) {
  if (!cycleId) return null;
  const { data } = await supabase.from('cycles').select('*').eq('id', cycleId).maybeSingle();
  return data || null;
}

async function getReportContext({ employeeId, cycleId }) {
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email, role, department, manager_id')
    .eq('id', employeeId)
    .single();

  if (!user) return null;

  const cycle = cycleId
    ? await getCycleById(cycleId)
    : (await supabase.from('cycles').select('*').eq('status', 'OPEN').order('year', { ascending: false }).order('quarter', { ascending: false }).limit(1).maybeSingle()).data
      || (await supabase.from('cycles').select('*').order('year', { ascending: false }).order('quarter', { ascending: false }).limit(1).maybeSingle()).data;

  if (!cycle) return null;

  const { data: sheet } = await supabase.from('goal_sheets').select('*').eq('employee_id', employeeId).eq('cycle_id', cycle.id).maybeSingle();
  const goals = sheet
    ? (await supabase.from('goals').select('*').eq('goal_sheet_id', sheet.id).order('id')).data || []
    : [];
  const goalIds = goals.map(goal => goal.id);
  const achievements = goalIds.length
    ? (await supabase.from('goal_achievements').select('*').eq('cycle_id', cycle.id).in('goal_id', goalIds)).data || []
    : [];
  const checkins = goalIds.length
    ? (await supabase.from('check_ins').select('*').eq('cycle_id', cycle.id).in('goal_id', goalIds)).data || []
    : [];
  const { data: manager } = user.manager_id
    ? await supabase.from('users').select('id, name, email, role, department').eq('id', user.manager_id).single()
    : { data: null };

  return { user, cycle, sheet, goals, achievements, checkins, manager };
}

router.get('/performance-summary/me', requireAuth, async (req, res) => {
  try {
    const ctx = await getReportContext({ employeeId: req.user.id, cycleId: req.query.cycle_id || null });
    if (!ctx) return res.status(404).json({ error: 'Performance summary not available' });
    const summary = buildPerformanceSummary(ctx);
    res.json({ ...summary, cycleWindow: cycleWindowStatus(ctx.cycle) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/performance-summary/:employeeId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const ctx = await getReportContext({ employeeId: Number(req.params.employeeId), cycleId: req.query.cycle_id || null });
    if (!ctx) return res.status(404).json({ error: 'Performance summary not available' });
    const summary = buildPerformanceSummary(ctx);
    res.json({ ...summary, cycleWindow: cycleWindowStatus(ctx.cycle) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
