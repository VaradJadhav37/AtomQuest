// src/routes/cycles.js — Supabase JS client
const express = require('express');
const { supabase } = require('../db');
const { requireAuth } = require('./auth');
const { cycleWindowStatus } = require('../services/goalpulse');

const router = express.Router();

router.get('/active', requireAuth, async (req, res) => {
  try {
    const { data: cycle } = await supabase.from('cycles').select('*').eq('status', 'OPEN').order('year', { ascending: false }).order('quarter', { ascending: false }).limit(1).maybeSingle();
    if (!cycle) return res.status(404).json({ error: 'No active cycle' });
    res.json({ ...cycle, window: cycleWindowStatus(cycle) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const { data } = await supabase.from('cycles').select('*').order('year', { ascending: false }).order('quarter', { ascending: false });
  res.json(data || []);
});

module.exports = router;
