// src/routes/auth.js — Supabase JS client version
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db');

const router = express.Router();

async function getUserByEmail(email) {
  const normalized = String(email || '').toLowerCase().trim();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', normalized)
    .maybeSingle();

  if (!error) return data;
  if (String(error.message || '').includes('column users.is_active does not exist')) {
    const { data: fallback, error: fallbackError } = await supabase
      .from('users')
      .select('id, email, name, role, password_hash, department, manager_id, created_at')
      .eq('email', normalized)
      .maybeSingle();
    if (fallbackError) throw fallbackError;
    return fallback ? { ...fallback, is_active: true } : null;
  }
  throw error;
}

async function getUserById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role, department, is_active')
    .eq('id', id)
    .maybeSingle();

  if (!error) return data;
  if (String(error.message || '').includes('column users.is_active does not exist')) {
    const { data: fallback, error: fallbackError } = await supabase
      .from('users')
      .select('id, email, name, role, department')
      .eq('id', id)
      .maybeSingle();
    if (fallbackError) throw fallbackError;
    return fallback ? { ...fallback, is_active: true } : null;
  }
  throw error;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.is_active === false) return res.status(403).json({ error: 'Account is deactivated' });

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
  const user = await getUserById(req.user.id);
  if (user?.is_active === false) return res.status(403).json({ error: 'Account is deactivated' });
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

  const clerkEmail = String(req.headers['x-goalkeeper-email'] || '').toLowerCase().trim();
  if (!clerkEmail) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await getUserByEmail(clerkEmail);
    if (!user) return res.status(401).json({ error: 'No app user matches this Clerk account' });
    if (user.is_active === false) return res.status(403).json({ error: 'Account is deactivated' });

    req.user = user;
    next();
  } catch (err) {
    console.error('Clerk auth bridge error:', err);
    res.status(500).json({ error: 'Authentication bridge failed' });
  }
}

module.exports = { router, requireAuth };
