const express = require('express');
const { supabase } = require('../db');
const { requireAuth } = require('./auth');
const { attachSse } = require('../services/realtime');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ notifications: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/read', requireAuth, async (req, res) => {
  try {
    const { data: existing, error: readErr } = await supabase
      .from('notifications')
      .select('id, user_id, read_at')
      .eq('id', Number(req.params.id))
      .maybeSingle();
    if (readErr) throw readErr;
    if (!existing || Number(existing.user_id) !== Number(req.user.id)) return res.status(404).json({ error: 'Not found' });
    if (existing.read_at) return res.json({ ok: true });

    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', existing.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stream', requireAuth, async (req, res) => {
  const userId = Number(req.user.id);
  attachSse(req, res, (event) => !event.user_id || Number(event.user_id) === userId);
});

module.exports = router;
