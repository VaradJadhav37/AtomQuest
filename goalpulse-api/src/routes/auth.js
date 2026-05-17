// src/routes/auth.js — Supabase JS client version
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, department: user.department }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login service unavailable. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('id, email, name, role, department')
    .eq('id', req.user.id)
    .single();
  res.json(user);
});

async function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(h.slice(7), process.env.JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ error: 'Token expired or invalid' });
    }
  }

  const clerkEmail = String(req.headers['x-goalpulse-email'] || '').toLowerCase().trim();
  if (!clerkEmail) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, department')
      .eq('email', clerkEmail)
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.status(401).json({ error: 'No app user matches this Clerk account' });

    req.user = user;
    next();
  } catch (err) {
    console.error('Clerk auth bridge error:', err);
    res.status(500).json({ error: 'Authentication bridge failed' });
  }
}

module.exports = { router, requireAuth };
