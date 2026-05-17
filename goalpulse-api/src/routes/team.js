// src/routes/team.js — Supabase JS client version
const express = require('express');
const { supabase } = require('../db');
const { requireAuth } = require('./auth');

const router = express.Router();

// GET /api/team/sheets
router.get('/sheets', requireAuth, async (req, res) => {
  try {
    if (!['MANAGER', 'ADMIN'].includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });

    const { data: cycle } = await supabase.from('cycles').select('*').eq('status', 'OPEN').order('year', { ascending: false }).limit(1).maybeSingle();
    if (!cycle) return res.status(404).json({ error: 'No active cycle' });

    const { data: directReports } = await supabase
      .from('users')
      .select('id, name, email, department')
      .eq('manager_id', req.user.id);

    const sheets = await Promise.all((directReports || []).map(async emp => {
      const { data: sheet } = await supabase.from('goal_sheets').select('*').eq('employee_id', emp.id).eq('cycle_id', cycle.id).maybeSingle();
      if (!sheet) return { employee: emp, sheet: null, goals: [], totalWeightage: 0 };

      const { data: goals } = await supabase.from('goals').select('*').eq('goal_sheet_id', sheet.id).order('id');
      const totalWeightage = (goals || []).reduce((s, g) => s + g.weightage, 0);

      const goalsWithData = await Promise.all((goals || []).map(async g => {
        const [{ data: achievement }, { data: checkin }] = await Promise.all([
          supabase.from('goal_achievements').select('*').eq('goal_id', g.id).eq('cycle_id', cycle.id).maybeSingle(),
          supabase.from('check_ins').select('*').eq('goal_id', g.id).eq('cycle_id', cycle.id).maybeSingle(),
        ]);
        return { ...g, achievement, checkin };
      }));

      return { employee: emp, sheet, goals: goalsWithData, totalWeightage };
    }));

    res.json({ cycle, sheets });
  } catch (err) {
    console.error('GET /team/sheets:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/team/members
router.get('/members', requireAuth, async (req, res) => {
  try {
    if (!['MANAGER', 'ADMIN'].includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    const { data } = await supabase.from('users').select('id, name, email, department, role').eq('manager_id', req.user.id);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
